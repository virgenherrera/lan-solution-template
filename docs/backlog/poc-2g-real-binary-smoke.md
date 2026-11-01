<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2g-real-binary-smoke.md
title: "POC-2g Real-binary smoke test and Linux run"
type: backlog
summary: "Backlog slice 2g of POC-2: smoke test of the packaged binary on macOS and Linux, including libatomic."
related[4]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2e-bounded-restart.md,docs/backlog/poc-2f-coordinated-shutdown.md,docs/results/POC-01c-Result.md
status: current
updated: 2026-10-31
-->

# POC-2g: Real-binary smoke test and Linux run

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2f-coordinated-shutdown.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-2h-result-and-adr.md)

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
| Slice | 2g of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~300 authored lines (ASSUMPTION) |
| Depends on | [2e](poc-2e-bounded-restart.md), [2f](poc-2f-coordinated-shutdown.md) |
| Branch (decided, D1) | `minor/poc-02-supervisor`, one commit or commit group per slice, one draft PR for all of POC-2 |
| Result page | `docs/results/POC-02g-real-binary-smoke.md` |
| Requirements | REQ-RUNTIME-08, REQ-TEST-07 |
| Acceptance criteria | AC-28, AC-29, AC-11 (with 2c) |

---

## Goal

[Back to navigation](#navigation)

Source: [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md), [REQ-TEST-07](../requirements/11-nx-quality-testing.md).

- One scripted check runs the packaged binary with no arguments and verifies the whole supervisor story: same `process.execPath` in gateway role, ready, HTTP, child death, bounded restart, unknown role, orderly shutdown, one copy of the runtime.
- The same check runs in Debian bookworm containers (arm64 and amd64). It closes the `libatomic` items from POC-1c.
- It is the "APP over a real artifact" of REQ-TEST-07, not Tauri E2E (that is POC-5, [REQ-TEST-08](../requirements/11-nx-quality-testing.md)).

---

## Requirements

[Back to navigation](#navigation)

- [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md): the APP smoke list. The "no additional copies in the installer" part is checked here on `artifacts/`; the Tauri installer part moves to POC-5.
- [REQ-TEST-07](../requirements/11-nx-quality-testing.md): supervisor subset only. Migrations, vectors, TLS and PWA parts wait for POC-3 and POC-4.
- [REQ-TEST-01](../requirements/11-nx-quality-testing.md), [REQ-TEST-02](../requirements/11-nx-quality-testing.md): no unit or integration suite; the `@app` tag is a selector only.

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-28](../requirements/11-nx-quality-testing.md): no arguments starts `sea-runtime` standalone with only `api-gateway` enabled.
- [AC-29](../requirements/11-nx-quality-testing.md): same `process.execPath` in gateway role, unknown role rejected, one binary.

Observable:

- The smoke script exits 0 on macOS arm64 and prints one line per check. A deliberately broken binary (scratch) makes it exit non-zero at the right check.
- It asserts: the child executable path equals the supervisor executable path; `GET /api/health` 200; `GET /` 200 (index); `GET /api/nope` 404; `--service nope` exit 2; child kill leads to a restart; the restart budget ends in `error`; `SIGTERM` leaves no process; `artifacts/` holds one executable per target and no `node`.
- Linux arm64 and amd64 in `debian:bookworm-slim` with `--init`: the same script passes with `libatomic1` installed. Without it, the run fails with the `libatomic.so.1` message, which the page quotes. The deb and rpm `depends` from the Tauri hardening chore are the packaged answer.
- Per D5, the script is a post-step of `package`; `pnpm run package` exits 0 and the root order of [REQ-BUILD-02](../requirements/11-nx-quality-testing.md) is unchanged.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Write the smoke script in `tools/scripts/` with `node:child_process` and `fetch`, cross-platform APIs only. Source: [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md), [REQ-TEST-07](../requirements/11-nx-quality-testing.md).
- [ ] Wire it as a post-step of the `sea-runtime` `package` target (decision D5) and tag it `@app`. Source: [REQ-TEST-02](../requirements/11-nx-quality-testing.md), [REQ-BUILD-02](../requirements/11-nx-quality-testing.md).
- [ ] Cover the same-executable check, readiness, HTTP, unknown role, child death and bounded restart, and shutdown with the process-tree assertion. Source: [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md).
- [ ] Check the absence of extra runtime copies in `artifacts/`. The installer part is POC-5. Source: [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md), [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md).
- [ ] Run it in Debian bookworm images, arm64 and amd64 (emulated), with and without `libatomic1`. Source: [REQ-TEST-09](../requirements/11-nx-quality-testing.md); POC-1c inherited item.
- [ ] Repeat the POC-1f request table on Linux (the 1f run was macOS arm64 only). Source: [REQ-NET-05](../requirements/06-web-gateway-https-pwa.md); POC-1f risk.
- [ ] State what the filter does: the script runs in `package`, so `pnpm test -- --filter @app` still has no consumer. The first consumer is POC-4. Source: [REQ-TEST-03](../requirements/11-nx-quality-testing.md), [AC-34](../requirements/11-nx-quality-testing.md).
- [ ] Leave the Windows run as a documented command, not executed. Source: [REQ-TEST-09](../requirements/11-nx-quality-testing.md).
- [ ] Publish `docs/results/POC-02g-real-binary-smoke.md`. Source: [REQ-TEST-07](../requirements/11-nx-quality-testing.md).

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `tools/scripts/smoke-sea.ts` | manual: no CLI generates a smoke script |
| `apps/sea-runtime/package.json` | `pnpm pkg set` for the `package` target command; Nx targets have no generator |
| `docs/results/POC-02g-real-binary-smoke.md`, `docs/meta.toon` | manual; regeneration command |
| Docker images and commands | `docker run` of `debian:bookworm-slim` and `node:26.13.0-bookworm`, as in POC-1c. Nothing is installed on the host |

---

## Risks

[Back to navigation](#navigation)

- Where the smoke runs is open (D5). If the human prefers `test` depending on `package`, the root order of [REQ-BUILD-02](../requirements/11-nx-quality-testing.md) changes.
- amd64 runs under emulation. Timing values and the code-cache warning can differ from native. Label them.
- A fixed port can collide on a busy host. Use a free port per run or document the fixed one.
- The smoke is not a Tauri test. Do not report it as AC-18 or AC-20 evidence.
- Not verified: Windows and any distribution other than Debian bookworm.

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| [OQ7](../roadmap/PROPOSAL.md#open-questions) | closing rule per OS: Linux in Docker closes gateway smoke tests only | proposed |
