<!-- toon-meta
fmt: TOON
doc: docs/architecture/proposals/sea-runtime-P3-minimal-pid-hook.md
title: "Proposal P3 sea-runtime minimal child registry"
type: architecture
summary: "Smallest sea-runtime change: one injectable ChildRegistry fed by the spawn hook, with pid added to the status event."
ids[0]:
related[3]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/proposals/sea-runtime-P1-registry-status-event.md,docs/architecture/proposals/sea-runtime-P2-per-service-singletons.md
status: proposed
updated: 2026-11-05
-->

# Proposal P3: minimal child registry fed by the spawn hook

Scope: `apps/sea-runtime/src`. Siblings: P1 and P2 (paths in the metadata block; see [Not verified](#not-verified)). P3 is the floor of the three: it changes the least and fixes the least.

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

Human rules this proposal is judged against:

1. Every service is a singleton injectable.
2. An abstract class is the token; `useClass` appears in the module only.
3. A blackbox smoke asserts effects, not logs.

Facts, all read from the current tree:

- The pid exists in one place and is only logged: `apps/sea-runtime/src/supervisor/child-spawner.ts:20` creates the child, `:29` logs `spawnedMessage(route.id, child.pid)`. Nothing stores it.
- No typed registry exists. The only collection of services is the private array `ServiceLifecycle[]` at `apps/sea-runtime/src/supervisor/supervisor.service.ts:17`. [REQ-RUNTIME-05](../../requirements/09-desktop-tauri.md) asks for "a typed registry of enabled services".
- The restart count exists only inside `RestartPolicy.restarts` (`apps/sea-runtime/src/supervisor/service-lifecycle.ts:13-16`), computed in `planRestart` (`:35-41`) and never exposed.
- The child handle is a public field of `ServiceLifecycle` (`service-lifecycle.ts:47`, assigned at `:79`). `StatusPublisher` reads it to send IPC state (`apps/sea-runtime/src/supervisor/status-publisher.ts:37-39`).
- The status event carries `id` and `status` only: `status-publisher.ts:35` and `libs/service-registry/src/status-snapshot.ts:10`. The event schema is strict (`libs/service-registry/src/sidecar-protocol.ts:14`).
- Consequence for the smoke: `tools/scripts/smoke-sea.ts:143-146` recovers pids by matching `SPAWNED_PATTERN` on stderr lines. That is a log-derived assertion, against rule 3.
- Already Nest-native: `Clock`, `Random`, `ServiceRoutes` use an abstract class plus `useClass` in `apps/sea-runtime/src/supervisor/supervisor.module.ts:19-21`.
- DI bypasses that P3 does not touch:
  - `spawn`, `process.execPath`, `process.stderr` in `child-spawner.ts:20,27,28`.
  - Free functions with `spawn taskkill`, `process.kill`, `Date.now` in `apps/sea-runtime/src/supervisor/process-tree.ts` (the `stopTree` and `treeSpawnOptions` exports are imported as functions at `supervisor.service.ts:10` and `child-spawner.ts:7`).
  - `isSea()` global at `supervisor.service.ts:2,32`, `apps/sea-runtime/src/supervisor/service-routes-source.ts:1,7`, `apps/sea-runtime/src/persistence/persistence.module.ts:2,26`.
  - `new AppPathsService()` at module scope, `persistence.module.ts:11`.
  - `ServiceLifecycle` is built by a factory with `new`, not resolved by Nest (`apps/sea-runtime/src/supervisor/service-lifecycle.factory.ts`, body not re-read for this document: no verificado beyond the module line).

## Design

[Back to navigation](#navigation)

Idea: the spawn hook already runs once per child, on every restart (`child-spawner.ts:9` comment, `service-lifecycle.ts:78`). Record there. Publish from there.

### Provider map

| Token | Kind | Binding | Change |
| --- | --- | --- | --- |
| `ChildRegistry` | abstract class, NEW | `{ provide: ChildRegistry, useClass: InMemoryChildRegistry }` in `SupervisorModule` | records one `ChildEntry` per service |
| `InMemoryChildRegistry` | injectable, NEW | `useClass` target only | `Map<string, ChildEntry>` |
| `ChildSpawner` | injectable, exists | plain provider (`supervisor.module.ts:23`) | calls `registry.recordSpawn(id, pid)` after `spawn` |
| `StatusPublisher` | injectable, exists | plain provider (`:24`) | reads `registry.snapshot()` and adds `pid` to the event |
| `ServiceLifecycleFactory`, `SupervisorService`, `Clock`, `Random`, `ServiceRoutes` | exists | unchanged | none |

Rule 1: `InMemoryChildRegistry` is a normal Nest singleton. Rule 2: the module is the only place that names `InMemoryChildRegistry`; consumers inject `ChildRegistry`.

### TypeScript contract

```ts
// apps/sea-runtime/src/supervisor/child-registry.ts
export interface ChildEntry {
  readonly id: string;
  readonly pid: number;      // pid of the current child
  readonly restarts: number; // spawns after the first, since process start
}

export abstract class ChildRegistry {
  // Called by ChildSpawner once per spawn, restarts included. A pid-less spawn (spawn failure) is not recorded.
  abstract recordSpawn(id: string, pid: number): void;
  abstract entries(): readonly ChildEntry[];
}
```

`restarts` here is a monotonic spawn counter, not the windowed `RestartPolicy.restarts` of `service-lifecycle.ts:15`. The two differ on purpose: the registry answers "how many times did this service spawn", the policy answers "may it spawn again". Naming the second one in the event would be a trap.

### Event change

`statusSnapshotSchema.services[]` gains an optional `pid` (`z.number().int().positive().optional()`). `StatusPublisher.publish` (`status-publisher.ts:35`) maps `{ id, status, pid }` from the registry. The field is optional, so an older host that ignores unknown keys keeps working. The schema is strict at the event level, so the host side must accept the new key: the Rust parser is not read here (`apps/**/sidecar.rs` is no verificado).

One existing behaviour to keep in view: `publish` returns early when the aggregate state is unchanged (`status-publisher.ts:32`). A restart that keeps the aggregate state would not re-emit the event, so a new pid would not reach the host. Two ways out; P3 picks the first:

1. Compare the serialized `services` list, not only `state`, before returning. One line.
2. Leave as is and document that pid is fresh only on aggregate change.

## Exposure and security

[Back to navigation](#navigation)

- The pid leaves the process over the sidecar stdout channel only (ADR-006: stdout is the host contract). No new listener, no HTTP route.
- A pid is not a secret, and it already appears in stderr via `spawnedMessage`. The new exposure is to the host UI and to anything that reads sidecar stdout.
- The registry holds no handle. It cannot be used to signal a process. The `ChildProcess` stays in `ServiceLifecycle`.
- Contract change: adding an optional key to a consumed event is a change to a contract others consume. It is additive; the strict schema on the Rust side is the unknown.

## Smoke impact

[Back to navigation](#navigation)

- `smoke-sea.ts:143-146` (`spawnedPids`) can read `pid` from the parsed status events instead of matching stderr lines. The smoke already parses events with `sidecarEventSchema` (`smoke-sea.ts:19`).
- Other `spawnedPids` call sites in `smoke-sea.ts`: `:290`, `:344`, `:447`, `:560`, `:599`, `:610`, `:652`, `:660`, `:663`, `:666`, `:671`, `:673`. They include the no-spawn asserts (`:599`, `:610`, `:652`) and the restart budget case (`:660-673`). The checks at `:447` and `:660-666` would also need the pid from events.
- That removes the log dependency for pids. It does not remove the other log-derived helpers (`Run.has`, `Run.spawned`, `bootFailing` in `smoke-pg.ts`; `stoppedGateway` in `smoke-dev.ts`). Those need typed failure events, which P3 does not add.
- `verify-platform.ts` `processesUnder` (`ps` filtered by install dir) could cross-check against event pids. Optional, not part of P3.

## Migration units

[Back to navigation](#navigation)

Each unit is one commit, with the behaviour it needs. Order matters.

1. `ChildRegistry` abstract class, `InMemoryChildRegistry`, module binding. No consumer yet. About 40 lines.
2. `ChildSpawner` records the spawn. `restarts` derives from the count of prior records for the id. About 15 lines.
3. Schema: optional `pid` in `statusSnapshotSchema`. `StatusPublisher` fills it and compares the services list before the early return. Docs: ADR-006 contract text. About 30 lines.
4. `smoke-sea.ts` reads pids from events and asserts them. Removes the `SPAWNED_PATTERN` dependency for pids. About 30 lines.

Total forecast: about 120 changed lines, under the 400-line slice heuristic. No unit touches a module that P1 or P2 would restructure beyond `supervisor.module.ts`, where all three proposals add providers (merge-conflict spot).

## Scale

[Back to navigation](#navigation)

- Cost: one `Map` write per spawn. Spawns are bounded by the restart policy (`SUPERVISOR_CONFIG.maxRestarts`), so the write rate is tiny.
- Event size grows by one integer per service. The event fires on state change, not on a timer.
- Services: the registry is keyed by id. It scales with the number of enabled services exactly as the existing array does.
- Horizontal scale does not apply: one supervisor per host.

## Maintainability

[Back to navigation](#navigation)

For:

- Smallest diff of the three proposals. The module layout, `ServiceLifecycle` and `LifecycleHooks` stay as they are.
- Closes the REQ-RUNTIME-05 gap "typed registry" for pid and restarts.
- Follows rules 1 and 2 for the one new provider.

Against:

- A second source of truth for restarts (registry counter vs windowed policy). Names must stay distinct.
- `ChildSpawner` gains one more collaborator and one more job (spawn and record). It is still one reason to change: "a child started".
- The registry is fed by a side effect, not by the lifecycle that owns the child. If a future spawn path skips `ChildSpawner`, the registry silently goes stale.

## Testability

[Back to navigation](#navigation)

[REQ-TEST-01](../../requirements/11-nx-quality-testing.md) forbids unit and integration suites. Checks are blackbox, against the real executable ([REQ-TEST-04](../../requirements/11-nx-quality-testing.md) for the app level). Each check asserts an effect:

| Effect | How it is observed |
| --- | --- |
| The event pid is a live process | read `pid` from the status event; `process.kill(pid, 0)` succeeds (`smoke-sea.ts:167` `alive`) |
| The event pid is the service binary | `identityOf(pid)` (`smoke-sea.ts:238`) matches the installed executable |
| After a kill, a new pid appears and differs | kill the child; wait for an event whose `pid` differs; old pid is gone |
| Shutdown leaves no pid alive | after the shutdown command, `allGone(pids)` (`smoke-sea.ts:250`) |
| Restart count grows with each kill | kill twice; the event reports `restarts` of 2 (if exposed; see Risks) |

Mutation list. Each mutation must turn at least one check red:

1. `recordSpawn` is not called on restart: the pid after a kill stays old.
2. `recordSpawn` stores `child.pid` of the first spawn only.
3. The registry writes the wrong id (swapped keys).
4. `StatusPublisher` drops `pid` from the event.
5. The early return keeps comparing `state` only: a restart with an unchanged aggregate emits nothing.
6. `restarts` resets on each spawn.

Mutation 5 is the one a log-based smoke would never catch; it needs the event-based check.

## Risks

[Back to navigation](#navigation)

- What P3 leaves unfixed, honestly:
  - Every DI bypass listed in [Problem](#problem) stays: `process.*` and `spawn` in `ChildSpawner`, free functions in `process-tree.ts`, the `isSea()` global in three files, `new AppPathsService()` at module scope, `new`-built `ServiceLifecycle`. Rule 3 is satisfied for pids only.
  - The child handle stays public on `ServiceLifecycle`. The registry does not replace it.
  - Startup failures before the Nest graph exists (`main.ts`, `sea-entry.ts`) stay outside any provider; that boundary is irreducible in all three proposals.
- Why it may be acceptable: the pid and restart gap is the only one that blocks a blackbox effect assertion today. The other bypasses hurt in-process substitution. [REQ-TEST-01](../../requirements/11-nx-quality-testing.md) already rules out in-process suites, so the cost of those bypasses is paid in elegance and rule 2 compliance, not in test power.
- Why it may not be acceptable: the human rules say every service is an injectable and the token is an abstract class. Leaving `isSea()` and `process.*` in code paths breaks that rule's intent. P3 passes the letter for one new provider and fails the spirit for the module as a whole. If the rule is a goal and not a per-provider check, P1 or P2 is needed anyway, and P3 becomes unit 1 of them.
- Stale registry if a spawn path bypasses `ChildSpawner`.
- Event contract: strict schema on the host side may reject the new key.
- Two meanings of "restarts" (monotonic vs windowed). Mitigated by naming; not removed.

## Not verified

[Back to navigation](#navigation)

- The Rust sidecar parser tolerates the extra `pid` and `restarts` keys: verified, `sidecar.rs:153` parses a loose `serde_json::Value` and reads only `kind` and `state`.
- `service-lifecycle.factory.ts` and `service-routes-source.ts` bodies: only the lines cited above were read; no claim is made beyond them.
- `sea-entry.ts` and `main.ts` content beyond the boundary role: no verificado.
- Whether `docs/meta.toon` regeneration and the metadata check pass for this file: not run, by instruction.
