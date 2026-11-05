<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-5-tauri-sidecar-desktop-shell.md
title: "POC-5 Tauri desktop shell with SEA sidecar"
type: backlog
summary: "Backlog item for the Tauri desktop shell with SEA sidecar."
related[10]: docs/results/POC-05-Result.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/architecture/adr/ADR-010-first-run-admin-setup.md,docs/backlog/log-service-otel-grpc.md,docs/backlog/README.md,docs/backlog/poc-4-https-gateway-angular-pwa.md,docs/backlog/poc-6-postgresql-adapter-parity.md,docs/backlog/service-status-indicator.md,docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-008-tls-trust-model.md
status: current
updated: 2026-11-04
-->

# POC-5: Tauri desktop shell with SEA sidecar

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-4-https-gateway-angular-pwa.md) | [Up](README.md) | [Next](poc-6-postgresql-adapter-parity.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Pitch items without a source id](#pitch-items-without-a-source-id)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Done and merged in PR #21 (squash `35525d9`), server mode, verified on macOS only. Client mode pending. See [POC-05-Result](../results/POC-05-Result.md) |
| Appetite | 2 weeks, big batch |
| Depends on | POC-2, POC-4 |
| Branch | `minor/poc-05-tauri-sidecar` |
| Requirements | 11 REQ ids |
| Acceptance criteria | AC-03, AC-18, AC-20, AC-30 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar).

- The desktop host starts, monitors and stops the SEA supervisor.
- It shows state in the tray.
- The gateway stays reachable from the LAN while the window is hidden.

| No-gos |
|---|
| Tauri hosts no second SPA and no public port. |
| No WDIO plugin in the product. |
| No cross-OS claims without native runs. |

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar)):

- [REQ-DESK-01](../requirements/09-desktop-tauri.md)
- [REQ-DESK-02](../requirements/09-desktop-tauri.md)
- [REQ-DESK-03](../requirements/09-desktop-tauri.md)
- [REQ-DESK-04](../requirements/09-desktop-tauri.md)
- [REQ-DESK-05](../requirements/09-desktop-tauri.md)
- [REQ-DESK-06](../requirements/09-desktop-tauri.md)
- [REQ-SEC-05](../requirements/07-security.md)
- [REQ-TEST-08](../requirements/11-nx-quality-testing.md)
- [REQ-ECO-06](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md)
- [REQ-TEST-09](../requirements/11-nx-quality-testing.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-03](../requirements/11-nx-quality-testing.md)
- [AC-18](../requirements/11-nx-quality-testing.md)
- [AC-20](../requirements/11-nx-quality-testing.md)
- [AC-30](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar). [AC-30](../requirements/11-nx-quality-testing.md) (host OS). [REQ-ECO-06](../requirements/11-nx-quality-testing.md) is Tauri after SEA.

---

## Tasks

[Back to navigation](#navigation)

- [x] Spike done (2 days at most, inside the appetite; [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)). POC-5 owns it. Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions). No REQ or AC id.
  - Goal: research and define the first-run setup wizard path. The user creates the first real admin at install time. The wizard replaces the seeded dev super user.
  - Inputs: the list in Decision Log item 13. None is a decision; security claims are not verified.
    - Loopback-only setup mode.
    - Single-use token over Tauri IPC or terminal.
    - Host and Origin checks.
    - Attempt limit.
    - Permanent deactivation once the DB has an admin.
    - 15+ character policy with blocklist.
    - CLI alternative.
  - Output: the recommendation is in [ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md) as a proposal, not decided. Five questions stay open for the human, among them whether the wizard replaces the MSI dialog. No code was written.
  - Circuit breaker: no clear path after 2 days. Then keep the MSI dialog on Windows. Keep the CLI `setup` command on Linux and macOS.
  - Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)
