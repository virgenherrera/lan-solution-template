<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2f-coordinated-shutdown.md
title: "POC-2f Coordinated shutdown and orphan checks"
type: backlog
summary: "Backlog slice 2f of POC-2: IPC shutdown, timeout, force-kill of descendants and orphan checks on the host OS."
related[4]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2d-supervisor-readiness-logs.md,docs/backlog/poc-2e-bounded-restart.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md
status: current
updated: 2026-10-31
-->

# POC-2f: Coordinated shutdown and orphan checks

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2e-bounded-restart.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-2g-real-binary-smoke.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Files and how they are written](#files-and-how-they-are-written)
- [Risks](#risks)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Planned |
| Slice | 2f of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~350 authored lines (ASSUMPTION) |
| Depends on | [2d](poc-2d-supervisor-readiness-logs.md); the no-restart-while-stopping rule needs [2e](poc-2e-bounded-restart.md) if that lands first |
| Branch (proposed) | `minor/poc-02f-coordinated-shutdown` |
| Result page | `docs/results/POC-02f-coordinated-shutdown.md` |
| Requirements | REQ-RUNTIME-06 |
| Acceptance criteria | AC-30 (host OS only, others pending) |

---

## Goal

[Back to navigation](#navigation)

Source: [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md), [AC-30](../requirements/11-nx-quality-testing.md).

- Replace the POC-1c signal-only stop with: a `shutdown` message over the stdio IPC, the child runs `app.close()` and exits, the supervisor waits for a timeout, then force-kills the child and its descendants.
- The system tolerates a supervisor crash without orphans.
- Verify the process tree on the host OS and on Linux. Windows is declared `blocked-by-environment` (decision D3).

---

## Requirements

[Back to navigation](#navigation)

- [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md): explicit control channel (Node IPC over stdio), `app.close()`, timeout, forced termination, descendant cleanup, no reliance on `SIGTERM` alone on Windows, tolerance of a supervisor crash, process tree verified on Windows, Linux and macOS.
- [REQ-TEST-09](../requirements/11-nx-quality-testing.md): no Windows claim from a macOS pass.

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-30](../requirements/11-nx-quality-testing.md): closing the product requests `app.close()` through IPC and finds no orphans. Host OS only; the Linux result is a Docker result.

Observable checks (graceful stop 10 s, decision D2):

- `SIGTERM` to the supervisor: the log shows `shutdown` sent, the gateway `app.close()` completed, exit code 0, and `pgrep -f` of the binary finds nothing. Same for `SIGINT`, which closes the inherited "SIGINT not observed on macOS" item.
- A scratch gateway that ignores `shutdown`: the supervisor force-kills it after the timeout. Record the measured time.
- A scratch gateway that spawns a grandchild: after the stop no grandchild remains.
- `kill -9` of the supervisor: within a few seconds the gateway exits by itself because the IPC channel closed, and no process remains.
- Linux Docker run with `--init` (so zombies are reaped; POC-1c left a defunct process under `sleep` as PID 1): the same four checks pass.
- `pnpm run build && pnpm run test` exit 0.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Implement the stop sequence in the supervisor: state `stopping`, send `shutdown`, await exit per child in dependency reverse order, timeout, force-kill. Source: [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md).
- [ ] Make the gateway handle `shutdown` (`app.close()`, then exit 0) and handle `disconnect` as a stop when the supervisor dies. Source: [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md).
- [ ] Spawn children so their descendants can be killed: a process group on POSIX; on Windows `taskkill /T /F`. The Windows branch is written but labelled not verified. Source: [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md), [REQ-TEST-09](../requirements/11-nx-quality-testing.md).
- [ ] Route `SIGINT` and `SIGTERM` of the supervisor through the same sequence. Source: [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md).
- [ ] Stay quiet on the restart rule: a service stopping on purpose is not restarted (shared with 2e). Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Define the Quit contract for Tauri as text only: `SIGTERM` on POSIX; on Windows a control message or stdin close. The wiring is POC-5 ([REQ-DESK-02](../requirements/09-desktop-tauri.md)); the contract is not verified against Tauri sidecar behaviour. Source: [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md).
- [ ] Check the process tree on macOS arm64 and in Debian bookworm (arm64, amd64). Record `ps` before and after. Source: [AC-30](../requirements/11-nx-quality-testing.md).
- [ ] Mark Windows `blocked-by-environment` in the result page and hand it to POC-8. Source: [REQ-TEST-09](../requirements/11-nx-quality-testing.md), [OQ7](../roadmap/PROPOSAL.md#open-questions).
- [ ] Publish `docs/results/POC-02f-coordinated-shutdown.md`. Source: [AC-30](../requirements/11-nx-quality-testing.md).

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `apps/sea-runtime/src/supervisor/*.ts` | manual edit of CLI-generated files; no CLI writes a stop sequence |
| `apps/api-gateway/src/main.ts` | manual edit of a CLI-generated file. Reason: the Nest CLI has no shutdown-hook flag |
| `libs/service-registry/src/control-channel.ts` | manual edit (message `shutdown` already defined in 2d) |
| `docs/results/POC-02f-coordinated-shutdown.md`, `docs/meta.toon` | manual; regeneration command |

---

## Risks

[Back to navigation](#navigation)

- The Windows process tree is a pitch rabbit hole and cannot be tested here. A wrong `taskkill` branch ships unverified. D3 decides whether that is acceptable.
- `process.kill(-pid)` needs `detached: true`, which changes console and signal behaviour on Windows. Not verified.
- A force-kill after the timeout can interrupt a SQLite write once POC-3 exists. The graceful value must be re-measured then.
- Docker PID 1 behaviour (zombies) can show a defunct process that is not a running orphan. The checks use `--init` and distinguish `Z` state from `S`.
- A `disconnect` handler stops the gateway when the supervisor crashes. Running a gateway on its own (the dev run) has no IPC channel and must not stop; keep that case.

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| [OQ7](../roadmap/PROPOSAL.md#open-questions) | what closes a micro-POC per OS | proposed; decision D3 |
| [OQ11](../roadmap/PROPOSAL.md#open-questions) | graceful stop value | proposed; decision D2 |
