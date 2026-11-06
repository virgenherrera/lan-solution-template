<!-- toon-meta
fmt: TOON
doc: docs/architecture/declared-services.md
title: "Declared services contract"
type: architecture
summary: "Proposed single DeclaredServices model replacing ServiceRoute and ServiceDefinition, validated at run time, with no per-service routines."
ids[0]:
related[7]: docs/architecture/adr/ADR-013-nest-standalone-architecture.md,docs/architecture/nest-standalone-boot.md,docs/backlog/nest-standalone-refactor.md,docs/backlog/nest-standalone-cleanup-inventory.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/overview.md
status: proposed
updated: 2026-11-06
-->

# Declared services contract

[Overview](overview.md) | [ADR-013](adr/ADR-013-nest-standalone-architecture.md) | [Nest standalone boot](nest-standalone-boot.md) | [ADR-009](adr/ADR-009-desktop-process-model.md) | [Epic](../backlog/nest-standalone-refactor.md) | [Cleanup inventory](../backlog/nest-standalone-cleanup-inventory.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Proposed contract](#proposed-contract)
- [Name and project derivation](#name-and-project-derivation)
- [Startup order and shutdown](#startup-order-and-shutdown)
- [Validation](#validation)
- [Who reads DeclaredServices](#who-reads-declaredservices)
- [Migration table](#migration-table)
- [Decision: plain typed array](#decision-plain-typed-array)
- [Not verified](#not-verified)

## Status

Proposed, 2026-11-06. Revised the same day after two decisions by the human: the contract carries no per-service routines, and the array is a plain typed constant validated at run time.

This phase changes documentation only. No file under apps/, libs/ or tools/ changes. The later code refactor is a pure refactor: every existing test and smoke passes unchanged.

The author read the code lines cited in the tables. Claims taken from mapping reports are collected in [Not verified](#not-verified).

## Context

Two models describe a service today.

| Model | Source | Fields | State |
| --- | --- | --- | --- |
| `ServiceRoute` | libs/service-registry/src/service-routes.ts | id, project, dependsOn, enabled, web | Live. A helper function builds it. `apps/sea-runtime/src/services.ts` declares one entry, `api-gateway`. |
| `ServiceDefinition` | libs/service-registry/src/service-definition.ts | id, entry, dependsOn, enabled | Nothing reads `entry`. `startup-order.ts` uses the type only as a `Pick`. QC must confirm before any delete. |

The two models overlap on three fields and disagree on the rest. Every service id is typed by hand, although the service path already holds the name.

A service is a long-lived process. The supervisor spawns it, reads its ready message and restarts it when it exits.

- Work that must run before a service is declared as another service earlier in the array.
- Work that must run at shutdown belongs to the service itself, through the Nest lifecycle hooks.

## Proposed contract

One model replaces both. The export follows the style of Angular routes.

```ts
// Proposed. Not implemented. A plain typed constant: no helper function wraps it.
export const SERVICES: DeclaredServices = [
  { path: 'apps/api-gateway', web: true },
];
```

Type names:

| Name | Meaning |
| --- | --- |
| `declaredServiceSchema` | zod schema of one service. |
| `DeclaredService` | `Readonly<z.infer<typeof declaredServiceSchema>>`. The element type. |
| `DeclaredServices` | `readonly DeclaredService[]`. The collection type. Use sites never write `[]`. |
| `SERVICES` | The one constant of type `DeclaredServices`. |

Fields of `DeclaredService` (proposed):

| Field | Required | Meaning |
| --- | --- | --- |
| `path` | yes | Workspace-relative path of the service package. The name is derived from it. |
| `dependsOn` | no, default empty | Names of services that must start earlier. Kept, see [Startup order and shutdown](#startup-order-and-shutdown). |
| `enabled` | no, default true | A disabled service is declared but never started. |
| `web` | no, default false | The service receives the embedded web bundle over IPC on every start. |

The input has no `id` and no `entry`.

A service is one long-lived process. A task that ends is not a service: the supervisor would treat its exit as a crash and restart it. For that reason the database migrations stay a step of the supervisor, not a declared service ([Nest standalone boot](nest-standalone-boot.md)).

```mermaid
stateDiagram-v2
    [*] --> Spawn
    Spawn --> Ready: child reports ready
    Ready --> Exit: child exits
    Spawn --> Exit: child exits
    Exit --> Restart: budget left
    Exit --> Failed: budget exhausted
    Restart --> Spawn
    Failed --> [*]
```

| Source | Finding |
| --- | --- |
| apps/sea-runtime/src/supervisor/service-lifecycle.ts:101 | Any exit, clean or not, goes through the restart plan. |
| apps/sea-runtime/src/supervisor/service-lifecycle.ts:107-119 | A spent budget sets the status to failed. Otherwise the status is restarting and a timer respawns the child. |

## Name and project derivation

The name of a service is `path.parse(path).base`. The name replaces `id` everywhere: argv (`--service <name>`), log prefix, status events and `dependsOn` references.

- Use `.base`, not `.name`. `.name` strips a dot suffix, so a path ending in `x.y` would lose `.y`.
- `path.parse` works on a string and touches no disk. It works inside the SEA binary.
- `project` is the workspace package that holds `dist/main.js`. Under the proposal it comes from the same path, so the assembler reads the path directly and the `project` input disappears.
- Today project defaults to the id (comment at service-routes.ts:9).
- Two services whose paths share a base name collide. Validation rejects them as a duplicate name.

## Startup order and shutdown

The code was read to settle one question: does the supervisor wait for a service to be ready before it launches the next one? It does not.

| Source | Finding |
| --- | --- |
| apps/sea-runtime/src/supervisor/supervisor.service.ts:41-49 | One synchronous `for` loop over `startOrder()`. Each iteration creates the lifecycle and calls `lifecycle.start()` without awaiting anything. |
| apps/sea-runtime/src/supervisor/service-lifecycle.ts:59-63 | `start()` subscribes and returns at once. It returns no promise and no readiness signal. |
| apps/sea-runtime/src/supervisor/service-lifecycle.ts:83-91 | The ready message only sets the status to ready. Nothing gates the next spawn on it. |
| libs/service-registry/src/startup-order.ts:4,18-20 | `startupOrder` is a topological sort over `dependsOn`. Ties keep registry order. It orders the spawns and does nothing else. |
| libs/service-registry/src/startup-order.ts:5 | A code comment says ordering of two or more services is unverified. |
| apps/sea-runtime/src/supervisor/supervisor.service.ts:79-82 | Shutdown runs in reverse start order. |

Result:

- The array order does not order startup. It only breaks ties between services that `dependsOn` leaves unordered. dependsOn stays in the contract and keeps the meaning "starts earlier".
- No service waits for the ready message of another one. Making the supervisor wait is a behavior change and is out of scope.
- At shutdown the supervisor sends the shutdown message, then stops the process tree.

Work before a service: declare it as another service earlier in the array, and name it in `dependsOn` when the order matters.

Work at shutdown: the service does it. A Nest service runs onApplicationShutdown and beforeApplicationShutdown when the child closes its application. The supervisor adds no routine and no extra time limit.

## Validation

Validation stays internal and always runs at run time with zod, the way Angular validates its route configuration. Both readers run it: the supervisor when it reads the services, and the assembler when it reads `SERVICES` at build time.

```mermaid
flowchart TD
    S["SERVICES constant"] --> P["declaredServicesSchema.parse at run time"]
    P --> C1["Names are unique"]
    P --> C2["Every dependsOn names a declared service"]
    P --> C3["Enabled services have no startup cycle"]
    C1 --> OK{"All checks pass?"}
    C2 --> OK
    C3 --> OK
    OK -- "yes" --> R["Supervisor and assembler use the services"]
    OK -- "no" --> F["Abort with the zod issue path"]
```

The checks match what `routesSchema` does today (service-routes.ts:18-35), applied to names instead of ids. The cycle check calls the same ordering function as the supervisor.

The type is `z.infer` of the schema. No hand-written interface duplicates it. Each reader validates once, where it first consumes `SERVICES`. The editor does not check `dependsOn` names; see [Decision: plain typed array](#decision-plain-typed-array).

## Who reads DeclaredServices

```mermaid
flowchart TD
    S[SERVICES constant] --> A[Assembler compile-sea]
    S --> V[Supervisor]
    A --> J[services asset in the SEA]
    J --> V
    V --> O[startup order]
    V --> L[service lifecycles]
    L --> C[child processes]
```

- The assembler reads `SERVICES` at build time to find each package and to write the services asset. The asset omits `project` today. Under the proposal it omits path details the supervisor does not need.
- The supervisor reads the asset at run time through the routes source. It validates the services, orders them and spawns children.
- Both read the one constant, so the two views cannot drift.
- Both validate with the same schema, so a wrong declaration fails in either place.

| Source | Reader |
| --- | --- |
| compile-sea.ts:276,467,485 | Assembler. |
| apps/sea-runtime/src/supervisor/service-routes-source.ts | Supervisor. |

Boot order around the supervisor, certificates and migrations is in [Nest standalone boot](nest-standalone-boot.md).

## Migration table

| Old | New | Note |
| --- | --- | --- |
| `ServiceRoute` | `DeclaredService` | One element type, `z.infer` of `declaredServiceSchema`. |
| `serviceRouteSchema` | `declaredServiceSchema` | Strict object, as today. |
| `ServiceDefinition` | removed | Merged into `DeclaredService`. QC to verify zero readers before delete. |
| `serviceDefinitionSchema` | removed | Same. |
| `ServiceRegistry` | `DeclaredServices` | Collection type. |
| `serviceRegistrySchema` | internal collection schema | Not exported unless the assembler needs it. QC to verify before delete. |
| `routesSchema` | internal collection schema | Same checks, applied to names. |
| `defineServices` | removed | Decided by the human, 2026-11-06. `SERVICES` is a plain `DeclaredServices` constant. See [Decision: plain typed array](#decision-plain-typed-array). |
| `pre` and `post` (proposed fields, never implemented) | dropped | Decided by the human, 2026-11-06. Work before a service is another service earlier in the array. Work at shutdown is a Nest lifecycle hook of the service. |
| `servicesAssetSchema` | stays, derived from `declaredServiceSchema` | Shape of the asset the supervisor reads. |
| `entry` | removed | No reader found by mapping. |
| `project` | derived from `path` | No longer an input. |
| `id` | `name`, derived with `path.parse(path).base` | No longer an input. argv flag value, log prefix and status keys change source, not value, for `api-gateway`. |
| `serviceIdSchema` | `serviceNameSchema` (proposed) | Used by `serviceArgs` and `dependsOn`. |

`api-gateway` keeps the same name, so argv, the `[api-gateway] text` log line and status events are byte identical. This is the pure-refactor condition and needs a proof in the code phase.

## Decision: plain typed array

Decided by the human, 2026-11-06. `SERVICES` is `export const SERVICES: DeclaredServices = [...]` with a simple type and no helper function. Zod validation always runs at run time, in the supervisor and in the assembler, the same way Angular validates its route configuration.

What is lost on purpose: the editor and `tsc` no longer flag a `dependsOn` entry that names no declared service. A mistake compiles and fails at the first run of the assembler or the supervisor, with the zod issue path. The cost of a late error is one failed `compile-sea` run. This is no longer an open decision.

## Not verified

| Item | Why it is missing | Who verifies |
| --- | --- | --- |
| `serviceDefinitionSchema`, `serviceRegistrySchema` and `entry` have no reader | Mapping reported it; nobody repeated the search | QC: search `src`, tests, `tools`, scripts and non-TS files before any delete |
| `docs/results/POC-02c-assembler-registry.md:20` is stale | It says `compile-sea` validates with `serviceRegistrySchema`; mapping found no such call. Recorded in the cleanup inventory | Code phase |
| Package folder name equals the derived name and the Nx project name | Not checked against every package | QC |
| The supervisor should wait for the ready message before the next launch | Today it does not. Changing it is a behavior change outside this refactor | Human decision |
| Reverse stop order holds in every shutdown path | Only one path was read | QC |
| `DeclaredServices` lives in `libs/service-registry` | Recommendation: stay there, because the lib already owns ordering and the supervisor protocol. Not checked against every importer | QC |