- [x] Ship the SEA as an `externalBin` sidecar, one per target triple (commit `f8eb47c`; macOS aarch64 only). Source: [REQ-DESK-01](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md)
- [x] Spawn the sidecar and read the base directory from the executable directory ([ADR-007](../architecture/adr/ADR-007-persistence-system.md#one-base-directory)): no root argument. Wire the host side of the sidecar contract of [ADR-006](../architecture/adr/ADR-006-sidecar-status-contract.md): `status` events on stdout, logs on stderr, `shutdown` command on stdin (EOF also shuts down), exit codes 0, 1, 2. Verified on macOS (commit `f8eb47c`); Windows and Linux not verified. Source: [REQ-DESK-02](../requirements/09-desktop-tauri.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [x] Tauri only starts, monitors and stops the supervisor. Quit terminates the process tree and checks for orphans on the host OS (commit `f8eb47c`; macOS only). Source: [REQ-DESK-02](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md), [AC-30](../requirements/11-nx-quality-testing.md)
- [x] Design the tray UI in this POC (commit `e38407f`): status, Open UI, Start, Stop, Start at login, Trust CA..., Quit. Not seen by a person: icon, menu, tooltip and checkbox are not verified. Source: [REQ-DESK-03](../requirements/09-desktop-tauri.md)
- [x] Tray with starting, ready and error states (fed by the `status` events), Open UI, Quit. Closing the window hides it to the tray. Source: [REQ-DESK-03](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md)
- [x] Autostart at OS login is opt-in and off by default. The user enables it with a checkbox in the tray menu. The app persists the choice ([OQ12](../roadmap/PROPOSAL.md#open-questions), decided by the human). Source: [REQ-DESK-04](../requirements/09-desktop-tauri.md), [OQ12](../roadmap/PROPOSAL.md#open-questions)
- [x] Single instance, port-busy handling, orphan handling and crash recovery (commit `e38407f`). Source: [REQ-DESK-05](../requirements/09-desktop-tauri.md)
- [x] Keep the gateway reachable from the LAN while the window is hidden (commit `e38407f`). Source: [REQ-DESK-06](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md)
- [x] Restrict IPC capabilities (commit `3567f89`); no shell or sidecar privileges for the LAN-served frontend. Source: [REQ-SEC-05](../requirements/07-security.md)
- [x] The WebView loads the gateway origin (commit `3567f89`; the real page load is not verified because the OS does not trust `ca.crt` in the test). Source: [AC-18](../requirements/11-nx-quality-testing.md)
- [x] Tauri installs `ca.crt` into the OS trust store with explicit consent (commits `3567f89` and `e7a1aa4`; the real keychain install is not verified). Key storage: plain files under `<base>/certs` ([ADR-008](../architecture/adr/ADR-008-tls-trust-model.md#storage)). Source: [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md), [OQ8](../roadmap/PROPOSAL.md#open-questions)
- [x] Run native E2E with `@wdio/tauri-service` on an instrumented build (commit `210cb1f`); the commercial installer excludes it. The E2E runs inside the `package` step of `apps/desktop` (`pnpm exec nx run desktop:package`), before the Tauri bundle, and there is no public `e2e` target (REQ-ECO-01). The `package` step now opens a window; a CI run needs a display, not verified. macOS verified; Windows and Linux not verified. The installer black-box smoke without instrumentation that REQ-TEST-08 asks for does not exist yet (POC-8) and is not done. The WebView page load is not covered: the run never trusts `ca.crt` in the OS. Source: [REQ-TEST-08](../requirements/11-nx-quality-testing.md), [AC-20](../requirements/11-nx-quality-testing.md)
- [x] Order Tauri `build`/`package` after SEA (commit `f8eb47c`). Source: [REQ-ECO-06](../requirements/11-nx-quality-testing.md)
- [ ] Pending (investigate and implement later, not in this branch): client mode. The shell loads the UI from a running gateway on another machine (a URL on the LAN with a port) and runs with no IPC capabilities for that origin. Open: WKWebView accepting the server certificate after `ca.crt` is installed, and how a client gets `ca.crt` (no gateway endpoint serves it today, [device trust guide](../architecture/device-trust-guide.md)). Not verified. Source: [OQ17](../roadmap/PROPOSAL.md#open-questions), [REQ-SEC-05](../requirements/07-security.md)
- [x] Publish [POC-05-Result](../results/POC-05-Result.md) and [ADR-009](../architecture/adr/ADR-009-desktop-process-model.md) (desktop process model) under `docs/`. Source: [REQ-DESK-02](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md)

---

## Pitch items without a source id

[Back to navigation](#navigation)

These pitch items carry no REQ or AC id. They are not tasks:

- Linux and macOS first-run setup: the wizard from the spike ([decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)). On Windows the MSI credential dialog (POC-8) is the fallback. The spike decides whether the wizard replaces it. No REQ or AC id in the pitch.

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions. Related idea, outside this POC: [log service](log-service-otel-grpc.md). No open question blocks. OQ12 is decided by the human.

| OQ | Topic | Status |
|---|---|---|
| [OQ5](../roadmap/PROPOSAL.md#open-questions) | first-run setup without MSI | decided (human decision 13); the spike is done and its recommendation is proposed in [ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md), not decided |
| [OQ8](../roadmap/PROPOSAL.md#open-questions) | TLS crypto library and key storage | decided (agent, 2026-11-03, delegated): built-ins of Node suffice, see [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md) |
| [OQ12](../roadmap/PROPOSAL.md#open-questions) | autostart default | decided (human) |
| [OQ17](../roadmap/PROPOSAL.md#open-questions) | install-time choice: server mode or client mode | decided (human, 2026-11-04): server mode now, client mode pending |
