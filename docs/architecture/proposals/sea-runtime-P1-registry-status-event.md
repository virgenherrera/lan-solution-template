<!-- toon-meta
fmt: TOON
doc: docs/architecture/proposals/sea-runtime-P1-registry-status-event.md
title: "Proposal P1 sea-runtime child registry and status event"
type: architecture
summary: "Proposes a singleton ChildRegistry and HostModule ports, exposed as children[] on the stdout status event."
ids[0]:
related[3]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/proposals/sea-runtime-P2-per-service-singletons.md,docs/architecture/proposals/sea-runtime-P3-minimal-pid-hook.md
status: proposed
updated: 2026-11-05
-->

# Proposal P1: child registry and children[] on the status event

Status: proposed. Nothing here is implemented. The sibling proposals P2 and P3 are listed in `related`; all three files exist.

## Problem

The `sea-runtime` supervisor already uses Nest providers for `Clock`, `Random` and `ServiceRoutes` (abstract class token plus `useClass` in `apps/sea-runtime/src/supervisor/supervisor.module.ts:19-21`). The child processes themselves have no typed owner, and several process and IO touches bypass the container.

- The pid of a child exists only in a log line (`apps/sea-runtime/src/supervisor/child-spawner.ts:29`).
- The `ChildProcess` handle is a public field of `ServiceLifecycle` (`service-lifecycle.ts:47`, set at `:79`). `SupervisorService` reads it to stop the tree (`supervisor.service.ts:81`).
- The restart count lives only inside the windowed `RestartPolicy` (`service-lifecycle.ts:13-16`, `afterExit$` at `:107-120`). Nothing reports it.
- The `status` stdout event carries only `state` and `{id, status}` per service (`libs/service-registry/src/status-snapshot.ts:8-11`, emitted at `status-publisher.ts:35`). The publisher also skips an event when the aggregate state is unchanged (`status-publisher.ts:32`), so a child replaced after a crash is invisible to the host.
- Direct host access outside the container:
  - `spawn`, `process.execPath`, `process.stderr` in `child-spawner.ts:20-28`.
  - `spawn` of `taskkill`, `process.kill`, `setTimeout`, `Date.now` as free functions in `process-tree.ts:7-48`.
  - `process.stdout.write` in `sidecar/sidecar-output.ts:8`.
  - `isSea()` in `supervisor.service.ts:2,:32`, and `process.exit` at `supervisor.service.ts:84`.
  - `isSea` and `getAsset` in `service-routes-source.ts` (body not read: no verificado).
  - `isSea()` and `new AppPathsService()` at decorator time in `persistence/persistence.module.ts:2,:11,:26`.
- Consequence for tests: the smoke scripts cannot ask the product which children exist. `tools/scripts/smoke-sea.ts:143-148` rebuilds the pid list by matching `SPAWNED_PATTERN` against stderr. `smoke-pg.ts:95` counts spawned lines the same way. That is a log check, not an effect check.

## Design

Two additions, one contract change.

1. `ChildRegistry`: a singleton injectable, owned by `SupervisorModule`. It is the only writer and reader of typed child state. `ServiceLifecycle` and `ChildSpawner` feed it; `StatusPublisher` and `SupervisorService` read it.
2. `HostModule` (new, `apps/sea-runtime/src/host/host.module.ts`): ports for the process and IO bypasses listed above.
3. `ChildEntry[]` is added to the existing `status` stdout event as `children`. No new route, no new event kind, no new stdin command.

Human rules applied: every service is a singleton injectable; the token is an abstract class and `useClass` appears in modules only.

### Provider map

| Token (abstract class) | Implementation (`useClass`) | Module | Replaces |
| --- | --- | --- | --- |
| `ChildRegistry` (new) | `InMemoryChildRegistry` | `SupervisorModule` | pid in log, public `child`, hidden restart count |
| `ProcessStreams` (new) | `SystemProcessStreams` | `HostModule` | `process.stdout/stderr` in `sidecar-output.ts:8`, `child-spawner.ts:27-28` |
| `HostProcess` (new) | `SystemHostProcess` (execPath, platform, `exit`) | `HostModule` | `process.execPath`, `process.platform` (`process-tree.ts:4`), `process.exit` |
| `RuntimeEnvironment` (new) | `SystemRuntimeEnvironment` (wraps `node:sea`) | `HostModule` | `isSea()` in `supervisor.service.ts:32` |
| `ProcessTree` (today free functions) | `ProcessTree` as a plain singleton `@Injectable()` | `SupervisorModule` | `stopTree`, `treeSpawnOptions` |
| `Clock`, `Random`, `ServiceRoutes` | unchanged | `SupervisorModule` | none |

