<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02e-bounded-restart.md
title: "POC-2e Bounded restart"
type: backlog
summary: "Result of slice 2e: per-service lifecycle with backoff, jitter, restart window and counter reset, with delays measured on the packaged binary."
ids[0]:
related[3]: docs/backlog/poc-2e-bounded-restart.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/results/POC-02d-readiness-logs.md
status: current
updated: 2026-10-31
-->

# POC-2e Bounded restart

Branch: `minor/poc-02-supervisor`. Epic: [POC-2e](../backlog/poc-2e-bounded-restart.md). Question: does the supervisor respawn a crashed service with `process.execPath`, with bounded backoff, and stop with `error` when the budget is gone?

## Summary

- Yes for the native macOS arm64 build with one service (`api-gateway`). Debian bookworm (arm64, amd64) is not verified. Two services are not verified.
- `ServiceLifecycle` (`apps/sea-runtime/src/supervisor/service-lifecycle.ts`) owns spawn, exit handling, the readiness timer and the restart budget for one service. The supervisor only builds the child (`spawn(process.execPath, args, { shell: false })`) and aggregates the statuses.
- Policy values are Zod defaults in `SUPERVISOR_CONFIG` (OQ11, decision D2): `backoffInitialMs` 1000, `backoffFactor` 2, `backoffMaxMs` 30000, `jitterRatio` 0.2, `maxRestarts` 5, `restartWindowMs` 300000, `stableResetMs` 60000.
- Delay n is `min(1000 * 2^n, 30000)`, then spread by plus or minus 20 percent. The cap applies before the jitter, so the last possible delay is 36 s. Not decided by the SRS; marked as an assumption.
- Jitter source and clock are constructor parameters of `ServiceLifecycle` (`random`, `now`). The supervisor uses the defaults. Measurement used the real binary and the logged delay.
- On an exit that is not a requested stop: if the process ran 60 s or more since spawn, the attempt counter and the window are cleared. Restarts older than 300 s leave the window. If 5 restarts are still in the window, the service becomes `failed` and nothing is spawned. Otherwise the status is `restarting` and a timer respawns it.
- A new status `restarting` maps to aggregate `degraded` in `aggregateState`. `failed` with no ready service stays `error`, which stops the supervisor with exit 1 (2d behavior).
- A readiness timeout now kills the child with `SIGKILL`; the exit handler counts it against the same budget as any crash before `ready`.
- Respawn calls the same child builder, so the web bundle is sent again from the supervisor memory.
- A requested stop calls `stop()` on every lifecycle first, so no timer is left and no restart happens.

## Observed outputs

macOS arm64, Node 26.13.0. The binary was copied alone to a `mktemp -d`, run with `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin`. A scratch Python driver (outside the repository) read the supervisor stdout with timestamps and sent `kill -9`.

| Check | Result |
| --- | --- |
| `pnpm run build` | exit 0 |
| `pnpm run test` | exit 0 |
| `pnpm exec nx run sea-runtime:package --skip-nx-cache` | exit 0 |
| `GET /` | 200 |
| `GET /api/health` | 200, `{"status":"ready"}` |
| `GET /api/nope` | 404 |
| SIGTERM on the supervisor | exit 0, 0 processes left (`pgrep -f` on the copied path) |
| Selectors, passed as an argument array | `--service nope` 2, `--service` 2, `--service=` 2, `--service sea-runtime` 2, `--service a --service b` 2 |

### Six kills in a row

Each kill happened about 0.3 s after the state returned to `ready`.

| Exit | Log | Measured delay (ms) | Allowed range (ms) | Time from kill to `ready` again |
| --- | --- | --- | --- | --- |
| 1 | `restart 1/5` | 997 | 800 to 1200 | about 1.1 s |
| 2 | `restart 2/5` | 1617 | 1600 to 2400 | about 1.7 s |
| 3 | `restart 3/5` | 4245 | 3200 to 4800 | about 4.4 s |
| 4 | `restart 4/5` | 9368 | 6400 to 9600 | about 9.5 s |
| 5 | `restart 5/5` | 17845 | 12800 to 19200 | about 18.0 s |
| 6 | `restart budget exhausted: 5 restarts in 300000 ms; no further spawn` | none | none | none |

- After exit 6 the log shows `state error`, `received SIGTERM; stopping 1 service(s)`, `state stopping`. The supervisor exited 1 and left 0 processes. No seventh spawn.
- After every restart `GET /api/health` returned `{"status":"ready"}` with a new pid. `ps -o comm=` of the new pid and of the supervisor gave the same file (`/private/var/...` and `/var/...` are the same path on macOS, a symlink).
- Each kill produced `state degraded` (restart pending), then `state ready` after the new `ready` message.
- Total from first kill to `error`: about 36.4 s.

### Counter reset after 60 s

First kill: `restart 1/5 in 972 ms`. Then 62 s idle, second kill: `restart 1/5 in 1070 ms` (not 2/5, and the delay is the first-step range). The reset worked; health was 200 `ready` after both.

### Requested stop

`kill -9` of the gateway, then SIGTERM to the supervisor 0.2 s later while the restart timer was pending (`restart 1/5 in 814 ms`): the log shows `received SIGTERM`, `state stopping`, no `spawned` line after it, exit 0, 0 processes left.

### Exit before ready (port busy)

A scratch socket held `127.0.0.1:3000`. The gateway cannot bind and exits with code 1 about 0.1 s after spawn.

| Exit | Delay (ms) |
| --- | --- |
| 1 | 1177 |
| 2 | 1830 |
| 3 | 4642 |
| 4 | 7254 |
| 5 | 17209 |
| 6 | budget exhausted, `state error`, supervisor exit 1 |

The budget burns in 34 s. The message for the user is POC-5 ([REQ-DESK-05](../requirements/09-desktop-tauri.md)). The status goes through `restarting` (aggregate `degraded`) while a restart is pending, so `degraded` also appears when no service was ever `ready`. Not verified as the wanted rule.

## Files and the command that wrote them

| File | Written by |
| --- | --- |
| `apps/sea-runtime/src/supervisor/service-lifecycle.ts` | manual: no CLI writes this class |
| `apps/sea-runtime/src/supervisor/supervisor.service.ts` | manual edit of a CLI-generated file |
| `libs/service-registry/src/supervisor-config.ts`, `aggregate-state.ts` | manual: no CLI writes schema bodies or pure functions |
| `docs/results/POC-02e-bounded-restart.md` | manual |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

No dependency changed; `pnpm-lock.yaml` and every `package.json` are untouched. No `*.spec.ts` was created.

## Not verified

- Debian bookworm arm64 and amd64 restart (needs Docker; not run in this slice).
- Two services, and `degraded` with one service ready and another restarting.
- Descendants of a `SIGKILL`ed service (slice 2f).
- The window pruning after 300 s (only the 5-in-window cut and the 60 s reset were measured).
- Whether the 36 s worst-case delay suits the desktop shell.

## Risks

- `ServiceStatus` gained `restarting`; `aggregateState` is exported from the library, so a consumer that matched on the old union must handle it. Nothing else in the repository uses it.
- A readiness timeout now kills the child; before 2e it only marked it failed and left the process to the shutdown.
- `SIGKILL` on the supervisor itself leaves the gateway alive; handling is 2f.
