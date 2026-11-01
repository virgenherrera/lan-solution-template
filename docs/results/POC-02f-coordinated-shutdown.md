<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02f-coordinated-shutdown.md
title: "POC-2f Coordinated shutdown"
type: backlog
summary: "Result of slice 2f: IPC shutdown, graceful timeout, process-tree kill and orphan checks, measured on the packaged macOS binary."
ids[0]:
related[3]: docs/backlog/poc-2f-coordinated-shutdown.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/results/POC-02e-bounded-restart.md
status: current
updated: 2026-10-31
-->

# POC-2f Coordinated shutdown

Branch: `minor/poc-02-supervisor`. Epic: [POC-2f](../backlog/poc-2f-coordinated-shutdown.md). Question: does the supervisor stop its services over the IPC channel, force-kill after a timeout, and leave no orphan, also when the supervisor itself dies?

## Summary

- Yes on macOS arm64 with one service (`api-gateway`). Debian bookworm (arm64, amd64) is not verified: no Docker run in this slice. Windows is `blocked-by-environment` (decision D3).
- Stop sequence (`apps/sea-runtime/src/supervisor/process-tree.ts`, `stopTree`): the supervisor sets `stopping`, then for each service in reverse startup order it sends `{kind: 'shutdown'}` over IPC, waits `gracefulStopMs`, then kills the process tree. After a clean exit it still sends one tree kill, so a descendant that outlived the child does not remain.
- `gracefulStopMs` is 10000, a Zod default in `SUPERVISOR_CONFIG` (OQ11, decision D2). `windowsKillCommand` (`taskkill`) is a default there too.
- Children are spawned with `detached: true` on POSIX, so each leads its own process group and `process.kill(-pid, 'SIGKILL')` reaches its descendants. Side effect: the terminal's `Ctrl+C` no longer reaches the child directly; the supervisor receives `SIGINT` and routes it.
- Windows branch: no `detached`; the tree is killed with `taskkill /pid <pid> /T /F`. Written, **not verified** ([REQ-TEST-09](../requirements/11-nx-quality-testing.md)).
- The gateway handles the `shutdown` message (`app.close()`, log `app.close() completed`, exit 0) and handles `disconnect` as a stop (no log: the pipe is gone). A standalone run has no IPC channel, so neither handler is registered and the dev run does not stop.
- `SIGINT` and `SIGTERM` of the supervisor go through the same sequence. A service stopping on purpose is not restarted: `ServiceLifecycle.stop()` runs before the message is sent (2e rule, unchanged).

## Observed outputs

macOS arm64, Node 26.13.0. The packaged binary was copied alone to a `mktemp -d` and run with `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin`. A scratch Python driver outside the repository sent the signals and polled `pgrep`.

| Check | Result |
| --- | --- |
| `pnpm run build` | exit 0 |
| `pnpm run test` | exit 0 |
| `pnpm exec nx run sea-runtime:package --skip-nx-cache` | exit 0 |
| `GET /` | 200 |
| `GET /api/health` | 200, `{"status":"ready"}` |
| `GET /api/nope` | 404 |
| Selectors, passed as an argument array | `--service nope` 2, `--service` 2, `--service=` 2, `--service sea-runtime` 2, `--service a --service b` 2 |
| `kill -9` of the gateway | supervisor restarts it; `ready` again with a new pid, health 200 (2e still works) |

### Stop timings

| Case | Supervisor exit | Time from signal to exit | Left after (`pgrep -f` on the copied path) |
| --- | --- | --- | --- |
| `SIGTERM` | 0 | 0.007 s | none |
| `SIGINT` | 0 | 0.007 s | none |
| Gateway frozen with `SIGSTOP`, then `SIGTERM` | 0 | 10.017 s | none |
| `SIGKILL` of the supervisor | n/a | gateway gone after 0.032 s | none |

`SIGTERM` log, offsets from the signal:

```text
+0.000s [supervisor] received SIGTERM; stopping 1 service(s)
+0.000s [supervisor] state stopping
+0.001s [supervisor] shutdown sent to service "api-gateway"
+0.002s [api-gateway] app.close() completed
+0.005s [supervisor] service "api-gateway" exited 4 ms after shutdown
```