`ProcessTree` is a concrete injectable, not a port: it has one implementation and nothing needs to swap it. Only the other tokens are abstract. The `persistence.module.ts` decorator-time `isSea()` ternary stays as the one module-level exception (Occam: no `RuntimeAssetSource` indirection). That choice is open; see Risks.

### Contract

New file `libs/service-registry/src/child-entry.ts`, validated by zod like the rest of the sidecar contract:

```ts
export const CHILD_STATE = ['starting', 'ready', 'restarting', 'failed', 'exited'] as const;

export const childEntrySchema = z.strictObject({
  serviceId: z.string().min(1),
  pid: z.number().int().positive().optional(), // absent while restarting
  state: z.enum(CHILD_STATE),
  restarts: z.number().int().nonnegative(), // total spawns after the first, since supervisor start
  spawnedAt: z.number().int().nonnegative(), // ms epoch from Clock
});
export type ChildEntry = z.infer<typeof childEntrySchema>;
```

The status event gains `children: z.array(childEntrySchema)` in `libs/service-registry/src/sidecar-protocol.ts:14-17`. The `strictObject` there rejects unknown keys, so the field must be added to the schema before any producer emits it.

Abstract ports (DI only; REQ-TEST-01 forbids isolated unit suites, so these exist for wiring, never for mocks):

```ts
export abstract class ChildRegistry {
  abstract register(serviceId: string, child: ChildProcess, spawnedAt: number): void;
  abstract markState(serviceId: string, state: ChildEntry['state']): void;
  abstract entries(): readonly ChildEntry[];
  abstract handle(serviceId: string): ChildProcess | undefined; // used only by ProcessTree
  abstract readonly changes$: Observable<void>;
}

export abstract class ProcessStreams {
  abstract readonly stdout: Writable;
  abstract readonly stderr: Writable;
  abstract readonly stdin: Readable;
}

export abstract class HostProcess {
  abstract readonly execPath: string;
  abstract readonly platform: NodeJS.Platform;
  abstract exit(code: number): never;
}

export abstract class RuntimeEnvironment {
  abstract isSea(): boolean;
}
```

Flow: `ChildSpawner.spawn` calls `registry.register` with the real `child.pid` and `Clock.now()`. `ServiceLifecycle` calls `markState` where it already calls `setStatus` (`service-lifecycle.ts:70`, `:89`, `:114`, `:118`). The restart counter increments in `afterExit$` when a restart is planned. `StatusPublisher.publish` drops the aggregate-only dedupe: it emits when the aggregate state or `children` differ from the last event (change from `status-publisher.ts:32`). `ServiceLifecycle` stops exposing `child`.

## Exposure and security

Option A (chosen): `children[]` on the existing stdout event.

- No network route and no new channel. stdout is a pipe held only by the parent that already owns the supervisor. A pid is not secret from that parent (it can run `ps`).
- The HTTPS surface does not change. Adding the children to `GET /api/health` is rejected: it would put pids and restart counters on a LAN route and would need a new IPC message to the gateway. Whether health is unauthenticated is not verified.
- The Rust host parses events loosely (`serde_json::Value`, checks `kind == "status"`; evidence `apps/desktop` `sidecar.rs:153-155` per the earlier read, path not re-verified here). An additive field is safe there. Other consumers of `sidecarEventSchema`: only `status-publisher`, `sidecar-input/output`, `smoke-sea` and the protocol were found by search; gateway consumers not found, not fully verified.
- Rejected option B (stdin `snapshot` command answered by a stdout event): adds two event/command kinds and a larger stdin parser for little gain over A. The cost of A is that it is push-only; a test cannot ask on demand.
- No REQ governs sidecar event fields beyond REQ-RUNTIME-05 (typed registry and the aggregate `status` events of ADR-006). ADR-006 must be amended in the migration (`docs/architecture/adr/ADR-006-sidecar-status-contract.md`, status `current`).

