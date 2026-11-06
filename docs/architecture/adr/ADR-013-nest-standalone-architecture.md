<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-013-nest-standalone-architecture.md
title: "ADR-013 Nest standalone architecture"
type: architecture
summary: "Target architecture of the Nest standalone refactor: one Nest Logger, stdout contract, EXIT_CODE constants, folder conventions, boot order."
ids[0]:
related[9]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-012-sea-runtime-child-registry.md,docs/architecture/declared-services.md,docs/architecture/nest-standalone-boot.md,docs/backlog/nest-standalone-refactor.md,docs/backlog/nest-standalone-cleanup-inventory.md,docs/backlog/log-service-otel-grpc.md
status: proposed
updated: 2026-11-06
-->

# ADR-013: Nest standalone architecture

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-006](ADR-006-sidecar-status-contract.md) | [ADR-007](ADR-007-persistence-system.md) | [ADR-008](ADR-008-tls-trust-model.md) | [ADR-012](ADR-012-sea-runtime-child-registry.md) | [Declared services](../declared-services.md) | [Nest standalone boot](../nest-standalone-boot.md) | [Epic](../../backlog/nest-standalone-refactor.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Decision](#decision)
- [Options rejected](#options-rejected)
- [Consequences](#consequences)
- [Risks](#risks)
- [Not verified](#not-verified)

## Status

Proposed, 2026-11-06. Documentation only. No file under `apps/`, `libs/` or `tools/` changes with this ADR. This ADR is the governing document of the refactor. Three pages detail it:

- [Declared services](../declared-services.md): the single service model, the derived name and the optional pre and post routines.
- [Nest standalone boot](../nest-standalone-boot.md): the boot order, with diagrams.
- [Epic](../../backlog/nest-standalone-refactor.md): the slices. [Cleanup inventory](../../backlog/nest-standalone-cleanup-inventory.md): the dead code candidates.

Each decision below carries its origin:

- **Human**: the human decided it in the planning conversation of the branch `docs/nest-standalone-refactor`.
- **Agent**: the agent proposes it. The human has not reviewed it. It becomes accepted when the human says so.

Every claim taken from a code map is marked "reported by mapping, not verified". The mapping reports are agent output. No one re-read the cited lines for this ADR.

## Context

The supervisor and the services run as Nest applications inside one SEA binary ([ADR-002](ADR-002-single-sea-portability.md), [ADR-012](ADR-012-sea-runtime-child-registry.md)). The sidecar speaks to the host through the four channels of [ADR-006](ADR-006-sidecar-status-contract.md). Some parts of the code still sit outside the Nest container or use ad hoc output. Evidence below is reported by mapping, not verified:

- Logging. The mapping found 68 `console.*` calls and 27 `process.exit` hits (26 real calls, one `exitCode` assignment) under `apps/`, `libs/` and `tools/`. Examples: `apps/sea-runtime/src/sidecar/sidecar-output.ts:8` (stdout, machine events), `apps/sea-runtime/src/main.ts:19` (stderr, `startup failed`), `apps/sea-runtime/src/sea-entry.ts:11-17` (stderr and exit). Exit calls in service code: `apps/sea-runtime/src/supervisor/supervisor.service.ts:84`, `apps/api-gateway/src/main.ts:16` and `:51`.
- Stderr format. `libs/service-registry/src/supervisor-log.ts:5` builds `[id] text`. The mapping found no smoke that asserts the prefix. The comment in that file says a real-binary smoke reads the lines back. Which statement is right is not verified.
- Logger injection. `SupervisorLogger` is injected in six places (`supervisor.service.ts:27`, `status-publisher.ts:22`, `child-spawner.ts:15`, `web-bundle.service.ts:12`, `sidecar-input.ts:11`, `persistence.service.ts:21`), reported by mapping, not verified.
- Console streams. The mapping read `console-logger.service.js:95-148` of `@nestjs/common` 12.3.2 and reports that `log`, `warn`, `debug` and `verbose` go to stdout, and only `error` and `fatal` go to stderr. The mapping also reports that the top-level link of `@nestjs/common` was not found in this repository, so the linked version is not verified.
- Service model. The mapping reports that `ServiceDefinition`, `serviceDefinitionSchema`, `serviceRegistrySchema` and `ServiceRegistry` have no code reader outside their own file, and that two types, `ServiceRoute` and `ServiceDefinition`, describe the same thing. `ControlMessage` and `StatusSnapshot` are reported with zero references. The cleanup inventory in the [epic](../../backlog/nest-standalone-cleanup-inventory.md) holds each row with its evidence and a QC status.
- Reference style. The sibling repository `nest-base` uses `new Logger(Name)` outside the container (`src/main.ts:5`, first use `:28`), the decorator `InjectConfig` (`src/core/config/inject-config.decorator.ts:4`) and `AppConfigModule`. It has no Logger injection decorator. It does not have the folders `interfaces/`, `schemas/`, `services/`, `modules/`, `constants/`. Reported by mapping, not verified.

## Decision

### D1. A true Nest standalone application (Human)

Every process of the binary is a Nest application created with `NestFactory.createApplicationContext`. No singleton is wired by hand outside the DI container. A value shared across the application is a provider. Configuration is read from the already validated config singleton through `AppConfigModule` and `InjectConfig`, as in `nest-base`.

Traces to: `nest_rules` (standalone app, provider singleton, config singleton).

### D2. One logger: the Nest Logger (Human)

All human-readable output uses the Nest `Logger`. Inside the container the class receives it through DI. Outside the container (entrypoints before the context exists) code uses `new Logger(Name)`, as `nest-base` does at `src/main.ts:5`. The code makes zero `console.*` calls and zero direct writes to `process.stdout` or `process.stderr` for logs.

Traces to: `logging_decisions[0]`.

### D3. stdout is a machine contract and carries no logs (Human)

stdout carries the status events of [ADR-006](ADR-006-sidecar-status-contract.md) and the control messages. It never carries a log line, and the bytes of those events do not change. The writer of those events (`sidecar-output.ts`) is the one place that may write to stdout. It is not a log writer.

Traces to: `logging_decisions[1]`.

### D4. The application logger sends every level to stderr (Agent)

The Nest `ConsoleLogger` writes `log`, `warn`, `debug` and `verbose` to stdout (reported by mapping, not verified; see the Context). Under D3 that would put log lines on the machine channel. The application logger is therefore a subclass of `ConsoleLogger` that routes every level to stderr. It is installed with `app.useLogger` in each context and as the static logger before the context exists, so one writer serves both cases.

Traces to: `logging_decisions[2]`.

### D5. The stderr line format stays `[id] text` until proven otherwise (Agent)

The mapping found no assertion on the prefix, but [ADR-006](ADR-006-sidecar-status-contract.md) names `[id] text` as the stderr contract and the host forwards stderr to its log ([ADR-009](ADR-009-desktop-process-model.md)). The format is treated as a contract. The subclass of D4 reproduces it, including `[supervisor] text` for the supervisor and the service prefix for child output. The code phase may change the format only after it proves, with a read of the consumers, that nothing depends on it, and the change then needs a new ADR.

Traces to: `logging_decisions[3]`.

### D6. A short Logger decorator, proposed (Agent)

`nest-base` has no Logger decorator. This ADR proposes one, modeled on `InjectConfig`, so a class asks for the logger of its own name without `new Logger(...)`. Proposed location: `libs/shared-core/src/decorators/inject-logger.decorator.ts`. The name and the path are proposals, not verified against the library layout.

Traces to: `logging_decisions[4]`, `open_for_doc[1]`.

### D7. SupervisorLogger folds into the Nest Logger only if the lines stay identical (Agent)

`SupervisorLogger` (`apps/sea-runtime/src/sidecar/supervisor-logger.ts`) is absorbed by the Nest `Logger` through D4 and D6 only when the emitted stderr lines are byte-identical for the same events, including the `spawned service id as pid N` and `state X` lines of `supervisor-log.ts:7-8`. The code phase checks this with a before and after capture. If one line differs, the class stays.

Traces to: `logging_decisions[5]`.

### D8. Exit codes are named constants (Agent)

The magic numbers of `process.exit` and `process.exitCode` are replaced by one constant contract, `EXIT_CODE`, in a `constants/` path. The numeric values do not change: `0`, `1` and `2` stay as [ADR-006](ADR-006-sidecar-status-contract.md) defines them. The mapping lists 26 `process.exit` calls and one `exitCode` assignment, and also values such as `130 on signal` in `tools/scripts/smoke-pg.ts:74`. The constant covers every value found, and the inventory lists them. Reported by mapping, not verified.

Traces to: `exit_code_decision`.

### D9. Folders by role and self-describing names (Human)

Code is grouped by role, and a name says what the thing is:

| Folder | Holds |
|---|---|
| `constants/` | Constants, including `EXIT_CODE` and `SERVICES`. A constant value shared by the application is exposed to code through a provider. |
| `interfaces/` | Declared types that are not derived from a schema. |
| `schemas/` | zod schemas. A declared type is `z.infer` of its schema. |
| `services/` | Injectable providers. |
| `modules/` | Nest modules. |

Other rules: an event uses RxJS; validation uses zod; a collection export has a plural name and the use site never types it with `[]`. These folders do not exist in `nest-base` or in `virgenherrera` (reported by mapping, not verified), so this is a convention of this repository, not a copy of the reference.

Traces to: `nest_rules`.

### D10. Boot order (Human)

The order is: the sea-runtime process starts; persistence runs its migrations and the schema gate inside the supervisor; the services start in `startOrder`, the `api-gateway` among them. Logging is not a service and has no place in `startOrder`. TLS certificates are created at install time (the postinstall step `runGenerateCerts`) and the gateway only reads them ([ADR-008](ADR-008-tls-trust-model.md)); that does not change. The [boot page](../nest-standalone-boot.md) holds the step list and diagrams. The persistence step is reported at `apps/sea-runtime/src/persistence/persistence.service.ts:26-80` and the spawn at `supervisor.service.ts:30-50`, by mapping, not verified.

Traces to: `boot_decision`.

### D11. One declared-services model (Agent)

One type replaces `ServiceRoute` and `ServiceDefinition`: the exported constant is `SERVICES` of type `DeclaredServices`, whose element is `DeclaredService`. The name derives from the service path. The [declared services page](../declared-services.md) holds the model, the optional pre and post routines and the open decision on compile-time checking of `dependsOn`. Only the principle is fixed here: the assembler and the supervisor read the same constant.

Traces to: `services_decisions`.

### D12. Cleanup deletes only what has zero references (Agent)

The refactor deletes a symbol only if it has zero references in `src`, tests, `tools`, scripts and non-TypeScript files. Mapping reports `ControlMessage` and `StatusSnapshot` as the only confirmed dead items. Everything else is "unsure" and stays until a QC check proves it dead. Barrel re-exports (`libs/service-registry/src/index.ts`, `libs/shared-core/src/index.ts`) hide usage, so a barrel hit counts as a reference. Each row of the inventory carries evidence and a QC status, initially `pending`.

Traces to: `cleanup_rules`.

### D13. Pure refactor: no test or smoke is edited (Human)

The code phase keeps every test and smoke passing without edits. If removing something needs a test edit, the thing is not dead, and it stays. A behavior change found on the way is a separate decision with its own ADR.

Traces to: `phase`, `cleanup_rules[1]`.

### D14. A later logging library is only a seam (Agent)

A logging library that implements `LoggerService` for the app factory, with OpenTelemetry `LogRecord`, RxJS pipes, an async file sink and a logging child process, is a later epic (see the [log service backlog](../../backlog/log-service-otel-grpc.md)). This ADR only requires that all code depends on the Nest `LoggerService` interface, so the later library can replace the writer of D4 without touching callers.

Traces to: `logging_decisions[6]`.

## Options rejected

| Option | Reason |
|---|---|
| Keep `console.*` in the code and wrap only the Nest part | Two logging paths survive, and the stdout contract of D3 stays easy to break. |
| Use the default `ConsoleLogger` | It writes `log`, `warn`, `debug` and `verbose` to stdout (reported by mapping, not verified). That breaks D3. |
| Make logging a service started by the supervisor | Logging must work before any service starts, and during the boot failures. It is not a service. |
| Generate the TLS certificates in the gateway at start | The certificates are created at install time and the gateway only reads them ([ADR-008](ADR-008-tls-trust-model.md)). Keeping that avoids a write path in a network service. |
| Change the exit values while naming them | It would break the host and the smokes. D8 names the values and keeps them. |
| Edit tests during the refactor to remove dead code | It would hide behavior changes. D13 forbids it. |
| Build the OpenTelemetry logging library now | It is a separate epic. D14 keeps the seam only. |

## Consequences

- One writer (the subclass of D4) owns every log byte. Stdout is easier to guard: only the ADR-006 events use it.
- Entrypoints and tools use the same `Logger` API as the services, so the call sites read the same everywhere.
- Exit values are readable and searchable by name. The numbers stay as they are.
- The repository gains a folder convention that its reference repository does not have. The epic must apply it slice by slice.
- The old stderr text has to be reproduced, which restrains the logger design (D5 and D7).
- Tools under `tools/scripts` use `console.*` for command output (for example `version-check.ts`, `installer-build.ts`). Whether D2 reaches them or only `apps/` and `libs/` is a question for the epic. It is not decided here and is not verified.

## Risks

- **stderr line format.** If a consumer depends on a detail of `[id] text` that the mapping did not see (spacing, a trailing newline, timestamps), the new logger breaks it. Mitigation: D5 and D7 require a before and after capture. The Nest `ConsoleLogger` adds a prefix, a timestamp and colors by default (`ConsoleLoggerOptions`, reported at `console-logger.service.d.ts:6-35`, not verified), so the subclass has to switch them off or override the formatting.
- **ConsoleLogger channel.** The claim that `warn` goes to stdout rests on one mapping of version 12.3.2, and the linked version is unknown. If the linked version differs, D4 may be unneeded or wrong. Mitigation: the first slice of the epic checks the version in use and the stream of each level with a small run before the subclass is written.
- **Boot failures before the logger is installed.** The static logger must be ready before `createApplicationContext`, or a failure there prints nowhere. Mitigation: the static logger of D4 is the first thing an entrypoint creates.
- **Lost output on exit.** `process.exit` right after a log call can truncate a buffered stderr write. Today's `console.error` has the same hazard, and it is not verified whether the Nest writer changes it.
- **Dead-code false positives.** Barrels and string-based loading hide usage (D12). Mitigation: zero references in every file type, and the QC column.
- **Decorator as a new public name.** D6 adds a name to `shared-core` that other code would then use. It stays "proposed" until the human accepts it.

## Not verified

- The version of `@nestjs/common` linked at run time, and the stream of each level in that version.
- Whether any smoke or consumer reads the `[id] text` prefix. The mapping found none, and a code comment says one does.
- Every file and line cited above. They come from mapping reports and were not re-read for this ADR.
- Whether `docs/architecture/overview.md` lists ADR-012 correctly. The mapping reports lines 39 and 157 call it a placeholder, which contradicts the file in `adr/`.
- Whether D2 reaches the scripts under `tools/scripts`.
- Whether `SupervisorLogger` can fold into the Nest `Logger` with identical lines (D7).
- The hook timeout defaults and the placement of `DeclaredServices` in a library: they are open in the [declared services page](../declared-services.md).

[Back to navigation](#navigation)
