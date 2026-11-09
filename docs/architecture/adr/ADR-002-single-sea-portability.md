<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-002-single-sea-portability.md
title: "ADR-002 Single SEA portability and supervisor"
type: architecture
summary: "Records the POC-2 decisions: one SEA per platform, closed registry, IPC control channel, bounded restart, coordinated shutdown and package smoke."
related[5]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/overview.md,docs/roadmap/PROPOSAL.md,docs/results/POC-02-Result.md,docs/architecture/adr/ADR-001-version-substitutions.md
status: current
updated: 2026-11-09
-->

# ADR-002: Single SEA portability and supervisor

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [POC-2 result](../../results/POC-02-Result.md) | [ADR-001](ADR-001-version-substitutions.md)

## Status

Accepted as the record of what POC-2 built and measured. Recorded 2026-10-31 at the close of POC-2. The human decisions D1 to D5 it relies on are in the [umbrella](../../backlog/poc-2-single-sea-runtime-supervisor.md#decisions-for-the-human). It does not claim Windows support ([REQ-TEST-09](../../requirements/11-nx-quality-testing.md)). The SRS owner has not reviewed it: not verified.

Update 2026-11-03: PR #15 rebuilt `sea-runtime` as Nest modules, removed any HTTP status listener and added the typed service array. The host contract is [ADR-006](ADR-006-sidecar-status-contract.md). The states, restart numbers and shutdown sequence below still hold.

## Context

[REQ-RUNTIME-01](../../requirements/09-desktop-tauri.md) asks for one SEA executable per OS and architecture. The same file must run the supervisor and each service ([REQ-RUNTIME-03](../../requirements/09-desktop-tauri.md)). POC-1c built a minimal supervisor with a role selector written inside a template string. POC-2 had to make that reviewed code, add readiness, restart and shutdown, and prove it on the packaged binary. Evidence: [POC-2 result](../../results/POC-02-Result.md) and the slice pages 2a to 2g.

## Decision

### Closed registry in `libs/service-registry`

- One library holds the contract: `ServiceDefinition` (`id`, `entry`, `dependsOn`, `enabled`), the closed registry schema, the services asset schema and `dispatch()`. It imports only `zod` and `node:util` ([2b](../../results/POC-02b-dispatcher-registry.md)).
- The assembler builds the registry from the workspace dependencies of `sea-runtime`, validates it (unique ids, known dependencies) and checks that each entrypoint exists, before bundling and before `node --build-sea` ([2c](../../results/POC-02c-assembler-registry.md)). Traces to [REQ-RUNTIME-04](../../requirements/09-desktop-tauri.md), [REQ-SEA-01](../../requirements/10-node-sea-distribution.md), [REQ-BUILD-04](../../requirements/11-nx-quality-testing.md).
- Re-entry by role: no argument means supervisor mode. `--service <id>` starts one registered service. Anything else exits 2. The selector reads no `process.env` and grants no privilege ([REQ-RUNTIME-03](../../requirements/09-desktop-tauri.md)). The supervisor spawns `process.execPath`, never `node` from `PATH`.
- A new service needs three registrations: its bootstrap and build output, a workspace dependency of `sea-runtime`, and its Nx build target. Design only, no `auth-ms` ([AC-31](../../requirements/11-nx-quality-testing.md)).
- Every literal (flag name, exit code 2, asset name, entry path) is the default of a Zod schema. A different value fails the parse.

### No postject, baseline flags and the code-cache rule

- The SEA is built with `node --build-sea` only. The `package` build log has 0 lines that match `postject` ([REQ-SEA-02](../../requirements/10-node-sea-distribution.md), [2c](../../results/POC-02c-assembler-registry.md)).
- Baseline in `ASSEMBLER_CONFIG`: `mainFormat: "module"`, `useVfs: false`, `useSnapshot: false`, `execArgvExtension: "none"` ([REQ-SEA-03](../../requirements/10-node-sea-distribution.md)).
- `useCodeCache` is on only when the host and target triples are equal. A cross build needs `--target` and `--executable`, turns the cache off and writes `executable` in the SEA config. A target that differs with no `--executable` exits 1.
- Measured: the `Code cache data rejected.` warning appears on amd64 under Rosetta with the cache on. It does not appear on arm64, with the cache off, or in the cross-built binary. The V8 mechanism and real x64 hardware: not verified.

### Control channel and states

- Services are spawned with `stdio: ['inherit', 'pipe', 'pipe', 'ipc']` and `serialization: 'advanced'`. The channel stays open for the life of the child ([2d](../../results/POC-02d-readiness-logs.md)).
- Messages are Zod schemas in `libs/service-registry/src/schemas/control-channel.ts`: `ready` (child to supervisor), `state` and `shutdown` (supervisor to child). The web bundle message keeps its schema in `api-gateway` (POC-1f).
- The gateway sends `ready` after `app.listen` resolves. With no IPC channel it sets `ready` itself after listen. That standalone rule is the gateway's, outside [REQ-RUNTIME-05](../../requirements/09-desktop-tauri.md) (not verified as a requirement).

### State words in `states.ts`

- `libs/service-registry/src/constants/states.ts` is the only place state words are spelled: `AGGREGATE_STATE` (`starting`, `ready`, `degraded`, `error`, `stopping`), `SERVICE_STATUS` (`starting`, `ready`, `restarting`, `failed`) and the control message kinds. The Zod enums and types derive from them (commit `ef5c429`).
- `aggregateState` is a pure function: `stopping` wins; a failed service with no ready one is `error`, with a ready one `degraded`; all ready is `ready`; otherwise `starting`. `restarting` maps to `degraded`. `error` stops the others and ends the supervisor with `errorExitCode` 1.
- Each state change reaches the host as one JSON `status` event on the supervisor stdout, validated by zod. The supervisor opens no HTTP listener. The channel contract is in [ADR-006](ADR-006-sidecar-status-contract.md). Not verified against Tauri (POC-5).
- `/api/health` returns the `@nestjs/terminus` report (`status`, `info`, `error`, `details`) with 200; the aggregate state is `details.state.state`. Query flags `uptime` (default on), `memory` and `db` add or remove indicators. The gateway child serves it, so it does not answer while the gateway is down (see Limits).
- Logs go to the supervisor stderr, never to stdout: every process writes its own Nest log lines to stderr, which each child inherits from the supervisor; the format is free ([ADR-006](ADR-006-sidecar-status-contract.md)). Internal services listen on `127.0.0.1` ([REQ-RUNTIME-07](../../requirements/09-desktop-tauri.md), [REQ-NET-01](../../requirements/06-web-gateway-https-pwa.md)).

### Bounded restart and the D2 window

- Policy constants (human decision D2, [OQ11](../../roadmap/PROPOSAL.md#open-questions)) live in `SUPERVISOR_CONFIG`: readiness 30000 ms, backoff 1000 ms times 2 per attempt capped at 30000 ms, jitter 0.2, at most 5 restarts in a 300000 ms window, counter reset after 60000 ms stable.
- `ServiceLifecycle` owns spawn, exit handling, the readiness timer and the budget of one service. Jitter and clock are constructor parameters.
- Measured on macOS arm64: first five delays 997, 1617, 4245, 9368, 17845 ms (page) and 1053, 2266, 3369, 7107, 16429 ms (QC), all inside the allowed ranges. The sixth kill exhausts the budget: `state error`, supervisor exit 1, no seventh spawn. The 60 s reset works. Window pruning after 300 s: not measured. Numbers and sources: [POC-2 result](../../results/POC-02-Result.md#measured-values-oq11-decision-d2). Traces to [REQ-RUNTIME-05](../../requirements/09-desktop-tauri.md).
- A readiness timeout kills the child with `SIGKILL`; the exit counts against the same budget. A requested stop clears the timers first, so no restart follows a stop.

### Coordinated shutdown with escalation

- Sequence (`stopTree` in `apps/sea-runtime/src/supervisor/process-tree.ts`): set `stopping`; per service in reverse startup order send `{kind: 'shutdown'}` over IPC; wait `gracefulStopMs` (10000); kill the process tree. After a clean exit one tree kill still runs, to catch a descendant that outlived the child ([REQ-RUNTIME-06](../../requirements/09-desktop-tauri.md)).
- POSIX children are `detached: true`, so each leads a process group and `process.kill(-pid, 'SIGKILL')` reaches descendants. The terminal `Ctrl+C` no longer reaches the child; the supervisor receives it and routes it.
- Windows: no `detached`; `taskkill /pid <pid> /T /F`. Written and **not verified** (decision D3).
- The gateway runs `app.close()` on `shutdown` and treats IPC `disconnect` as a stop, so it exits when the supervisor is `SIGKILL`ed (0.032 s measured on macOS).
- Measured: `SIGTERM` and `SIGINT` exit 0 in 0.007 s; a frozen gateway is killed at 10.003 s; no process left in any case ([2f](../../results/POC-02f-coordinated-shutdown.md)).

### Smoke as a `package` post-step (D5)

- `tools/scripts/smoke-sea.ts` runs the packaged binary and prints one line per check, tagged `@app`. The `sea-runtime` `package` command is `compile-sea.ts && smoke-sea.ts`. The root order `securityCheck`, `build`, `test`, `package` is unchanged ([REQ-RUNTIME-08](../../requirements/09-desktop-tauri.md), [REQ-TEST-07](../../requirements/11-nx-quality-testing.md), [REQ-TEST-08](../../requirements/11-nx-quality-testing.md)).
- 11 checks pass on macOS arm64, Debian bookworm-slim arm64 and amd64 (Rosetta, cross-built binary). A deliberate break of the health route makes `package` exit 1 at the right check ([2g](../../results/POC-02g-real-binary-smoke.md)).
- It is a package check, not a unit or integration suite ([REQ-TEST-01](../../requirements/11-nx-quality-testing.md)).

## Consequences

- One binary per platform, no `node` on the target, no extracted files. The macOS arm64 binary is 148224928 bytes; Linux binaries are about 153 MB.
- A Linux target needs `libatomic.so.1`. The bare `debian:bookworm-slim` image exits 127 without `libatomic1`. The installer must declare it (POC-5).
- The binary is not reproducible and `package` is not cached (POC-9).
- The smoke adds about 30 s to `package`; 27 s is the restart budget check.
- The health body changed from `ok` to the aggregate state; consumers must read the new shape.
- Constants are Zod defaults, not configuration. Configuration moves to the POC-3 singleton.

## Limits found

- `/api/health` is unreachable while the `api-gateway` restarts: the endpoint lives in the child and `degraded` is visible only in the stdout `status` events. Serving health from the supervisor is a future option and a human decision.
- Fixed gateway port 3000; a busy port burns the restart budget in 26 to 34 s.
- A force-kill after 10 s can cut a SQLite write once POC-3 exists.
- A crash exit does not sweep the dead child's descendants.
- Only one real service ran. Two services, dependency order and `degraded` with two services: not verified.
- The cwd under launchd and systemd is `/` unless the operator sets `WorkingDirectory`, so a packaged run cannot use it ([2a](../../results/POC-02a-launcher-cwd.md)). Update 2026-11-03: the root chain this spike recommended was not built. [ADR-007](ADR-007-persistence-system.md#one-base-directory) uses the executable directory when packaged and the cwd in dev.

## Not verified

- Windows (all of it), a real Linux host, systemd user units, real x64 hardware, macOS to Linux cross builds.
- Tauri use of the stdout `status` events, of the stdin `shutdown` command and of the quit contract (POC-5).
- The full pending list with owners: [POC-2 result](../../results/POC-02-Result.md#pending-items-inherited-and-new).

## Implementation status

Audit of 2026-11-09 against `main` at `cfec959`. The decision text above is kept as the record. This table says what the code does today.

| Decision | Decision status | Implementation | Check | Evidence | Gap |
|---|---|---|---|---|---|
| Closed registry lib service-registry with ServiceDefinition | Accepted as the record of what POC-2 built | Partial | adjudicated | `libs/service-registry/src/schemas/declared-services.ts:7`, `libs/service-registry/src/dispatcher.ts:36` | No ServiceDefinition type; registry is DeclaredService (path dependsOn enabled web) plus ServiceEntry; no entry field |
| service-registry imports only zod and node:util | Accepted as the record of what POC-2 built | Partial | confirmed | `libs/service-registry/src/dispatcher.ts:1`, `libs/service-registry/src/schemas/declared-services.ts:1` | declared-services.ts also imports node:path |
| Assembler builds and validates registry before bundle and build-sea | Accepted as the record of what POC-2 built | Implemented | single source | `tools/scripts/compile-sea.ts:273`, `tools/scripts/compile-sea.ts:455`, `tools/scripts/compile-sea.ts:441` | none |
| Role dispatch no arg supervisor --service id else exit 2 | Accepted as the record of what POC-2 built | Implemented | single source | `libs/service-registry/src/dispatcher.ts:27`, `apps/sea-runtime/src/sea-entry.ts:14` | none |
| Supervisor spawns process.execPath never PATH node | Accepted as the record of what POC-2 built | Implemented | single source | `apps/sea-runtime/src/services/child-spawner.ts:21` | none |
| Selector reads no process.env | Accepted as the record of what POC-2 built | Implemented | confirmed | `libs/service-registry/src/dispatcher.ts:27` | none |
| New service needs three registrations | Accepted as the record of what POC-2 built | Partial | adjudicated | `apps/sea-runtime/src/services.ts:4`, `apps/sea-runtime/package.json:38` | Registration is now one SERVICES array entry plus workspace dependency; ADR bootstrap/build-output and Nx build target triad not verified as required |
| Every literal is a Zod schema default | Accepted as the record of what POC-2 built | Implemented | single source | `libs/service-registry/src/schemas/supervisor-config.ts:5`, `libs/service-registry/src/schemas/assembler-config.ts:8` | none |
| No postject; node --build-sea only | Accepted as the record of what POC-2 built | Implemented | single source | `tools/scripts/compile-sea.ts:441` | No postject reference in tools/scripts or package manifests |
| Baseline flags mainFormat module useVfs useSnapshot false execArgvExtension none | Accepted as the record of what POC-2 built | Implemented | single source | `libs/service-registry/src/schemas/assembler-config.ts:8`, `libs/service-registry/src/schemas/assembler-config.ts:11`, `tools/scripts/compile-sea.ts:428` | none |
| useCodeCache only when host equals target; cross needs --executable | Accepted as the record of what POC-2 built | Implemented | confirmed | `libs/service-registry/src/schemas/assembler-config.ts:20`, `tools/scripts/compile-sea.ts:182`, `tools/scripts/compile-sea.ts:433` | none |
| Children spawn with IPC advanced serialization | Accepted as the record of what POC-2 built | Partial | adjudicated | `apps/sea-runtime/src/services/child-spawner.ts:24`, `apps/sea-runtime/src/services/child-spawner.ts:25` | stdio is ignore/ignore/inherit/ipc not inherit/pipe/pipe/ipc as ADR text says |
| Control messages ready state shutdown as Zod schemas | Accepted as the record of what POC-2 built | Implemented | single source | `libs/service-registry/src/schemas/control-channel.ts:10`, `libs/service-registry/src/schemas/control-channel.ts:13`, `libs/service-registry/src/schemas/control-channel.ts:16` | none |
| Gateway sends ready after listen; standalone sets ready itself | Accepted as the record of what POC-2 built | Implemented | single source | `apps/api-gateway/src/main.ts:53`, `apps/api-gateway/src/main.ts:61`, `apps/api-gateway/src/services/health-state.ts:4` | none |
| State words only in states.ts | Accepted as the record of what POC-2 built | Implemented | single source | `libs/service-registry/src/constants/states.ts:4`, `libs/service-registry/src/constants/states.ts:13` | none |
| aggregateState pure function and error exit code 1 | Accepted as the record of what POC-2 built | Implemented | confirmed | `libs/service-registry/src/aggregate-state.ts:8`, `apps/sea-runtime/src/services/supervisor.service.ts:65`, `libs/service-registry/src/schemas/supervisor-config.ts:9` | none |
| State change published as JSON status event on stdout; no HTTP listener | Accepted as the record of what POC-2 built | Implemented | single source | `apps/sea-runtime/src/services/status-publisher.ts:15`, `apps/sea-runtime/src/services/status-publisher.ts:33` | none |
| /api/health terminus report with query flags uptime memory db | Accepted as the record of what POC-2 built | Partial | adjudicated | `apps/api-gateway/src/health.controller.ts:18`, `apps/api-gateway/src/health.controller.ts:22`, `apps/api-gateway/src/health.controller.ts:24` | Memory indicator reports a dummy value (DUMMY_MB, dummy: true) |
| Logs to stderr never stdout; services listen on 127.0.0.1 | Accepted as the record of what POC-2 built | Partial | adjudicated | `apps/sea-runtime/src/services/child-spawner.ts:24`, `apps/sea-runtime/src/services/sidecar-output.ts:8`, `apps/api-gateway/src/main.ts:53` | Logs half holds (stdout only carries validated sidecar events); listen address is config net.bind (any ipv4/ipv6) not fixed to 127.0.0.1 |
| Bounded restart policy constants D2 | Accepted as the record of what POC-2 built | Implemented | single source | `libs/service-registry/src/schemas/supervisor-config.ts:6`, `libs/service-registry/src/schemas/supervisor-config.ts:13`, `libs/service-registry/src/schemas/supervisor-config.ts:18` | none |
| ServiceLifecycle owns spawn exit readiness timer budget | Accepted as the record of what POC-2 built | Implemented | confirmed | `apps/sea-runtime/src/services/service-lifecycle.ts:36`, `apps/sea-runtime/src/services/service-lifecycle.ts:97`, `apps/sea-runtime/src/services/service-lifecycle.ts:113` | none |
| Readiness timeout SIGKILL counts against budget | Accepted as the record of what POC-2 built | Implemented | single source | `apps/sea-runtime/src/services/service-lifecycle.ts:97` | none |
| Coordinated shutdown reverse order IPC wait kill tree | Accepted as the record of what POC-2 built | Implemented | single source | `apps/sea-runtime/src/supervisor/process-tree.ts:31`, `apps/sea-runtime/src/supervisor/process-tree.ts:42`, `apps/sea-runtime/src/services/supervisor.service.ts:79` | none |
| POSIX detached process group SIGKILL -pid | Accepted as the record of what POC-2 built | Implemented | single source | `apps/sea-runtime/src/supervisor/process-tree.ts:7`, `apps/sea-runtime/src/supervisor/process-tree.ts:22` | none |
| Windows taskkill tree kill (declared not verified) | Accepted as the record of what POC-2 built | Implemented | single source | `apps/sea-runtime/src/supervisor/process-tree.ts:15`, `libs/service-registry/src/schemas/supervisor-config.ts:25` | ADR itself says not verified on Windows |
| Gateway app.close on shutdown and disconnect stops it | Accepted as the record of what POC-2 built | Implemented | confirmed | `apps/api-gateway/src/main.ts:71`, `apps/api-gateway/src/main.ts:76`, `apps/api-gateway/src/main.ts:84` | none |
| Smoke as package post-step tagged @app | Accepted as the record of what POC-2 built | Implemented | confirmed | `apps/sea-runtime/package.json:69`, `tools/scripts/smoke-sea.ts:24` | Check count is now larger than the 11 recorded |
| Root order securityCheck build test package unchanged | Accepted as the record of what POC-2 built | Partial | adjudicated | `package.json:10`, `nx.json:3`, `nx.json:12` | Order is enforced by Nx dependsOn only for build test package; securityCheck is a separate root script not chained in code |
