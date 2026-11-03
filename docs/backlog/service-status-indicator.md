<!-- toon-meta
fmt: TOON
doc: docs/backlog/service-status-indicator.md
title: "Service status indicator"
type: backlog
summary: "Proposed backlog item: a supervisor-owned, XAMPP-style per-service status surface that stays up while services restart."
related[4]: docs/backlog/README.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md,docs/results/POC-02d-readiness-logs.md,docs/results/POC-02e-bounded-restart.md
status: proposed
updated: 2026-11-02
-->

# Service status indicator

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Problem](#problem)
- [Goal](#goal)
- [States](#states)
- [Consumers](#consumers)
- [Non-goals](#non-goals)
- [Risks](#risks)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Proposed. Not scheduled. No POC id yet. |
| Origin | Human request: "un estado (estilo xampp) mostrando que el servicio esta iniciando o reiniciando" |
| Depends on | [POC-2d](poc-2d-supervisor-readiness-logs.md) and [POC-2e](poc-2e-bounded-restart.md), both done |
| Natural consumer | [POC-5](poc-5-tauri-sidecar-desktop-shell.md) tray |
| Requirements | None cite this item. No REQ or AC id is invented. |
| Branch | not decided |

---

## Problem

[Back to navigation](#navigation)

The human wants a status like the XAMPP control panel. It shows per service whether it is starting or restarting.

Today the repository offers one aggregate state, not a per-service view.

- The aggregate set is `starting`, `ready`, `degraded`, `error`, `stopping` (`libs/service-registry/src/states.ts:4-10`).
- A pure function derives it from the service statuses (`libs/service-registry/src/aggregate-state.ts:8-13`).
- A pending restart collapses into `degraded` (`aggregate-state.ts:11`). The reader cannot tell a restart from a failure with one ready service.
- The supervisor prints one JSON line per aggregate change and forwards it to the children (`apps/sea-runtime/src/supervisor/supervisor.service.ts:88-94`).
- `/api/health` returns only the aggregate state (`apps/api-gateway/src/health.controller.ts:9-13`; [POC-02d result](../results/POC-02d-readiness-logs.md), line 28).
- The gateway serves `/api/health`. The gateway is a supervised child that the supervisor respawns ([POC-02e result](../results/POC-02e-bounded-restart.md), line 59).
- So `/api/health` cannot answer while the gateway restarts. The human states this. It is inferred from the code above. A measurement of the gap: not verified.

The human says this is not tech debt. The status surface needs a different owner.

---

## Goal

[Back to navigation](#navigation)

- Show per-service state in XAMPP style: starting, restarting, ready, degraded, error, stopping.
- The supervisor owns the surface. It keeps answering while any service, the gateway included, restarts.
- One source of truth feeds every consumer. No consumer derives state on its own.

How the supervisor exposes the surface is open. See [Open questions](#open-questions).

---

## States

[Back to navigation](#navigation)

Per-service status exists in code: `starting`, `ready`, `restarting`, `failed` (`states.ts:13-18`). The lifecycle sets `restarting` when it schedules a respawn (`apps/sea-runtime/src/supervisor/service-lifecycle.ts:83`).

| State | Today | Meaning for this item |
|---|---|---|
| `starting` | Aggregate and per service | Service spawned, no `ready` message yet. |
| `restarting` | Per service only. **New at aggregate level.** | A crash was seen. A respawn is pending or running inside the restart budget. |
| `ready` | Aggregate and per service | Service sent `ready`. |
| `degraded` | Aggregate only | At least one service failed while another is ready. |
| `error` | Aggregate only. Per service the word is `failed`. | Restart budget exhausted, or no service ready after a failure. |
| `stopping` | Aggregate only | Shutdown requested. No restart follows. |

- `restarting` is new in the aggregate set and in the public surface. Whether a per-service `stopping` is needed: not verified.
- Mapping `failed` to `error` per service is a naming proposal. Not verified.
- Adding a state changes `AGGREGATE_STATE` and the Zod schema in `control-channel.ts`. Consumers of `/api/health` and the JSON line see a new word. See [Risks](#risks).

---

## Consumers

[Back to navigation](#navigation)

| Consumer | Today | Need |
|---|---|---|
| Tray in [POC-5](poc-5-tauri-sidecar-desktop-shell.md) | Tray states `starting`, `ready`, `error` ([REQ-DESK-03](../requirements/09-desktop-tauri.md)). The pitch lists "Whether the tray shows a degraded state (A5)" as a rabbit hole. | Show `restarting` and per-service state. Needs a decision on A5. |
| Web UI | None. The UI is served by the gateway. | A status view. It must survive a gateway restart. How: not verified. |
| `/api/health` | Aggregate state only, served by the gateway. | Keep as is for liveness of the gateway. Whether it reads the new surface: open. |

---

## Non-goals

[Back to navigation](#navigation)

- No change to the restart policy of [POC-2e](poc-2e-bounded-restart.md): backoff, budget and `error` stay.
- No log viewer. Prefixed logs stay on the supervisor stdout.
- No start, stop or restart buttons. XAMPP has them. This item shows state only.
- No new requirement or acceptance criterion. This page proposes none.
- No tray design. [POC-5](poc-5-tauri-sidecar-desktop-shell.md) owns it.

---

## Risks

[Back to navigation](#navigation)

- A new state word reaches `/api/health`. The POC-02d result says nothing else reads it (line 93). Later consumers: not verified.
- If the supervisor serves the surface itself, it adds a listener to a process that has none today. Port and security impact: not verified.
- The unauthenticated body is minimal by design (`health.controller.ts:9`). Per-service detail may leak information. Exposure rules wait for POC-7.

---

## Open questions

[Back to navigation](#navigation)

| Topic | Status |
|---|---|
| Transport: extend the stdout JSON line, add an IPC query, or add a supervisor-owned local endpoint | open |
| Should `/api/health` stay gateway-owned or proxy the supervisor state | open |
| Does the web UI read the surface directly or through the gateway | open |
| Is `restarting` an aggregate state or only a per-service one | open |
| Does the tray show `degraded` ([PROPOSAL](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar), rabbit hole A5) | open |
| Which POC or cycle owns this item | open |