`SIGINT` gives the same lines with `received SIGINT`. This closes the "SIGINT not observed on macOS" item inherited from POC-1c.

Frozen gateway (stands for a gateway that ignores `shutdown`; a stopped process cannot read the message):

```text
+0.001s [supervisor] shutdown sent to service "api-gateway"
+10.003s [supervisor] service "api-gateway" did not exit within 10000 ms; killing its process tree
+10.011s [supervisor] service "api-gateway" killed 10011 ms after shutdown
```

The escalation fired at 10.003 s and the tree was gone 8 ms later.

### Descendants

The real gateway has no grandchild, so this used scratch child scripts outside the repository, each spawning `sleep 300`. A scratch driver imported the real `stopTree` and `treeSpawnOptions` from `process-tree.ts` (Node type stripping) and spawned the scratch script with them.

| Scratch child | Graceful value | Result |
| --- | --- | --- |
| Exits 0 on `shutdown`, leaves the grandchild | 2000 ms | exited 2 ms after `shutdown`; grandchild dead 0.3 s later; `pgrep -f 'sleep 300'` empty |
| Ignores `shutdown`, owns a grandchild | 10000 ms | escalation at 10.012 s; child and grandchild dead; `pgrep` empty |

### Supervisor death

`SIGKILL` of the supervisor: the gateway got `disconnect`, ran `app.close()`, exited, and was gone 0.032 s later. No process remained. The supervisor cannot clean up in this case; the stop is the gateway's own.

## Quit contract for Tauri (text only)

Not verified against Tauri sidecar behaviour; the wiring is POC-5 ([REQ-DESK-02](../requirements/09-desktop-tauri.md)).

- POSIX: the shell sends `SIGTERM` to the supervisor and waits for its exit.
- Windows: a control message or a closed stdin. The supervisor reads neither today. Windows has no `SIGTERM` for a console-less child, so this is open for POC-5 and POC-8.

## Windows

`blocked-by-environment` (decision D3). No Windows host was available. Handed to POC-8 ([OQ7](../roadmap/PROPOSAL.md#open-questions)). Unverified points: `taskkill` flags, that `detached` stays off, and that IPC `disconnect` fires on the gateway when the supervisor is killed. No claim of Windows support is made ([REQ-TEST-09](../requirements/11-nx-quality-testing.md)).

## Files and the command that wrote them

| File | Written by |
| --- | --- |
| `apps/sea-runtime/src/supervisor/process-tree.ts` | manual: no CLI writes a stop sequence |
| `apps/sea-runtime/src/supervisor/supervisor.service.ts`, `apps/api-gateway/src/main.ts` | manual edit of CLI-generated files; the Nest CLI has no shutdown-hook flag |
| `libs/service-registry/src/supervisor-config.ts`, `control-channel.ts` | manual: no CLI writes schema bodies |
| `docs/results/POC-02f-coordinated-shutdown.md` | manual |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

No dependency changed; `pnpm-lock.yaml` and every `package.json` are untouched. No `*.spec.ts` was created.

## Not verified

- Debian bookworm arm64 and amd64 (needs Docker; `--init`, `Z` versus `S` state).
- Windows (all of it).
- `ps` tree snapshots before and after; the checks used `pgrep -f` and `kill -0` on pids.
- Two services, and the reverse-order wait with more than one (only one service exists).
- A real gateway that ignores `shutdown` (the frozen process stands in for it).
- An `app.close()` blocked by open keep-alive connections.
- A crash exit (not a requested stop) does not sweep the dead child's descendants; only the stop sequence does.

## Risks

- `detached: true` changes signal behaviour at the terminal: a child no longer receives `Ctrl+C` itself.
- A force-kill after 10 s can cut a SQLite write once POC-3 exists; re-measure then.
- Pid reuse: the post-exit tree kill signals `-pid` of a leader that already exited. The window is milliseconds; not measured.
- Port 3000 was briefly held by another process on this host during the runs; the driver waited for it to be free.
