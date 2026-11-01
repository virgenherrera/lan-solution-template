<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02d-readiness-logs.md
title: "POC-2d Supervisor readiness, logs and aggregate state"
type: backlog
summary: "Result of slice 2d: IPC control channel, readiness timeout, prefixed logs, aggregate state and gateway health, observed on the packaged binary."
ids[0]:
related[3]: docs/backlog/poc-2d-supervisor-readiness-logs.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/results/POC-02c-assembler-registry.md
status: current
updated: 2026-10-31
-->

# POC-2d Supervisor readiness, logs and aggregate state

Branch: `minor/poc-02-supervisor`. Epic: [POC-2d](../backlog/poc-2d-supervisor-readiness-logs.md). Question: can the supervisor know when a service is ready, show one aggregate state, prefix every log line, and let `/api/health` report that state?

## Summary

- Yes for the native macOS arm64 build with one service (`api-gateway`). Behavior with two services is not verified.
- The control messages are Zod schemas in `libs/service-registry/src/control-channel.ts`: `ready` (child to supervisor), `state` and `shutdown` (supervisor to child). `shutdown` is defined only; slice 2f sends it. `web-bundle` keeps its schema in `api-gateway` (POC-1f path unchanged).
- Every service is spawned with `stdio: ['inherit', 'pipe', 'pipe', 'ipc']` and `serialization: 'advanced'`. The IPC channel now stays open after the web bundle arrives, because the state travels over it.
- The gateway sends `ready` after `app.listen` resolves. With no IPC channel (standalone `node dist/main`) it sets its own state to `ready` after listen.
- Defaults live in `SUPERVISOR_CONFIG` (Zod): `readinessTimeoutMs` 30000 (OQ11, decision D2), `errorExitCode` 1, log id `supervisor`.
- Aggregate state is the pure function `aggregateState`: `stopping` wins; a failed service with no ready one is `error`, with a ready one `degraded`; all ready is `ready`; otherwise `starting`. A service that exits or misses the timeout is `failed`. `error` makes the supervisor stop the others and exit with `errorExitCode`.
- `startupOrder` (pure, in the registry library) orders ids by `dependsOn`. The services asset lists ids only, so the supervisor passes no dependencies and the order equals the registry order. Two services with a dependency are not verified.
- Child stdout and stderr are re-emitted line by line as `[<id>] <line>`. Supervisor lines are `[supervisor] <line>`. Nest's own supervisor logger is off (`logger: false`) so no unprefixed Nest line appears.
- Each state change prints one JSON line on the supervisor stdout, never prefixed: `{"kind":"state","state":"ready"}`. This is a design for POC-5, not verified against Tauri.
- `/api/health` returns `{"status":"<aggregate state>"}` with HTTP 200 and nothing else.
- The gateway hostname was already the literal `127.0.0.1`; nothing changed for the loopback rule.

## Observed outputs

macOS arm64, Node 26.13.0, binary copied alone to an empty `mktemp -d`, `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin`.

| Check | Result |
| --- | --- |
| `pnpm run build` | exit 0 |
| `pnpm run test` | exit 0 |
| `pnpm exec nx run sea-runtime:package --skip-nx-cache` | exit 0 |
| `GET /` | 200 |
| `GET /api/health` | 200, `{"status":"ready"}` |
| `GET /api/nope` | 404 |
| Supervisor stdout, packaged run | `[supervisor] state starting`, `{"kind":"state","state":"starting"}`, `[supervisor] state ready`, `{"kind":"state","state":"ready"}`, then on SIGTERM `[supervisor] state stopping` |
| SIGTERM on the supervisor | 0 processes left (`pgrep -f` on the copied path) |
| `lsof -nP -iTCP -sTCP:LISTEN` | the gateway listens on `127.0.0.1:3000` only |
| Selectors, passed as an argument array | `--service nope` 2, `--service` 2, `--service=` 2, `--service sea-runtime` 2, `--service a --service b` 2 |
| Resident memory (`ps rss`) | supervisor 86912 KB, gateway 96304 KB |

The `ExperimentalWarning` lines of Node appear before any application code runs, so they carry no prefix.

## Late and never-listening gateway

Scratch copy of the tree in `mktemp -d` (`pnpm install --offline --frozen-lockfile`), with a scratch-only edit of `apps/api-gateway/src/main.ts` that reads `GW_DELAY_MS` before `listen`. The scratch copy was deleted. The repository code reads no environment variable.

| Case | Observed |
| --- | --- |
| `GW_DELAY_MS=5000` | stdout shows `starting`, then `ready`; `GET /api/health` first answered 200 `ready` at about 7 s after launch (about 2 s of boot plus the 5 s delay); SIGTERM left 0 processes |
| gateway never listens (timer keeps it alive) | `[supervisor] service "api-gateway" not ready within 30000 ms`, then `state error`, then `stopping`; supervisor exit 1 after 32 s; 0 processes left |

- The gateway answers no request while it is `starting`, because it does not listen yet. `/api/health` therefore shows `starting` only in the short window between `listen` and the supervisor's reply.
- The 10 s web receive timeout starts at gateway boot and ends when the bundle arrives, which the supervisor sends right after spawn. A 5 s delay after the receive did not touch it. A supervisor that delays the send past 10 s is not verified.
- A gateway whose promise never settles and keeps no timer exits 0 on its own; the supervisor then reports `error`. This is the same path as a crash before ready.

## Files and the command that wrote them

| File | Written by |
| --- | --- |
| `libs/service-registry/src/control-channel.ts` | manual: no CLI writes message schemas |
| `libs/service-registry/src/supervisor-config.ts`, `startup-order.ts`, `aggregate-state.ts` | manual: no CLI writes schema bodies or pure functions |
| `libs/service-registry/src/index.ts` | manual, export lines |
| `apps/sea-runtime/src/supervisor/supervisor.service.ts`, `main.ts` | manual edit of CLI-generated files |
| `apps/sea-runtime/src/supervisor/log-lines.ts` | manual: no CLI writes this helper |
| `apps/api-gateway/src/main.ts`, `health.controller.ts`, `app.module.ts`, `web-bundle.ts` | manual edit of CLI-generated files |
| `apps/api-gateway/src/health-state.ts` | manual: a plain provider; `nest generate` was not used |
| `apps/api-gateway/package.json` (dependency) | `pnpm --filter api-gateway add 'service-registry@workspace:*'` |
| `apps/api-gateway/package.json` (`nx.targets.build.dependsOn`) | `pnpm pkg set --json 'nx.targets.build.dependsOn=["^build"]'` run in `apps/api-gateway` |
| `pnpm-lock.yaml` | `pnpm` (three lines: the new workspace link under `api-gateway`) |
| `docs/results/POC-02d-readiness-logs.md` | manual |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

The `api-gateway` build target needed `^build` because it now imports `service-registry`; without it the first build ran before the library and failed to link. No `*.spec.ts` was created.

## Not verified

- Two services, dependency order, and `degraded` in a real run.
- Windows and Linux runs.
- The stdout JSON line against a real Tauri sidecar (POC-5).
- Whether `/api/health` may expose more than the state (POC-7).
- The supervisor delaying the web bundle past 10 s.

## Risks

- `/api/health` changed its body from `{"status":"ok"}` to `{"status":"<state>"}`. Nothing else in the repository reads it.
- The IPC channel of the gateway is no longer closed after the bundle. A parent that dies leaves the channel to close by itself; handling is in 2f.
- An exit of any service while the aggregate is not `error` is only logged. Restart is 2e.
- Standalone `ready` after listen is the gateway's own rule, outside REQ-RUNTIME-05. Not verified as a requirement.
