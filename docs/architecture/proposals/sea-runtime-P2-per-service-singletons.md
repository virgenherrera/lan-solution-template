<!-- toon-meta
fmt: TOON
doc: docs/architecture/proposals/sea-runtime-P2-per-service-singletons.md
title: "SEA runtime proposal P2: per-service singletons"
type: architecture
summary: "Proposal: each registered service becomes its own singleton provider owning pid and restarts, with a stdin snapshot command."
ids[0]:
related[3]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/proposals/sea-runtime-P1-registry-status-event.md,docs/architecture/proposals/sea-runtime-P3-minimal-pid-hook.md
status: proposed
updated: 2026-11-05
-->

# SEA runtime proposal P2: every service is a singleton injectable

Proposal P2 of three. Siblings: P1 and P3 (paths in the metadata block; see [Not verified](#not-verified)). Status: proposed, nothing implemented.

Idea in one line: each registered service route becomes its own singleton Nest provider. It owns its lifecycle, pid and restart state. The registry is a thin aggregate over those providers. The host asks for state with a stdin `snapshot` command answered on stdout. No new network route.

## Navigation

- [Problem](#problem)
- [Design](#design)
- [Exposure and security](#exposure-and-security)
- [Smoke impact](#smoke-impact)
- [Migration units](#migration-units)
- [Scale](#scale)
- [Maintainability](#maintainability)
- [Testability](#testability)
- [Risks](#risks)
- [Not verified](#not-verified)

## Problem

[Back to navigation](#navigation)

Evidence is at commit `e88d01d` on branch `minor/poc-06-sea-runtime-refactor`.

1. No typed record holds a service's pid, state and restart count. The only collection is `private readonly services: ServiceLifecycle[]` at `apps/sea-runtime/src/supervisor/supervisor.service.ts:17`.
2. The pid is created at `apps/sea-runtime/src/supervisor/child-spawner.ts:20` and only logged at `:29` through `spawnedMessage`. Nobody stores it.
3. The `ChildProcess` handle is a public mutable field on the lifecycle (`apps/sea-runtime/src/supervisor/service-lifecycle.ts:47`, set at `:79`). `StatusPublisher` reads it to send IPC (`apps/sea-runtime/src/supervisor/status-publisher.ts:37-39`).
4. The restart count exists only as the windowed `RestartPolicy.restarts` array (`service-lifecycle.ts:13-16`). It forgets entries older than `restartWindowMs` (`:38`), so it is not a total.
5. The stdout status event carries only `id` and `status` per service (`status-publisher.ts:35`). `SIDECAR_KIND` has `status` and `shutdown` only (`libs/service-registry/src/sidecar-protocol.ts:8-11`).
6. Consequence: the blackbox smoke reads pids from stderr with a regex (`Run.spawnedPids`, `tools/scripts/smoke-sea.ts:143`, via `SPAWNED_PATTERN` imported at `:19`; `smoke-pg.ts:95` counts the same lines). A log wording change breaks the test, and a test of logs is not a test of effects.
7. DI gaps that stay open under this proposal (not in its scope): `process.execPath` and `process.stderr` at `child-spawner.ts:20,27-28`, free functions in `process-tree.ts:7-48`, `isSea` at `supervisor.service.ts:2,32`.

## Design

[Back to navigation](#navigation)

### The rule and the honest tension

Human rules: every service is a singleton injectable; the token is an abstract class; `useClass` appears in the module only.

Already true today: `Clock`, `Random` and `ServiceRoutes` follow the rule (`apps/sea-runtime/src/supervisor/supervisor.module.ts:19-21`).

The tension: "one provider per service id" means the number of providers depends on data, while an abstract class token names one provider. Three ways to resolve it, with their cost:

| Option | Token | Keeps the rule? | Cost |
| --- | --- | --- | --- |
| A. String or symbol token per id, `useFactory` | `'service:api-gateway'` | No: not an abstract class, not `useClass` | Breaks both human rules. Rejected. |
| B. One generated concrete class per id, extending an abstract port | the generated class | Yes in form: `useClass: generated`. | The class is created at runtime by a class factory. No static symbol to import unless the class is exported as a module-scope const. Constructor injection of its dependencies must be declared programmatically (`Inject(token)(cls, undefined, index)`), because TypeScript emits no `design:paramtypes` for runtime classes. A QC spike on `@nestjs/core` 12.3.2 showed this works. |
| C. One singleton `ManagedServices` that builds N plain objects | `ManagedServices` | Yes | That is not "each service is a singleton provider". It is the current `SupervisorService` plus a map. Not P2. |

P2 uses option B. Be clear about what it buys and what it breaks:

- Buys: each service is a real Nest singleton with its own constructor injection of `Clock`, `Random`, `ChildSpawner`, `ProcessTree`.
- Breaks: no consumer injects a single service by a compile-time class symbol, because the class does not exist at compile time. The aggregate gets them through one abstract `ManagedServiceSet` token, whose `useFactory` collects the generated classes. That `useFactory` is a second exception to "useClass only". It must stay inside the dynamic module and be listed here as a known deviation.
- Breaks: provider count is fixed when the module graph is built. Routes must be known then (see [Risks](#risks)).

### Provider map

| Token (abstract class) | Provided by (module only) | Lifetime | Owns |
| --- | --- | --- | --- |
| `Clock` (exists) | `SystemClock` via `useClass` (`supervisor.module.ts:19`) | singleton | time |
| `Random` (exists) | `SystemRandom` via `useClass` (`:20`) | singleton | jitter source |
| `ServiceRoutes` (exists) | `SeaServiceRoutes` via `useClass` (`:21`) | singleton | route list |
| `ManagedService` (new, abstract, base of all generated classes) | not provided itself | n/a | the per-service contract |
| `ServiceProcessFor(id)` (new, generated, one per route) | `ServiceModule.forRoutes(routes)`, `useClass: generated` | singleton, one per id | lifecycle, pid, restart total, state, child handle (private) |
| `ManagedServiceSet` (new, abstract) | `ServiceModule`, `useFactory` over the generated classes (documented deviation) | singleton | ordered list of services; start order from `startupOrder(routes)` |
| `ServiceRegistry` (new, abstract) | `ServiceModule`, `useClass: AggregateServiceRegistry` | singleton | thin aggregate: `snapshot()`, `changes$`, aggregate state |
| `ChildSpawner` (exists, `child-spawner.ts:11`) | plain provider | singleton | spawns one process; now returns the handle to the service that asked, nobody else keeps it |
| `ProcessTree` (new injectable replacing free functions) | plain provider | singleton | `stopTree`, `treeSpawnOptions` as methods |
| `StatusPublisher` (exists, `status-publisher.ts:16`) | plain provider | singleton | subscribes to `ServiceRegistry.changes$`; writes stderr, stdout event, IPC broadcast |
| `SnapshotResponder` (new) | `SidecarModule` | singleton | answers a `snapshot` command on stdout |
| `SupervisorService` (exists, `supervisor.service.ts:16`) | plain provider | singleton | boot order and shutdown only; no private array |

### TypeScript contract

```ts
// libs/service-registry/src/service-snapshot.ts (new)
export const serviceSnapshotSchema = z.strictObject({
  id: z.string().min(1),
  state: serviceStatusSchema,
  pid: z.number().int().positive().optional(),   // absent while not spawned
  restarts: z.number().int().nonnegative(),      // total respawns since supervisor start, monotonic
  spawnedAt: z.number().int().nonnegative().optional(), // epoch ms of the latest spawn
});
export type ServiceSnapshot = z.infer<typeof serviceSnapshotSchema>;
```

```ts
// apps/sea-runtime/src/supervisor/managed-service.ts (new)
export abstract class ManagedService {
  abstract readonly id: string;
  abstract start(): void;                       // idempotent; begins spawn and restart loop
  abstract stop(): Promise<void>;               // no more restart; stops the process tree
  abstract snapshot(): ServiceSnapshot;         // pure read, no I/O
  abstract readonly changes$: Observable<ServiceSnapshot>; // every state, pid or restart change
  abstract sendToChild(message: unknown): void; // IPC without exposing the handle
}

// apps/sea-runtime/src/supervisor/managed-service-set.ts (new)
export abstract class ManagedServiceSet {
  abstract readonly services: readonly ManagedService[]; // startup order
}

// apps/sea-runtime/src/supervisor/service-registry.ts (new)
export abstract class ServiceRegistry {
  abstract snapshot(): readonly ServiceSnapshot[];
  abstract readonly changes$: Observable<readonly ServiceSnapshot[]>;
  abstract state(): AggregateState;
}

// apps/sea-runtime/src/supervisor/service-module.ts (new)
@Module({})
export class ServiceModule {
  static forRoutes(routes: readonly ServiceRoute[]): DynamicModule {
    const classes = routes.map((route) => managedServiceClass(route)); // extends ManagedService, @Injectable
    return {
      module: ServiceModule,
      providers: [
        ...classes.map((useClass) => ({ provide: useClass, useClass })),
        { provide: ManagedServiceSet, useFactory: (...services: ManagedService[]) => ({ services }), inject: classes },
        { provide: ServiceRegistry, useClass: AggregateServiceRegistry },
      ],
      exports: [ServiceRegistry, ManagedServiceSet],
    };
  }
}
```

Moving state into the service: `ServiceLifecycle` (`service-lifecycle.ts:45`) stops being a value built by `ServiceLifecycleFactory` and becomes the body of the generated class. `ServiceLifecycleFactory` is deleted. The hook callbacks `spawn`, `onStatus`, `log` disappear because the class injects `ChildSpawner` and `SupervisorLogger` itself. The restart total is a new counter beside the windowed policy; the policy keeps its meaning for the budget (`service-lifecycle.ts:35-41`).

### Wire contract (stdin snapshot, stdout answer)

Two new kinds in `SIDECAR_KIND`, both strict zod objects, additive to ADR-006:

```ts
// stdin, host to supervisor
{ kind: 'snapshot', requestId: string }            // requestId: 1..64 chars, echoed back
// stdout, supervisor to host
{ kind: 'snapshot', requestId: string, state: AggregateState, children: ServiceSnapshot[] }
```

- The existing `status` event stays unchanged. `snapshot` is pull; `status` stays push.
- `SupervisorService` today treats every command as shutdown (`supervisor.service.ts:37-40`). That `next` handler must route by `kind`. This is a behavior change in code shared with the existing `shutdown` command, so it needs a test that `shutdown` still works.
- The response is built from `ServiceRegistry.snapshot()`: a read of in-memory state, no spawn, no I/O.

## Exposure and security

[Back to navigation](#navigation)

- No new network route, no listener, no change to the HTTPS surface. The gateway never learns pids or restart counts.
- The surface is the stdin/stdout pair of the supervisor. Only its parent (the Tauri host or a smoke) can write stdin or read stdout. That parent can already call `ps`, so pids are not new secrets to it.
- New attack surface: a larger stdin parser. Mitigations: `z.strictObject`, one JSON object per line (existing rule in `sidecar-protocol.ts:5-6`), `requestId` length bounded, unknown kinds rejected and logged (existing invalid-line path, `sidecar-input.ts:21` per the sea-modules map; not re-read this turn).
- Output: the snapshot contains pid, state, counters, timestamps. No paths, no config, no secrets. Do not add the executable path or arguments to it without a separate review.
- Rejected variant: adding the same data to `GET /api/health`. It would put pids on a LAN route. Whether health is authenticated is "no verificado" (see [Not verified](#not-verified)).
- Host compatibility: the Rust host matches only `kind == "status"` (`sidecar.rs:153-155` per the arch plan, read in an earlier step). A new stdout kind is ignored if that claim holds. "no verificado" in this turn for the exact line numbers.

## Smoke impact

[Back to navigation](#navigation)

Principle: the blackbox smoke asserts effects, not logs. The snapshot is a claim of the product. The process table is the proof. Every pid the snapshot reports must be checked against `ps`.

| Today | After | Evidence kind |
| --- | --- | --- |
| `Run.spawnedPids` parses stderr (`smoke-sea.ts:143`) | `Run.snapshot()` writes a `snapshot` line to stdin, waits for the matching `requestId` on stdout | claim |
| `SPAWNED_PATTERN` import (`smoke-sea.ts:19`, `smoke-pg.ts:16`) | removed; the export in `libs/service-registry/src/supervisor-log.ts:9` is deleted when both are gone (the log line itself stays for operators) | none |
| `Run.spawned` counts log lines (`smoke-pg.ts:95`) | `children.length` from a snapshot | claim |
| other `Run.spawnedPids` users (`smoke-sea.ts:290`, `:344`, `:447`, `:560`, `:599`, `:610`, `:652`, `:660`, `:663`, `:666`, `:671`, `:673`), including the no-spawn asserts and the budget case `:660-673` | read from the snapshot children list | claim |
| `bootFailing` = exit 1 plus zero spawned lines (`smoke-pg.ts:209`) | exit 1, no snapshot child with a pid, and `ps` shows no child of the supervisor | effect |
| `alive` / `allGone` (`smoke-sea.ts:167,250`) | pid list from the snapshot; `allGone` also scans `ps` descendants of the supervisor | effect |
| child SIGKILL case (`smoke-sea.ts:445`) | kill pid P; poll snapshot until `pid != P`, `restarts == 1`, `state == ready`; then `ps` shows the new pid with ppid equal to the supervisor and the same executable | effect |

Kept unchanged because they are already independent effect oracles: HTTPS health (`smoke-sea.ts:226,232-233`), `identityOf` (`smoke-sea.ts:238`), `portFree` (`:275`), `verify-platform.ts:57`, `e2e-desktop.ts:34`.

Honest weakness: the snapshot comes from the system under test. If the supervisor lies, a snapshot-only test passes. That is why `ps` and the ports stay in every assertion.

Line numbers for the smoke helpers come from the earlier map (`map-smoke-helpers.toon`). Bodies were not re-read in this turn.

## Migration units

[Back to navigation](#navigation)

Units have disjoint edit surfaces so they can be built in parallel. Each unit keeps `pnpm` checks green on its own. U1 lands first; U2 and U4 then run in parallel; U3 needs U2; U5 needs U3 and U4.

| Unit | Edit surface | Depends on | Delivers |
| --- | --- | --- | --- |
| U1 contract | `libs/service-registry/src/service-snapshot.ts` (new), `libs/service-registry/src/sidecar-protocol.ts`, `libs/service-registry/src/index.ts`, `apps/sea-runtime/src/supervisor/managed-service.ts`, `managed-service-set.ts`, `service-registry.ts` (new, abstract only), the ADR-006 page | none | types and schemas, ADR-006 amendment |
| U2 per-service provider | `apps/sea-runtime/src/supervisor/service-module.ts` (new), `managed-service-class.ts` (new), `service-lifecycle.ts`, `child-spawner.ts`, `process-tree.ts` (to injectable), delete `service-lifecycle.factory.ts` | U1 | generated singleton per route; pid and restart total owned by the service |
| U3 aggregate and rewiring | `supervisor/aggregate-service-registry.ts` (new), `supervisor/status-publisher.ts`, `supervisor/supervisor.service.ts`, `supervisor/supervisor.module.ts`, `runtime/runtime.module.ts` | U1, U2 | thin registry; no private array; routes known at graph build |
| U4 snapshot IO | `apps/sea-runtime/src/sidecar/snapshot-responder.ts` (new), `sidecar/sidecar.module.ts`, `sidecar/sidecar-input.ts` | U1 | command routing by `kind`; stdout answer |
| U5 smoke | `tools/scripts/smoke-sea.ts`, `tools/scripts/smoke-pg.ts`, `libs/service-registry/src/supervisor-log.ts` | U3, U4 | log parsing removed; effect assertions |

Docs, metadata and `docs/meta.toon` regeneration follow AGENTS.md and ship with U1 and U5. Generators: any new Nest file is created with `pnpm dlx @nestjs/cli` where a schematic exists; spec files it creates are deleted in the same commit (REQ-TEST-01).

## Scale

[Back to navigation](#navigation)

- Today `SERVICES` holds `api-gateway` only (`apps/sea-runtime/src/services.ts:4`, per the sea-modules map). With one service this design adds classes without removing a failure mode. Say so plainly.
- Cost per service: one generated class, one provider, one `changes$` subject, the same child process as today. Memory and CPU are negligible; the bound is the number of child processes, which P2 does not change.
- Snapshot is O(n) reads of in-memory state per request. Fine for tens of services.
- Adding a service: add a route to `SERVICES`; the module generates the provider. No code change in the aggregate.
- Weak point: service-specific behavior (a different restart budget, a special readiness rule) needs a per-service subclass hook, which the generated class does not give for free. A real second service with different needs may force a static class per service, and then the dynamic generation was wasted work.

## Maintainability

[Back to navigation](#navigation)

Gains:
- One owner per fact: pid, restarts and state live in the service that produces them, not in a registry that mirrors them.
- The public `child` field (`service-lifecycle.ts:47`) goes away; IPC goes through `sendToChild`.
- Smoke no longer depends on a log format.

Costs:
- Generated classes defeat go-to-definition, code-graph indexing and stack-trace readability. Names can be set (`ApiGatewayService`) but they exist only at runtime.
- Two documented deviations from the human rule (`useFactory` for the set; runtime-generated classes).
- A dynamic module is harder to read than a flat provider list.
- More files than P1 (a central registry) for the same observable output.

## Testability

[Back to navigation](#navigation)

REQ-TEST-01 forbids dedicated unit or integration suites. All checks run as effects through the compiled SEA binary (REQ-TEST-07: supervisor mode, coordinated shutdown, restart on child crash).

Effect checks (each needs an observable outcome, not a log line):

1. Start. `ps` shows one child per route under the supervisor pid; the snapshot lists the same pids; HTTPS health answers.
2. Crash restart. SIGKILL the child; the old pid disappears from `ps`; a new pid appears under the supervisor; snapshot shows `restarts == 1` and `ready`.
3. Budget exhaustion. Kill the child past `maxRestarts`; snapshot shows `failed`; aggregate state becomes `error`; the supervisor exits with `errorExitCode` (`supervisor.service.ts:65`); no child remains in `ps`.
4. Shutdown. `shutdown` on stdin; every pid gone; exit 0; ports free. (Regression for the command routing change.)
5. Snapshot correlation. Two snapshots with different `requestId`; each answer echoes its own.
6. Invalid snapshot line (missing `requestId`). Supervisor logs the error, stays up, and a later valid snapshot still answers.
7. Stop of a stuck child. A child that ignores IPC shutdown is killed by the group SIGKILL; `ps` is empty.

Mutation list (each change must make at least one check fail; run by hand against the built binary):

| Mutation | Caught by |
| --- | --- |
| Do not increment `restarts` on respawn | 2 |
| Snapshot returns the pid of the first spawn forever | 2 |
| Skip the respawn after crash | 2 |
| Drop `requestId` from the answer | 5 |
| Answer from a cached copy taken at boot | 2 |
| `shutdown` no longer routed after the `kind` switch | 4 |
| Invalid line crashes the input subscription | 6 |
| Stop does not kill the process group | 7, 4 |
| Do not stop services in reverse order | 4 (needs an ordering oracle; "no verificado" that one exists today) |
| Generated class shares one state object between ids | needs two routes; not testable with `SERVICES` of one entry |

The last mutation shows a real gap: with one service, the one feature P2 adds (isolation between services) cannot be checked by any effect.

## Risks

[Back to navigation](#navigation)

1. Routes at graph-build time. `forRoutes(routes)` needs the array before DI exists. Today `ServiceRoutes.load()` runs inside DI, and in SEA it reads an asset (`supervisor/service-routes-source.ts:6-10`). Calling that function at module import repeats the decorator-time I/O and `isSea` coupling already flagged at `persistence/persistence.module.ts:11` (`new AppPathsService`), `:15` (comment), `:26` (`isSea` ternary). Fallback: use `SERVICES` (`services.ts`) directly. That makes the build-time constant the source and the SEA asset a duplicate. Either choice weakens `ServiceRoutes` as the single source.
2. Rule deviations (see [Design](#design)). The human must accept `useFactory` for the set and runtime-generated classes, or this proposal fails its own rule.
3. Boundary files stay outside the container. `main.ts` catch and `sea-entry.ts` argv dispatch run before Nest; a startup failure has no provider to report it. P2 does not change that.
4. Command routing change touches the shared shutdown path (`supervisor.service.ts:37-40`). A mistake silently disables shutdown by stdin.
5. Host compatibility. A host that fails on unknown kinds would break. Unverified beyond the Rust claim above.
6. Over-fit. One service today; value appears only when a second service exists.
7. Restart total versus the windowed policy. Two counters with different meanings invite misuse. Name them `restarts` (total) and `window` (budget) in code.
8. Ordering. Generated providers are created in an order Nest decides. Start order must come from `startupOrder(routes)`, not from provider order.

## Not verified

[Back to navigation](#navigation)

- Bodies of `smoke-sea.ts:143-148`, `smoke-pg.ts`, `verify-platform.ts`, `e2e-desktop.ts` helpers: line numbers come from the earlier map only.
- `sea-entry.ts` has no logic beyond argv dispatch: map only.
- `sidecar-input.ts:21` invalid-line handling and `sidecar.rs:153-155` (host ignores unknown kinds): earlier steps only, not re-read now.
- Whether `GET /api/health` is unauthenticated.
- Resolved by a QC spike (`@nestjs/core` 12.3.2): a class built by a factory function with `Inject(token)(cls, undefined, index)` and `Injectable()(cls)` applied programmatically gets constructor injection. Without the `Inject` calls the dependency is `undefined`. Not checked: duplicate provider names for generated classes with the same name.
- Whether a stop-order oracle exists in the smoke today.
- No new REQ id is claimed. Existing ids cited: REQ-TEST-01, REQ-TEST-07. A requirement for the snapshot command, if wanted, needs a human decision.
