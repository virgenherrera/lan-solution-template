<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-5-tauri-sidecar-desktop-shell.md
title: "POC-5 Tauri desktop shell with SEA sidecar"
type: backlog
summary: "Backlog item for the Tauri desktop shell with SEA sidecar."
related[3]: docs/backlog/README.md,docs/backlog/poc-4-https-gateway-angular-pwa.md,docs/backlog/poc-6-postgresql-adapter-parity.md
status: current
updated: 2026-10-30
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
| Status | Cycle 2 (planned) |
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

- [ ] Pending spike (2 days at most, inside the appetite; [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)). POC-5 owns it. Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions). No REQ or AC id.
  - Goal: research and define the first-run setup wizard path. The user creates the first real admin at install time. The wizard replaces the seeded dev super user.
  - Inputs: the list in Decision Log item 13. None is a decision; security claims are not verified.
    - Loopback-only setup mode.
    - Single-use token over Tauri IPC or terminal.
    - Host and Origin checks.
    - Attempt limit.
    - Permanent deactivation once the DB has an admin.
    - 15+ character policy with blocklist.
    - CLI alternative.
  - Output: the chosen path in `POC-05-Result` and in ADR-006 (auth mechanism). It states whether the wizard replaces or complements the MSI dialog.
  - Circuit breaker: no clear path after 2 days. Then keep the MSI dialog on Windows. Keep the CLI `setup` command on Linux and macOS.
  - Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)
- [ ] Ship the SEA as an `externalBin` sidecar, one per target triple. Source: [REQ-DESK-01](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Pass the resolved root to the SEA sidecar as an absolute path (the host may). Design, not verified as a Tauri pattern. The cwd of the sidecar child is not verified: check it here. Source: [REQ-DESK-02](../requirements/09-desktop-tauri.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [ ] Tauri only starts, monitors and stops the supervisor. Quit terminates the process tree and checks for orphans on the host OS. Source: [REQ-DESK-02](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md), [AC-30](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Design the tray UI in this POC. Until then, document only common options: start, stop, open UI, quit and an autostart checkbox. Source: [REQ-DESK-03](../requirements/09-desktop-tauri.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Tray with starting, ready and error states, Open UI, Quit. Closing the window hides it to the tray. Source: [REQ-DESK-03](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Autostart at OS login is opt-in and off by default. The user enables it with a checkbox in the tray menu. The app persists the choice ([OQ12](../roadmap/PROPOSAL.md#open-questions), decided by the human). Source: [REQ-DESK-04](../requirements/09-desktop-tauri.md), [OQ12](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Single instance, port-busy handling, orphan handling and crash recovery. Source: [REQ-DESK-05](../requirements/09-desktop-tauri.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Keep the gateway reachable from the LAN while the window is hidden. Source: [REQ-DESK-06](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Restrict IPC capabilities; no shell or sidecar privileges for the LAN-served frontend. Source: [REQ-SEC-05](../requirements/07-security.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] The WebView loads the gateway origin. Source: [AC-18](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Tauri installs `ca.crt` into the OS trust store with explicit consent. Key storage per OS: [OQ8](../roadmap/PROPOSAL.md#open-questions). Source: [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md), [OQ8](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Run native E2E with `@wdio/tauri-service` on an instrumented build; the commercial installer excludes it. Source: [REQ-TEST-08](../requirements/11-nx-quality-testing.md), [AC-20](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Order Tauri `build`/`package` after SEA. Source: [REQ-ECO-06](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))
- [ ] Publish `POC-05-Result` and `ADR-005` (desktop process model) under `docs/`. Source: [REQ-DESK-02](../requirements/09-desktop-tauri.md), [AC-03](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar))

---

## Pitch items without a source id

[Back to navigation](#navigation)

These pitch items carry no REQ or AC id. They are not tasks:

- Linux and macOS first-run setup: the wizard from the spike ([decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)). On Windows the MSI credential dialog (POC-8) is the fallback. The spike decides whether the wizard replaces it ([pitch](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar)). No REQ or AC id in the pitch.

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions. No open question blocks. OQ12 is decided by the human.

| OQ | Topic | Status |
|---|---|---|
| [OQ5](../roadmap/PROPOSAL.md#open-questions) | first-run setup without MSI | decided (human decision 13): pending spike |
| [OQ8](../roadmap/PROPOSAL.md#open-questions) | TLS crypto library and key storage | decided (human decision 14): pending spike |
| [OQ12](../roadmap/PROPOSAL.md#open-questions) | autostart default | decided (human) |
| [OQ17](../roadmap/PROPOSAL.md#open-questions) | install-time choice: server mode or client mode | proposed |