## Smoke impact

The registry is a claim made by the product. A smoke test that trusts only the claim can hollow-pass. Rule: the event gives the pid list; `ps` proves it.

Deleted:

- `Run.spawnedPids` (`tools/scripts/smoke-sea.ts:143-148`) becomes `Run.children()` from the last status event.
- `Run.spawned` (`tools/scripts/smoke-pg.ts:95`) becomes a children count from events.
- Other `Run.spawnedPids` call sites in `tools/scripts/smoke-sea.ts`: `:290`, `:344`, `:447`, `:560`, `:599`, `:610`, `:652`, `:660`, `:663`, `:666`, `:671`, `:673`. They include the no-spawn asserts (`:599`, `:610`, `:652`) and the restart budget case (`:660-673`).
- The `SPAWNED_PATTERN` imports (`smoke-sea.ts:19`, `smoke-pg.ts:16`) and then the export in `libs/service-registry` (`supervisor-log.ts:9` per the earlier map, not re-read). The `spawnedMessage` operator log stays.
- `smoke-pg.ts:209` `bootFailing` stops using `spawned() == 0` on stderr: exit code 1, zero `children` in events, empty `ps`, ports closed.

Replaced in place:

- `smoke-sea.ts:445` child SIGKILL check asserts: new pid differs from the old one, `restarts == 1`, state returns to `ready`, and `ps` shows the new pid under the supervisor pid.
- `allGone` (`smoke-sea.ts:250`) keeps `process.kill(pid, 0)` but takes the pid list from events and still scans descendants of `run.pid`.

Kept as the independent oracle (no registry involved):

- HTTPS health: `healthState` (`smoke-sea.ts:226`) and the ready wait.
- `identityOf`, `portFree`/`portsFree` (`smoke-sea.ts:238`, `:275`, `:283`).
- `processesUnder` (`verify-platform.ts:57`) and `leftovers` (`e2e-desktop.ts:34`).

Line numbers for the pg, dev and verify helpers come from the earlier helper map and were not re-read: no verificado.

## Migration units

Each unit carries its code and docs. Edit surfaces are disjoint.

| Unit | Edit surface | Depends on | Risk |
| --- | --- | --- | --- |
| U1 contract | `libs/service-registry/src/child-entry.ts` (new), `sidecar-protocol.ts`, `index.ts`; `apps/sea-runtime/src/host/*.port.ts` (new), `apps/sea-runtime/src/supervisor/child-registry.ts` (new, abstract only); ADR-006 amendment; `docs/meta.toon` regeneration | none | item 3: additive field on a `strictObject` event |
| U2 host IO | `apps/sea-runtime/src/host/system-*.ts` and `host.module.ts` (new); `sidecar/**`; `web/**`; `persistence/**`; `runtime/runtime.module.ts`; `main.ts`; `sea-entry.ts`; `supervisor/service-routes-source.ts`, `sea-service-routes.ts` | U1 | item 6 partly: stdout purity and exit codes are covered by the smoke, the asset hash path less so |
| U3 registry and supervisor | `apps/sea-runtime/src/supervisor/**` except the two U2 files and U1's abstract `child-registry.ts`; adds `in-memory-child-registry.ts` | U1 (compiles against abstracts); U2 for the bound `HostProcess` | item 4: rxjs `expand` restart, ordering of registry writes against exit events, shutdown against restart (`supervisor.service.ts:69`, not verified) |
| U4 smoke | `tools/scripts/smoke-sea.ts`, `smoke-pg.ts`, `smoke-dev.ts` (duplicates only), optional `verify-platform.ts` | U1 to write, U3 to run green | item 6: suite can hollow-pass |

Order: U1 alone, then U2 and U3 in parallel, then U4. Final seam check: lint, build, and one `smoke-sea` run. `main.ts` and `sea-entry.ts` keep their argv dispatch and top-level catch outside the container; startup failures happen while the graph is built (`persistence.module.ts:15` comment), so no provider exists to report them. Whether `sea-entry.ts` holds more logic: no verificado.

## Scale

