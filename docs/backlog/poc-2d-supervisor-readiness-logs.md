<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2d-supervisor-readiness-logs.md
title: "POC-2d Supervisor readiness, logs and aggregate state"
type: backlog
summary: "Backlog slice 2d of POC-2: IPC control channel, readiness timeout, per-service logs, aggregate state and gateway health."
related[4]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2c-assembler-registry-build.md,docs/backlog/poc-2e-bounded-restart.md,docs/results/POC-01f-web-from-memory.md
status: current
updated: 2026-10-31
-->

# POC-2d: Supervisor readiness, logs and aggregate state

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2c-assembler-registry-build.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-2e-bounded-restart.md)

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
| Status | Done in commit `97b5f01` on `minor/poc-02-supervisor`, see [result](../results/POC-02d-readiness-logs.md) |
| Slice | 2d of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~380 authored lines (ASSUMPTION); the largest slice, split off first if it grows |
| Depends on | [2c](poc-2c-assembler-registry-build.md) |
| Branch (decided, D1) | `minor/poc-02-supervisor`, one commit or commit group per slice, one draft PR for all of POC-2 |
| Result page | `docs/results/POC-02d-readiness-logs.md` |
| Requirements | REQ-RUNTIME-05, REQ-RUNTIME-07, REQ-NET-01 |
| Acceptance criteria | none new. Serves AC-28 |

---

## Goal

[Back to navigation](#navigation)

Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md), [OQ11](../roadmap/PROPOSAL.md#open-questions).

- Every service child gets the same control channel (stdio IPC with `serialization: 'advanced'`, already used for the web bundle in POC-1f) and announces `ready` when it is listening.
- The supervisor keeps a typed registry of enabled services, a readiness timeout, per-service log prefixes and one aggregate state: `starting`, `ready`, `degraded`, `error`, `stopping`.
- The `api-gateway` `/api/health` answers from that state.

| No-gos |
|---|
| No fake `auth-ms` ([REQ-RUNTIME-05](../requirements/09-desktop-tauri.md)). |
| The supervisor opens no port ([REQ-RUNTIME-02](../requirements/09-desktop-tauri.md)). |
| No file logging yet. Log files need the POC-3 root. |

---

## Requirements

[Back to navigation](#navigation)

- [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md): registry, readiness timeout, health, logs per service, aggregate state.
- [REQ-RUNTIME-07](../requirements/09-desktop-tauri.md): each process keeps its own state; internal services listen on loopback or a local socket. Pitch id with no task; assigned here for the loopback rule. The migration owner and lock go to [POC-3](poc-3-config-sqlite-vector.md).
- [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md): `NodeAdapter`, no Express or Fastify, `/api` health.

---

## Acceptance criteria

[Back to navigation](#navigation)

Values come from [OQ11](../roadmap/PROPOSAL.md#open-questions) (proposed, decision D2): readiness timeout 30 s, graceful stop 10 s.

- Packaged run: the supervisor log shows `starting`, then `ready` after the gateway `ready` message. `GET /api/health` returns 200 and a body that names the aggregate state.
- A gateway forced to start late (a scratch build with a delayed listen) shows `starting` on stdout, then `ready`. One that never listens reaches `error` after the readiness timeout and the supervisor exits non-zero. Record the observed timing.
- Every log line of a child carries the service id prefix. A line from the supervisor carries `supervisor`.
- The gateway process listens on the loopback address in this slice (checked with `lsof -iTCP -sTCP:LISTEN`). The LAN binding of [REQ-NET-06](../requirements/06-web-gateway-https-pwa.md) stays in POC-4.
- Resident memory of supervisor and gateway of the packaged run is recorded (the POC-1f copy risk).
- `pnpm run build && pnpm run test` exit 0.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Define the control-channel messages as Zod schemas in the 2b registry package: `ready`, `state`, `shutdown` (used by 2f), `web-bundle` (exists). Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md), [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md).
- [ ] Spawn every service with the IPC channel, not only the web-receiving gateway. Keep the POC-1f `--web ipc` path unchanged. Source: [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md), [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Send `ready` from the gateway after `listen` resolves. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Add the readiness timeout and the aggregate state machine in the supervisor. Add the startup order from `dependsOn`; with one enabled service it is exercised by a pure function only (not verified with two services). Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Prefix child stdout and stderr per service and keep stdout line-oriented. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Publish the aggregate state to Tauri: one JSON line per state change on the supervisor stdout. This is a design; the Tauri side is POC-5 and not verified as a pattern. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- [ ] Make `/api/health` report the aggregate state (the supervisor forwards it to the gateway over IPC). The unauthenticated body stays minimal; whether detail may be exposed is not verified. Source: [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md).
- [ ] Bind the gateway to loopback in the supervised run. Source: [REQ-RUNTIME-07](../requirements/09-desktop-tauri.md).
- [ ] Record the 10 s web receive timeout against a slow start and the resident memory. Source: [REQ-NET-04](../requirements/06-web-gateway-https-pwa.md).
- [ ] Publish `docs/results/POC-02d-readiness-logs.md`. Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `libs/service-registry/src/control-channel.ts` | manual: no CLI writes message schemas |
| `apps/sea-runtime/src/supervisor/*.ts` | manual edit of a CLI-generated file; new files by hand. If a Nest provider is split out, `pnpm dlx nest generate service supervisor/state` may write the class; run `--help` first |
| `apps/api-gateway/src/main.ts`, `health.controller.ts`, `server-config.ts` | manual edit of CLI-generated files |
| `docs/results/POC-02d-readiness-logs.md`, `docs/meta.toon` | manual; regeneration command |

Delete any `*.spec.ts` a generator creates in the same commit ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)).

---

## Risks

[Back to navigation](#navigation)

- Tauri sidecar output is stdout and exit events, not Node IPC. The stdout JSON line is a design for POC-5 and may change. Not verified.
- The readiness of a service that never announces `ready` can only be judged by timeout. The 30 s value is a proposal.
- Dependency ordering cannot be proven with one service. The result page says so.
- Loopback binding conflicts with the LAN requirement of [REQ-NET-06](../requirements/06-web-gateway-https-pwa.md) if left in. The binding is a supervised-run default, and POC-4 sets the LAN value.
- A health body that names internal state leaks information on a LAN. Keep it minimal until POC-7.

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| [OQ11](../roadmap/PROPOSAL.md#open-questions) | readiness and health values | proposed; decision D2 |
