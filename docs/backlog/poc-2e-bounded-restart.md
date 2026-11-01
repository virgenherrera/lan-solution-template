<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2e-bounded-restart.md
title: "POC-2e Bounded restart"
type: backlog
summary: "Backlog slice 2e of POC-2: respawn of process.execPath with backoff, a restart budget and an error state."
related[3]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2d-supervisor-readiness-logs.md,docs/backlog/poc-2f-coordinated-shutdown.md
status: current
updated: 2026-10-31
-->

# POC-2e: Bounded restart

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2d-supervisor-readiness-logs.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-2f-coordinated-shutdown.md)

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
| Status | Done in commit `06ab764` on `minor/poc-02-supervisor`, see [result](../results/POC-02e-bounded-restart.md) |
| Slice | 2e of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~250 authored lines (ASSUMPTION) |
| Depends on | [2d](poc-2d-supervisor-readiness-logs.md) |
| Branch (decided, D1) | `minor/poc-02-supervisor`, one commit or commit group per slice, one draft PR for all of POC-2 |
| Result page | `docs/results/POC-02e-bounded-restart.md` |
| Requirements | REQ-RUNTIME-01, REQ-RUNTIME-03, REQ-RUNTIME-05 |
| Acceptance criteria | AC-29 (respawn uses the same `process.execPath`) |

---

## Goal

[Back to navigation](#navigation)

Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md), [OQ11](../roadmap/PROPOSAL.md#open-questions).

- The supervisor respawns a crashed service as `process.execPath --service <id>`, never `node` from PATH. POC-1c spawned each child once.
- Restart is bounded: backoff with jitter, a maximum number of restarts in a window, and an `error` state when the budget is gone.
- It closes the inherited item "supervisor restart on macOS not observed".

---

## Requirements

[Back to navigation](#navigation)

- [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md): bounded restart policy (backoff plus maximum attempts), aggregate `degraded` and `error`.
- [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md): `spawn(process.execPath, ['--service', id], { shell: false })`.
- [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md): one physical executable; no `node` binary.

---

## Acceptance criteria

[Back to navigation](#navigation)

Values: [OQ11](../roadmap/PROPOSAL.md#open-questions), decision D2. Backoff 1, 2, 4, 8, 16 s capped at 30 s with 20 percent jitter. At most 5 restarts in 300 s. Counter resets after 60 s stable. Time checks use ranges because of the jitter.

- `kill -9` of the gateway pid: the log shows a restart within the jittered first backoff. The new pid differs, `ps` shows the same executable path as the supervisor, and `GET /api/health` returns 200 again. The aggregate state passes through `degraded` and back to `ready`.
- Killing the gateway six times in a row: the sixth exit leaves the state `error` and no further spawn. The supervisor logs the reason and the count.
- After 60 s of stability the counter resets (checked with one more kill that restarts normally).
- A requested stop (SIGTERM to the supervisor) causes no restart.
- A gateway that exits during startup before `ready` counts against the same budget.
- `pnpm run build && pnpm run test` exit 0.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Replace the single `spawn` in the supervisor with a per-service lifecycle object that owns spawn, exit handling and the restart budget. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md), [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md).
- [ ] Implement backoff, jitter, window and reset as one Zod-validated constants object (decision D2). Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md), [OQ11](../roadmap/PROPOSAL.md#open-questions).
- [ ] On respawn, resend the web bundle to the gateway from the supervisor memory. Source: [REQ-NET-03](../requirements/06-web-gateway-https-pwa.md).
- [ ] Distinguish a crash from a requested stop, so `stopping` never restarts. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Set the aggregate state to `degraded` while a restart is pending and to `error` when the budget is exhausted. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Observe a restart on macOS arm64 and in Debian bookworm images (arm64 and amd64), with the outputs above. Source: [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md) (subset), POC-1c inherited item.
- [ ] Record which port-in-use behaviour appears: a gateway that cannot bind exits and burns the budget. Port-busy handling for the user belongs to POC-5 ([REQ-DESK-05](../requirements/09-desktop-tauri.md)). Source: not verified.
- [ ] Publish `docs/results/POC-02e-bounded-restart.md` with the measured delays. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `apps/sea-runtime/src/supervisor/service-lifecycle.ts` | manual: no CLI writes it. If it is a Nest provider, `pnpm dlx nest generate` may create the shell; run `--help` first |
| `apps/sea-runtime/src/supervisor/supervisor.service.ts` | manual edit of a CLI-generated file |
| `docs/results/POC-02e-bounded-restart.md`, `docs/meta.toon` | manual; regeneration command |

---

## Risks

[Back to navigation](#navigation)

- The values are proposals. A 30 s cap can exceed what Tauri wants to show. They are constants until POC-3 gives a config singleton.
- The restart of a service killed by `SIGKILL` leaves its child processes, if any, behind. Descendant cleanup is 2f.
- Jitter makes tests flaky if they assert exact times. Assert ranges.
- A restart loop on a bad port burns the budget in under a minute and ends in `error`. Wanted, but the user message belongs to POC-5.
- Memory: the supervisor holds the web bundle for the process lifetime (already true since POC-1f).

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| [OQ11](../roadmap/PROPOSAL.md#open-questions) | restart, backoff and readiness values | proposed; decision D2 |
