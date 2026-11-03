<!-- toon-meta
fmt: TOON
doc: docs/backlog/service-status-indicator.md
title: "Service status indicator"
type: backlog
summary: "Backlog item: per-service status owned by the supervisor and published as stdout events; tray and web UI consumers are open."
related[5]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/backlog/README.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md,docs/results/POC-02d-readiness-logs.md,docs/results/POC-02e-bounded-restart.md
status: current
updated: 2026-11-03
-->

# Service status indicator

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Problem](#problem)
- [Done](#done)
- [Consumers](#consumers)
- [Non-goals](#non-goals)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Supervisor side done: the `status` event on the sidecar stdout ([ADR-006](../architecture/adr/ADR-006-sidecar-status-contract.md)). Tray and web UI consumers are open. No POC id |
| Origin | Human request: "un estado (estilo xampp) mostrando que el servicio esta iniciando o reiniciando" |
| Depends on | [POC-2d](poc-2d-supervisor-readiness-logs.md) and [POC-2e](poc-2e-bounded-restart.md), both done |
| Natural consumer | [POC-5](poc-5-tauri-sidecar-desktop-shell.md) tray |
| Requirements | None cite this item. No REQ or AC id |

---

## Problem

[Back to navigation](#navigation)

The aggregate state alone hides a restart: a pending restart collapses into `degraded` (`libs/service-registry/src/aggregate-state.ts`). `/api/health` serves only the aggregate and is gateway-owned, so it cannot answer while the gateway restarts. The second point is inferred from the code. A measurement of the gap: not verified.

---

## Done

[Back to navigation](#navigation)

- Per-service status exists: `starting`, `ready`, `restarting`, `failed` (`libs/service-registry/src/states.ts`).
- The supervisor owns the surface. On each aggregate change it writes one `status` event to stdout: the aggregate state plus one status per service (`StatusPublisher`). The sidecar contract is stdout NDJSON `status` events, stderr logs, stdin NDJSON commands ([ADR-006](../architecture/adr/ADR-006-sidecar-status-contract.md)).
- No HTTP listener. The loopback `GET /status` endpoint and `supervisor.statusPort` of PR #13 were removed on 2026-11-03 by human decision: nothing consumes them and Tauri reads stdio. A future web UI needs a new transport decision.
- `/api/health` stays gateway-owned and unchanged. The aggregate set is unchanged, so a restart still shows as `degraded` there.

---

## Consumers

[Back to navigation](#navigation)

| Consumer | Today | Need |
|---|---|---|
| Tray in [POC-5](poc-5-tauri-sidecar-desktop-shell.md) | Tray states `starting`, `ready`, `error` ([REQ-DESK-03](../requirements/09-desktop-tauri.md)). Rabbit hole A5: whether the tray shows `degraded` | Show `restarting` and per-service state. Needs a decision on A5 |
| Web UI | None | A status view that survives a gateway restart. No endpoint exists. Needs a transport decision |

---

## Non-goals

[Back to navigation](#navigation)

- No change to the restart policy of [POC-2e](poc-2e-bounded-restart.md).
- No log viewer. Logs stay on the supervisor stderr.
- No start, stop or restart buttons. This item shows state only.
- No new requirement or acceptance criterion.
- No tray design. [POC-5](poc-5-tauri-sidecar-desktop-shell.md) owns it.

---

## Open questions

[Back to navigation](#navigation)

| Topic | Status |
|---|---|
| Web UI transport | open |
| Does the tray show `degraded` (rabbit hole A5 of [PROPOSAL](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar)) | open |
| Per-service `stopping` state | not verified whether needed |
| Owner POC | open |
