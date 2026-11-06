<!-- toon-meta
fmt: TOON
doc: docs/backlog/nest-standalone-refactor.md
title: "Epic: Nest standalone refactor"
type: backlog
summary: "Proposed pure-refactor epic: exit code constants, Nest Logger, unified DeclaredServices, dead code cleanup and folder reorganization, in five ordered slices."
ids[0]:
related[5]: docs/backlog/README.md,docs/backlog/nest-standalone-cleanup-inventory.md,docs/architecture/adr/ADR-013-nest-standalone-architecture.md,docs/architecture/declared-services.md,docs/architecture/nest-standalone-boot.md
status: proposed
updated: 2026-11-06
-->

# Epic: Nest standalone refactor

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Rules for every slice](#rules-for-every-slice)
- [Slice order](#slice-order)
- [Slice 1: EXIT_CODE constants](#slice-1-exit_code-constants)
- [Slice 2: Nest Logger](#slice-2-nest-logger)
- [Slice 3: Unified DeclaredServices with pre and post](#slice-3-unified-declaredservices-with-pre-and-post)
- [Slice 4: Dead code cleanup](#slice-4-dead-code-cleanup)
- [Slice 5: Folder reorganization](#slice-5-folder-reorganization)
- [Out of scope](#out-of-scope)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Proposed. Nothing is built. The branch `docs/nest-standalone-refactor` carries documentation only. |
| Appetite | none decided. Each slice is estimated under about 400 changed lines. |
| Depends on | [ADR-013](../architecture/adr/ADR-013-nest-standalone-architecture.md) (proposed), [DeclaredServices](../architecture/declared-services.md) and [Nest standalone boot](../architecture/nest-standalone-boot.md) |
| Requirements | none. No REQ or AC id exists for this epic and none is invented here. |
| Nature | Pure refactor. Behavior, output bytes and exit codes do not change. |
| Related | [Cleanup inventory](nest-standalone-cleanup-inventory.md), [Technical debt: Nest DI by class](td-nest-di-by-class.md) |

---

## Rules for every slice

[Back to navigation](#navigation)

- A slice starts only when the human says so, and only on its own branch (see `AGENTS.md`).
- Acceptance is the same for every slice: `pnpm test` and the real-binary smoke `smoke-sea` pass with no change to any test or smoke file. If a slice needs a test edit, the slice changed behavior and is wrong.
- Every file is generated with its official CLI where one exists. Hand edits are listed in the slice result.
- Generators may create `*.spec.ts` files. The slice deletes them in the same commit.
- The file surfaces below come from the mapping reports. They are reported by mapping, not verified by the author of this page.
- The Risk line uses the item numbers of the high-risk list in the orchestrator rules: 1 data, 2 security, 3 contracts others consume, 4 concurrency, 5 delivery or environment, 6 no test would catch a regression.

---

## Slice order

[Back to navigation](#navigation)

| Order | Slice | Why it sits here | Estimated size |
|---|---|---|---|
| 1 | EXIT_CODE constants | Mechanical, no design, shrinks the diff of later slices | under 150 lines |
| 2 | Nest Logger | Needs the constants of slice 1 for the failure paths | 250 to 400 lines |
| 3 | Unified DeclaredServices with pre and post | Largest design change. Split into 3a and 3b | 3a under 350, 3b under 250 |
| 4 | Dead code cleanup | Safe after slice 3 settles which model types stay | under 60 lines |
| 5 | Folder reorganization | Moves files last so earlier diffs stay readable | under 400 lines, mostly moves |

---

## Slice 1: EXIT_CODE constants

[Back to navigation](#navigation)

**Objective.** Replace the magic numbers of `process.exit` and `process.exitCode` with a named `EXIT_CODE` constant contract. The numeric values do not change.

**File surface** (reported by mapping: 26 `process.exit` calls and 1 `process.exitCode` assignment).

- Runtime: `apps/sea-runtime/src/supervisor/supervisor.service.ts` (line 84), `apps/sea-runtime/src/sea-entry.ts` (lines 12 and 17), `apps/sea-runtime/src/main.ts` (line 20), `apps/api-gateway/src/main.ts` (lines 16 and 51).
- Scripts under `tools/scripts/`: `smoke-pg.ts`, `test-filter.ts`, `version-check.ts`, `smoke-sea.ts`, `pack-migrations.ts`, `smoke-dev.ts`, `db-parity.ts`, `compile-sea.ts`, `generate-certs.ts`, `e2e-desktop.ts`, `verify-platform.ts`, `trust-ca.ts`, `branch-name.ts`.
- New: one constants file. The location is proposed, not decided: `libs/shared-core/src/constants/exit-code.ts`.
- Existing config values `DISPATCHER_CONFIG.rejectExitCode` and `SUPERVISOR_CONFIG.errorExitCode` are exit values too. The slice decides whether they point at `EXIT_CODE` (not verified).

**Acceptance.** `pnpm test` and `smoke-sea` pass with no test edit. A search for a numeric literal as the argument of `process.exit` over `apps`, `libs` and `tools` returns nothing. The mapped observable exits keep their values: gateway startup failure and supervisor startup failure exit 1, a rejected argument exits 2, a clean shutdown exits 0.

**Risk.** none. The values are unchanged and the mapped observable exits are asserted by smokes. Several exit paths are asserted only by a smoke run, so the slice runs `smoke-sea`, `smoke-dev` and `smoke-pg` evidence where the environment allows (not verified).

**Estimated size.** under 150 changed lines.

---

## Slice 2: Nest Logger

[Back to navigation](#navigation)

**Objective.** Use only the Nest `Logger`, inside and outside the Nest context. Outside the context the entry points use `new Logger(Name)`. Zero `console.*` and zero direct `process.stdout` or `process.stderr` writes for logs. The decisions are in [ADR-013](../architecture/adr/ADR-013-nest-standalone-architecture.md).

**Design.**

- A subclass of Nest `ConsoleLogger` that writes every level to stderr. Mapping reports that `ConsoleLogger` writes `log`, `warn`, `debug` and `verbose` to stdout and only `error` and `fatal` to stderr. That claim is **not verified**; the slice proves it first.
- The subclass reproduces the current stderr line `[id] text` (`libs/service-registry/src/supervisor-log.ts`, line 5, reported). Mapping found no smoke that asserts the prefix, so the line stays a contract until the slice proves otherwise.
- stdout is a machine contract (sidecar status events, [ADR-006](../architecture/adr/ADR-006-sidecar-status-contract.md)). It carries no logs and its bytes do not change. `sidecar-output.ts` writes status events, not logs, so it keeps a plain stdout writer.
- A short injection decorator, proposed and modeled on `InjectConfig`. The decorator does not exist in the reference repository `nest-base` (reported). The proposed location is `libs/shared-core/src/logger/`.
- `SupervisorLogger` (`apps/sea-runtime/src/sidecar/supervisor-logger.ts`) is absorbed by the Nest `Logger` only if the emitted lines stay byte-identical.
- All code depends on the Nest `LoggerService` interface. This is the seam for the later epic named in [Out of scope](#out-of-scope).

**File surface** (reported by mapping: 68 `console.*` calls in total).

- Runtime: `apps/sea-runtime/src/main.ts`, `apps/sea-runtime/src/sea-entry.ts`, `apps/sea-runtime/src/sidecar/supervisor-logger.ts`, `apps/sea-runtime/src/sidecar/sidecar-output.ts`, `apps/api-gateway/src/main.ts`, `apps/api-gateway/src/app.bootstrap.ts`, `libs/shared-core/src/tls/certs-command.ts`.
- Injection sites of `SupervisorLogger` (reported): `supervisor.service.ts` (line 27), `status-publisher.ts` (line 22), `child-spawner.ts` (line 15), `web-bundle.service.ts` (line 12), `sidecar-input.ts` (line 11), `persistence.service.ts` (line 21).
- Open decision, not in the slice until the human decides: the calls reported in `tools/scripts/*.ts` are command-line output for a person at a terminal, not runtime logs, and `apps/web-angular/src/main.ts` runs in the browser where the Nest `Logger` does not apply (not verified). The recommendation is to leave both out of this slice.

**Acceptance.** `pnpm test` and `smoke-sea` pass with no test edit. Under `apps/sea-runtime`, `apps/api-gateway` and `libs`, a search for `console.` and for `process.stdout.write` outside the status-event writer returns nothing. A captured run shows the stderr lines identical to the lines before the slice, and stdout holds only status events.

**Risk.** item 3 (the stderr line format and the stdout event stream are read by the Tauri host, see [ADR-009](../architecture/adr/ADR-009-desktop-process-model.md), and by the smokes).

**Estimated size.** 250 to 400 changed lines. If it passes 400, split the runtime entry points from the supervisor classes.

---

## Slice 3: Unified DeclaredServices with pre and post

[Back to navigation](#navigation)

**Objective.** One model replaces `ServiceRoute` and the `ServiceDefinition` family. The export is `export const SERVICES: DeclaredServices = [...]`. `DeclaredService` is the element type and `DeclaredServices` is the readonly collection type. The design is in [DeclaredServices](../architecture/declared-services.md) and the boot order is in [Nest standalone boot](../architecture/nest-standalone-boot.md).

Split in two commits so each stays reviewable.

**Slice 3a: unify the model.**

- The `id` property is dropped as an input. The name is derived from the path with `path.parse(path).base`.
- Validation stays internal and runtime: a zod schema with `superRefine` for unique names, unknown `dependsOn` and startup cycles, the same checks `routesSchema` makes today.
- The assembler and the supervisor read the same constant.
- File surface (reported by mapping): `libs/service-registry/src/service-routes.ts`, `service-definition.ts`, `startup-order.ts`, `dispatcher.ts`, `apps/sea-runtime/src/services.ts`, `apps/sea-runtime/src/supervisor/service-routes-source.ts`, `child-spawner.ts`, `supervisor.service.ts`, `apps/sea-runtime/src/sea-entry.ts`, `tools/scripts/compile-sea.ts` (lines 276, 283, 467, 485).
- Open decision from the design page: today `defineServices` checks `dependsOn` against declared ids at compile time. A plain typed array loses that check. The options and the recommendation live in [DeclaredServices](../architecture/declared-services.md).
- The `ServiceDefinition` family is removed only after the [inventory](nest-standalone-cleanup-inventory.md) rows reach QC status `confirmed`. `ServiceDefinition` is still used as a `Pick` type in `startup-order.ts` (reported), so it is not dead today.

**Slice 3b: optional pre and post routines.**

- A service may declare a `pre` routine, run by the supervisor before the spawn, and a `post` routine, run after the child exits for any reason. A failing `pre` means the service does not start and the aggregate state is `failed`. A failing `post` is logged and never thrown. Each hook has a timeout with a default. The default values are proposed in the design page.
- A service that declares no hook behaves exactly as today.
- File surface: `apps/sea-runtime/src/supervisor/service-lifecycle.ts` and `supervisor.service.ts` (reported lines 108 to 117 for the restart path).

**Acceptance.** `pnpm test` and `smoke-sea` pass with no test edit. The `services.json` asset produced by `compile-sea.ts` is byte-identical before and after slice 3a for the current service list. A search for a declared `id` input over `apps` and `libs` returns nothing. For 3b, a run with no hook declared produces the same state events as before.

**Risk.** item 3 (the `services.json` asset and the dispatcher argument contract are consumed at runtime) and item 4 for 3b (hooks add async ordering in the supervisor).

**Estimated size.** 3a under 350 changed lines, 3b under 250.

---

## Slice 4: Dead code cleanup

[Back to navigation](#navigation)

**Objective.** Delete code with zero references, each row confirmed by the QC step of the [cleanup inventory](nest-standalone-cleanup-inventory.md).

**Scope.** Confirmed dead by mapping, zero references in source, tests, tools and non-TypeScript files: `ControlMessage` and `StatusSnapshot`. Every other symbol is `verify` or `keep` until its QC status is `confirmed`. The inventory explains why barrels hide usage.

**File surface.** `libs/service-registry/src/control-channel.ts` (line 25) and `libs/service-registry/src/status-snapshot.ts` (line 13), plus the barrel `libs/service-registry/src/index.ts` if it re-exports them (not verified).

**Acceptance.** `pnpm test` and `smoke-sea` pass with no test edit. A search for each deleted symbol over the whole repository returns nothing. If removing a symbol needs a test edit, it was not dead and stays.

**Risk.** none for the two confirmed symbols. Any later row added to this slice is re-assessed against item 3, because a barrel export counts as a published export.

**Estimated size.** under 60 changed lines.

---

## Slice 5: Folder reorganization

[Back to navigation](#navigation)

**Objective.** Group files by role: `interfaces/`, `schemas/`, `services/`, `modules/` and `constants/`. A constant goes to a `constants/` path. A collection export is plural and is never typed with `[]` at the use site.

**File surface.** The exact move list is derived from the conventions mapping at slice start. It is **not verified** here. Known sensitive points (reported): the barrels `libs/service-registry/src/index.ts` and `libs/shared-core/src/index.ts`, the alias in `sea-modules.d.ts`, and the paths read by `tools/scripts/compile-sea.ts`.

**Acceptance.** `pnpm test` and `smoke-sea` pass with no test edit. The SEA build resolves every module. The move is done with `git mv` so history follows the files, and no file changes content other than its import paths.

**Risk.** item 3 (barrels and the SEA alias are consumed by other packages and by the build).

**Estimated size.** under 400 changed lines, mostly renames and import paths. If it passes 400, split by library.

---

## Out of scope

[Back to navigation](#navigation)

- A logging library that implements `LoggerService` for the application factory, with OpenTelemetry log records, RxJS pipes, an asynchronous file sink and a logging child process. It is a later epic and links to [Log service with OpenTelemetry data model and gRPC](log-service-otel-grpc.md). This epic only keeps the seam open.
- Logging as a service in the startup order. Logging is not a service.
- Any change to TLS certificate creation. Certificates are created at install time and the gateway only reads them.
- Any new feature, new requirement or change to a test or smoke.

---

## Not verified

[Back to navigation](#navigation)

- All file and line references are reported by mapping and were not re-checked by the author of this page.
- That `ConsoleLogger` writes four levels to stdout and two to stderr.
- That `ServiceDefinition`, `serviceRegistrySchema`, `ServiceRegistry` and the `entry` field have no reader. Mapping reports it; the QC step verifies it.
- Whether `tools/scripts` output and the browser entry belong in slice 2.
- The location of the constants file, the logger decorator and `DeclaredServices`.
- Slice sizes are estimates, not counts.
