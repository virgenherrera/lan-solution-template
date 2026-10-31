<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2-single-sea-runtime-supervisor.md
title: "POC-2 Single SEA and runtime supervisor"
type: backlog
summary: "Backlog item for a single SEA build and the runtime supervisor."
related[3]: docs/backlog/README.md,docs/backlog/poc-1e-hardening-desktop-skeleton.md,docs/backlog/poc-3-config-sqlite-vector.md
status: current
updated: 2026-10-31
-->

# POC-2: Single SEA and runtime supervisor

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-1e-hardening-desktop-skeleton.md) | [Up](README.md) | [Next](poc-3-config-sqlite-vector.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Cycle 1 (planned) |
| Appetite | 2 weeks, big batch, highest uncertainty |
| Depends on | POC-1 (slices 1a to 1e) |
| Branch | `minor/poc-02-sea-supervisor` |
| Requirements | 13 REQ ids |
| Acceptance criteria | AC-11, AC-28, AC-29, AC-30, AC-31 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor).

- Prove one SEA per platform. POC-1c already packages a dummy Nest app as a SEA with a minimal `tools/scripts/compile-sea.ts`; this POC extends it.
- The SEA bundles the dispatcher, sea-runtime and api-gateway.
- It relaunches itself by role under a supervisor.

| No-gos |
|---|
| No fake `auth-ms`. |
| No postject without a documented need. |
| No second executable. |
| No Express or Fastify. |
| No SPA yet. |

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor)):

- [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md)
- [REQ-RUNTIME-02](../requirements/09-desktop-tauri.md)
- [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md)
- [REQ-RUNTIME-04](../requirements/09-desktop-tauri.md)
- [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md)
- [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md)
- [REQ-RUNTIME-07](../requirements/09-desktop-tauri.md)
- [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md)
- [REQ-SEA-01](../requirements/10-node-sea-distribution.md)
- [REQ-SEA-02](../requirements/10-node-sea-distribution.md)
- [REQ-SEA-03](../requirements/10-node-sea-distribution.md)
- [REQ-TEST-07](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-11](../requirements/11-nx-quality-testing.md)
- [AC-28](../requirements/11-nx-quality-testing.md)
- [AC-29](../requirements/11-nx-quality-testing.md)
- [AC-30](../requirements/11-nx-quality-testing.md)
- [AC-31](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor). [AC-11](../requirements/11-nx-quality-testing.md) (partial: no Node install on the host). [AC-30](../requirements/11-nx-quality-testing.md) (host OS only, others pending). [AC-31](../requirements/11-nx-quality-testing.md) (registry design only). [REQ-TEST-07](../requirements/11-nx-quality-testing.md) is the supervisor subset.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Extend `tools/scripts/compile-sea.ts` (the minimal script is written in [POC-1c](poc-1c-sea-build.md)) to bundle the dispatcher, sea-runtime and api-gateway. Keep native `node --build-sea`, no postject. Source: [REQ-SEA-01](../requirements/10-node-sea-distribution.md), [REQ-SEA-02](../requirements/10-node-sea-distribution.md), [REQ-SEA-03](../requirements/10-node-sea-distribution.md), [AC-11](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Build a Zod-validated dispatcher and a closed service registry; unknown roles are rejected. Source: [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md), [AC-29](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] `sea-runtime` uses `createApplicationContext(RuntimeModule)` with no HTTP listener; running the SEA without arguments starts it. Source: [REQ-RUNTIME-02](../requirements/09-desktop-tauri.md), [AC-28](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Design the closed service registry. A future `apps/auth-ms` needs only its bootstrap, dependencies and Nx target. No Tauri sidecar is added. This is registry design only; no `auth-ms` is built. Source: [AC-31](../requirements/11-nx-quality-testing.md), [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] The supervisor respawns `process.execPath --service api-gateway`, never `node` from PATH. Source: [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md), [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md), [AC-29](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Extend the `api-gateway` of [POC-1b](poc-1b-nest-apps.md) (NodeAdapter, dummy health endpoint) to an `/api` health endpoint under the supervisor. Source: [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Shutdown: stdio IPC, then a timeout, then a force-kill of descendants. No orphans remain on the host OS. Source: [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md), [AC-30](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Add a readiness timeout, per-service logs and a bounded restart (values are proposed in [OQ11](../roadmap/PROPOSAL.md#open-questions)). Source: [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md), [OQ11](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Run the supervisor under systemd and under launchd. Verify the initial cwd of the gateway service process. Today this is not verified. Expected output: the cwd value per launcher, recorded in `POC-02-Result`. Root resolution must not use the cwd as the anchor. Source: [decision 11](../roadmap/PROPOSAL.md#decision-log), [OQ1](../roadmap/PROPOSAL.md#open-questions). No REQ or AC id. ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Add a real-binary smoke test. Source: [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md), [REQ-TEST-07](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))
- [ ] Publish `POC-02-Result` and `ADR-002` (single-SEA portability decision) under `docs/`. Source: [AC-11](../requirements/11-nx-quality-testing.md), [AC-29](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor))

Ids with no pitch task (none invented): [REQ-RUNTIME-04](../requirements/09-desktop-tauri.md), [REQ-RUNTIME-07](../requirements/09-desktop-tauri.md).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

| OQ | Topic | Status |
|---|---|---|
| [OQ11](../roadmap/PROPOSAL.md#open-questions) | restart/backoff/readiness values | proposed |
