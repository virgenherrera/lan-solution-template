<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-012-sea-runtime-child-registry.md
title: "ADR-012 sea-runtime child registry"
type: architecture
summary: "Compares POCs P1, P2 and P3 for a singleton child registry in sea-runtime and proposes a decision."
ids[0]:
related[4]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/proposals/sea-runtime-P1-registry-status-event.md,docs/architecture/proposals/sea-runtime-P2-per-service-singletons.md,docs/architecture/proposals/sea-runtime-P3-minimal-pid-hook.md
status: current
updated: 2026-11-09
-->

# ADR-012: sea-runtime child registry

[ADR-006](ADR-006-sidecar-status-contract.md) | [P1](../proposals/sea-runtime-P1-registry-status-event.md) | [P2](../proposals/sea-runtime-P2-per-service-singletons.md) | [P3](../proposals/sea-runtime-P3-minimal-pid-hook.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Options](#options)
- [Evidence](#evidence)
- [Criteria table](#criteria-table)
- [Decision](#decision)
- [Consequences](#consequences)
- [Not verified](#not-verified)
- [Implementation status](#implementation-status)

## Status

Accepted in part, 2026-11-05. Stage 1 (P3, the minimal pid hook) is implemented and merged (`3795067`, PR #23). The choice between P1 and P2 (stage 2) is still proposed: the human decides it.

QC done (independent re-run, `poc-qc.toon`). All three POCs pass probes a, b and c and the two consecutive `SIGKILL` edge (restarts reaches 2). The QC's own mutation went red in each POC: P1 `restarts` +1 to +0, P2 `restartTotal` += 1 to += 0, P3 registry keeps the first pid on respawn. `tsc --noEmit` and `pnpm test` exit 0 in each. `pnpm test` only runs the build plus `smoke-sea`, because sea-runtime has no unit suites. The `SIGKILL` victim was the only child (`api-gateway`) in every probe. Prefer the QC numbers over the writers' reports.

## Context

The supervisor in `apps/sea-runtime` keeps child state in several places, and some of it bypasses Nest DI. The human asked three proposals to be built as POCs and compared on these criteria, quoted from the work log: "cual sobrevivio, escala, es mantenible, testeable, implementable y todo eso". The rule they must obey: "cada servicio es un singleton injectable".

The status contract is [ADR-006](ADR-006-sidecar-status-contract.md). The requirements in play:

- REQ-RUNTIME-05: typed registry of enabled services and stdout status events (`docs/requirements/09-desktop-tauri.md:88`, per the proposals QC).
- REQ-TEST-01: no unit or integration suites, only app-level and real E2E (`docs/requirements/11-nx-quality-testing.md:105`). Testability is judged by observable effects of the real binary.
- REQ-TEST-04: the process lifecycle is tested against the real executable (`docs/requirements/11-nx-quality-testing.md:111`).

Each POC was run on the real packaged SEA binary with the same three probes:

- a: the reported pid equals the real child pid from `ps`/`pgrep`.
- b: after `SIGKILL` of the child, a new pid and a restart count appear and the old pid is gone.
- c: after `SIGTERM` of the runtime, the runtime exits 0 and no child remains.

## Options

| Option | Idea | Branch |
| --- | --- | --- |
| P1 | Singleton `ChildRegistry` fed by the spawner, exposed as `children[]` on the stdout status event. HostModule ports are in the proposal. | `poc/sea-P1` |
| P2 | Each service becomes its own generated singleton provider that owns pid and restarts. A stdin `snapshot` command answers with the state. | `poc/sea-P2` |
| P3 | Smallest change: one injectable `ChildRegistry` fed by the spawn hook, with optional `pid` and `restarts` on the existing status event. | `poc/sea-P3` |

## Evidence

Source for every number: the writer report in the scratchpad (`poc-P1.toon`, `poc-P2.toon`, `poc-P3.toon`, field named in each row). Diff sizes were re-checked with `git diff --stat poc/sea-PN~1 poc/sea-PN` and match the reports.

| Item | P1 | P2 | P3 |
| --- | --- | --- | --- |
| Diff (`diff_stat`, re-checked) | 10 files, +92/-8 | 16 files, +234/-141 | 6 files, +46/-3 |
| Probes a, b, c (`probe_a`/`b`/`c`, `probes`) | pass | pass | pass |
| Mutation: hardcoded pid | caught by a (pid 99999) | caught by a (pid 1) | caught by a (pid 1) |
| Mutation: stale first pid | not run | caught only by b (a stays green) | caught only by b (a passes) |
| Event or command surface | `children[]` on the status event | new stdin `snapshot` command and stdout answer | optional `pid` and `restarts` in `statusSnapshotSchema` |
| `pnpm` tests | not run (no-op for sea-runtime) | exit 0 | exit 0 |
| Existing `smoke-sea` | green (`nx package`) | green (`nx build`) | green (`nx build`) |

The stale-pid mutation is the key finding for testing: probe a alone cannot see it. Only the restart probe b does. Any smoke built on this feature needs the kill-and-restart step.

DI bypasses, from the reports (`di_bypasses_removed`, `di_bypasses_left_unfixed`):

- P1 removed: the public `ServiceLifecycle.child` field (readers now use `ChildRegistry.handle`). It removed no process or IO bypass; HostModule was not built.
- P2 removed: `new ServiceLifecycle(...)` in `ServiceLifecycleFactory` (factory deleted), the `LifecycleHooks` callbacks, the public mutable `child` field, and the private lifecycle array in `SupervisorService`. It left `ProcessTree`, `process.execPath` and stderr untouched.
- P3 left unfixed: `child-spawner.ts:20` (`spawn`, `process.execPath`), `child-spawner.ts:27-28` (`process.stderr`), the `process-tree.ts` free functions, `isSea()` in `supervisor.service.ts:2,32`, `service-routes-source.ts:1,7` and `persistence.module.ts:2,26`, `new AppPathsService()` at `persistence.module.ts:11`, and `new ServiceLifecycle` in `service-lifecycle.factory.ts`.

Implementability in disjoint units, from the proposals' "Migration units" sections (not built as units in the POCs):

- P1: four units, U1 contract, then U2 and U3 in parallel, then U4 smoke.
- P2: five units, U1 first, then U2 and U4 in parallel, U3 needs U2, U5 needs U3 and U4.
- P3: four sequential commits, about 120 changed lines forecast by the proposal.

## Criteria table

Ratings are relative among the three and rest on the evidence above. They are not proofs.

| Criterion | P1 | P2 | P3 |
| --- | --- | --- | --- |
| Survived the real binary | Yes. Probes a, b, c pass and the mutation fails. | Yes. Probes pass, both mutations fail. Nest injected runtime-decorated classes inside the rspack SEA bundle. | Yes. Probes pass, both mutations fail. |
| Rule "each service is a singleton injectable" | Partial. One registry singleton, services are still not providers. | Full. One provider per service, generated per route. | Partial. Same as P1, with less structure. |
| DI bypasses removed | One (the public `child` field). | Four, the most of the three. Process and IO bypasses stay. | None. Seven left, listed above. |
| Scales (many services, ordering) | Untested: only `api-gateway` runs. The proposal argues linear growth and one writer for ordering. | Untested: only one service. The proposal admits that service-specific behavior may force a static class per service. | Untested: only one service. Keyed map, linear growth by the proposal. |
| Maintainable | One owner of child state, but five new injectable classes in the proposal for a runtime of about 500 lines, several with one implementation (P1 proposal, Maintainability). | Fewest moving parts after the change (three files deleted), but a dynamic class generator is harder to read, and class names exist only at runtime. | Smallest diff and easy to read. Leaves the old bypasses, so the debt stays. |
| Testable by effects | Yes, if the smoke asserts pids from events. `children[]` was read by the probe from the real stdout. | Yes, through the `snapshot` command. The snapshot comes from the system under test, so truth still relies on `ps` in the probe. | Yes, same as P1. The pid rides on the existing event and needs no new channel. |
| Implementable in disjoint units | Yes on paper (U2 and U3 parallel). | Yes on paper, but the largest cut: 16 files and three deleted modules. | Trivially, but the units are sequential, not parallel. |
| Risk | Additive field on a `strictObject` event (ADR-006 item). Rust host tolerance not checked. | Highest: changes graph build order (`loadServiceRoutes()` before `NestFactory`), command routing by `kind`, new stdin command. Shutdown by stdin command not probed. | Lowest. Adds optional keys to a schema shared with the status endpoint, so the endpoint output changes too. |

## Decision

Stage 1 is done. Stage 2 is proposed and the human decides. The evidence supports a staged path, not a single winner:

1. Take P3 first. It passes the same three probes with the smallest diff (+46/-3 in 6 files) and the lowest risk. It gives the real binary a checkable pid and restart count, which every other option needs as its observable surface.
2. Then choose between P1 and P2 as the next stage, on one question the POCs did not settle: how many services will exist and how much they differ. With one service (`api-gateway`), P2 adds structure without removing a failure mode (P2 proposal, Scale). It is the only option that makes each service a singleton injectable, so it answers the stated rule best. P1 is the smaller step if the rule can be met at registry level.
3. If the human holds "cada servicio es un singleton injectable" as a hard rule for services themselves, P2 is the only option that meets it today, and P3 would be a stepping stone toward it, not an end state.

This staging is a recommendation. It is not verified that P3's registry survives the later move to P2 without rework; see the next step below.

## Consequences

- P3 first costs one extra change if P2 follows, because P2 replaces the spawn-hook registry with per-service state.
- The smoke must assert pids from events or snapshots and include a kill-and-restart step. Without it, a stale pid passes.
- `smoke-sea` and `smoke-pg` no longer parse stderr with `SPAWNED_PATTERN`: they read pids from the `status` event.
- ADR-006 needs an amendment for whichever contract change lands (optional `pid`/`restarts`, `children[]`, or the `snapshot` command).
- Regenerate `docs/meta.toon` after this page is accepted (AGENTS.md write steps).
- `StatusPublisher` emits a status event only when the aggregate state changes. Comparing the whole service list (status, pid, restarts) was tried and dropped: with one service (`api-gateway`) a restart always moves the aggregate state, so the list comparison adds no observable effect. A mutation that compared only the aggregate state turned no smoke check red in two independent reviews. Revisit it when a second service exists and a restart can leave the aggregate unchanged.

## Not verified

- Multi-service behavior, ordering and per-service differences: not exercised by any POC, only `api-gateway` exists.
- Rust host parser tolerance for the new keys or the new stdout kind: not read for P3, not checked for P1, and for P2 only claimed by the QC doc.
- Windows and Linux: probes use `ps`/`pgrep`, macOS arm64 only.
- P1: registry state `exited` has no producer; failed-budget path not probed; no restarting-with-old-pid window.
- P2: stdin `shutdown` command after `kind` routing, budget exhaustion, invalid snapshot line and `requestId` correlation with two requests: not probed.
- P3: the early-return mutation as a separate run (the QC ran a different mutation, first pid kept on respawn), and registry staleness if a spawn path bypasses `ChildSpawner`: not probed.
- Whether the staged path P3 then P1 or P2 reuses P3's code. Next step that would verify it: rebase a P2 spike on `poc/sea-P3` and count how much of the P3 diff survives, then run the three probes and the stale-pid mutation again.
- Effects of the proposals' own claims about maintainability and scale are argued in the proposals, not measured.

## Implementation status

[Back to navigation](#navigation)

Audit of 2026-11-09 against `main` at `cfec959`. The decision text above is kept as the record. This table says what the code does today.

| Decision | Decision status | Implementation | Check | Evidence | Gap |
|---|---|---|---|---|---|
| Stage 1 P3: ChildRegistry fed by spawn hook, pid/restarts | Accepted in part | Implemented | confirmed | `apps/sea-runtime/src/services/in-memory-child-registry.ts:5-18`, `apps/sea-runtime/src/services/child-spawner.ts:28-30`, `apps/sea-runtime/src/services/status-publisher.ts:35-39` | none |
| Stage 2: choose P1 children[] or P2 per-service singletons | Proposed (human decides) | Not implemented | confirmed | `libs/service-registry/src/schemas/sidecar-protocol.ts:8-11`, `apps/sea-runtime/src/services/service-lifecycle.factory.ts:8` | No children[] on the status event and no stdin snapshot command. Services are not per-service singleton providers: the factory creates ServiceLifecycle with new. Stage 2 is undecided. |
| Smoke reads pids from events, includes kill-and-restart | Accepted in part | Implemented | confirmed | `tools/scripts/smoke-sea.ts:155-173`, `tools/scripts/smoke-pg.ts:110-112` | none |
| StatusPublisher emits only on aggregate state change | Accepted in part | Implemented | single source | `apps/sea-runtime/src/services/status-publisher.ts:34` | none |
| ADR-006 amended for optional pid/restarts | Accepted in part | Implemented | confirmed | `docs/architecture/adr/ADR-006-sidecar-status-contract.md:85` | none |
| Regenerate docs/meta.toon after acceptance | Accepted in part | Implemented | confirmed | `docs/meta.toon:101` | none |