- Memory: one `ChildEntry` per enabled service. Today one service is enabled (REQ-RUNTIME-05 baseline), so the cost is negligible. The same holds at tens of services.
- Event size grows linearly with services and is re-sent on every registry change. A crash loop with backoff emits at most a few events per restart, bounded by the restart policy in `SUPERVISOR_CONFIG`.
- Event ordering: the registry is written in the same event-loop turn as the status change, so one writer keeps order. Late events of an old child are already isolated per child by `takeUntil(exit$)` (`service-lifecycle.ts:81-86`).

## Maintainability

- One owner for child state replaces three places (log, public field, policy closure).
- Cost: five new abstract classes and one module for a runtime of about 500 lines (`wc -l` over `supervisor/` and `sidecar/`). Several abstractions have exactly one implementation. They exist to satisfy the "singleton injectable, abstract token" rule and to give the smoke a typed surface, not for swapping.
- A new service needs no registry change: `ServiceLifecycle` registers itself through the spawner.

## Testability

REQ-TEST-01 allows only app-level and installed-product E2E tests, so the ports are not mocked. Checks are effects on the real binary (REQ-TEST-07, REQ-TEST-04 for lifecycle against the real executable).

Effect checks:

- Each `children[].pid` is a live process in `ps` with `ppid == run.pid` and the supervisor's executable.
- After SIGKILL of a child: new pid in the event, `restarts == 1`, `ps` shows the new pid.
- After stop: the final event has no `ready` child and `ps` shows no descendants.
- Startup failure: exit code 1 and no `children` events.

Mutation list (each must turn the smoke red):

| Break | Expected red |
| --- | --- |
| Spawner registers the supervisor pid instead of `child.pid` | pid-in-`ps` with `ppid == run.pid` check |
| `restarts` never incremented | restarts assertion at `smoke-sea.ts:445` |
| Registry keeps `ready` after child exit or failed budget | `failed` expectation and exit-code check; `restarting` then `ready` at `:445` |
| Publisher keeps aggregate-only dedupe (`status-publisher.ts:32`) | new pid must appear in an event while aggregate stays `ready` |
| Registry not updated on stop | final-event and `ps` check on stop |
| `useClass` for `ChildRegistry` removed | Nest fails at boot, exit 1 |
| `SidecarOutput` writes unvalidated JSON again | stdout-only-valid-events check |
| `HostProcess.execPath` returns a wrong binary | child-same-executable check |
| `children` added to `/api/health` | extend the health check to assert the exact keys; option C stays red |

## Risks

- The registry is a claim, not proof. Mitigation: keep the `ps` oracle (see Smoke impact). If the oracle is dropped later, the suite becomes self-referential.
- Contract change on a `strictObject`: producers and consumers must ship together. Rust host safe by loose parse (path not re-verified); other consumers not verified.
- Concurrency in U3: registry writes against rxjs restart and shutdown ordering are the hard part and need the reviewer's attention.
- Abstract classes with one implementation add ceremony. Whether `ServiceLifecycle`, created per route by `ServiceLifecycleFactory` and not a Nest singleton, satisfies "every service is a singleton injectable" is a human decision, not settled here.
- Keeping the decorator-time `isSea()` ternary in `persistence.module.ts` contradicts the rule in a strict reading. Alternative: one `RuntimeAssetSource` selected through `RuntimeEnvironment`. Not decided.
- Push-only exposure: a late-attaching host sees nothing until the next change unless the supervisor re-emits on attach.

## Not verified

- Bodies of `service-routes-source.ts`, `sea-service-routes.ts`, `sea-entry.ts`, `web-bundle.service.ts` and the `AssetSource` methods.
- Line numbers for the pg, dev, verify and e2e-desktop helpers, and `supervisor-log.ts:9` (from an earlier map, not re-read).
- `apps/desktop` `sidecar.rs:153-155` loose parse (read in an earlier turn, not re-read).
- Gateway consumers of `statusSnapshotSchema` (search found none).
- Whether `/api/health` is unauthenticated.
- The nest-base reference pattern for a registry provider (only `core.module.ts` `useClass` found).
- Windows `taskkill /T /F` behavior (already marked not verified in `process-tree.ts:15`).
