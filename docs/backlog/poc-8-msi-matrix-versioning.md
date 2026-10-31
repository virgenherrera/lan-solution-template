<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-8-msi-matrix-versioning.md
title: "POC-8 MSI credential dialog, platform matrix and lockstep versioning"
type: backlog
summary: "Backlog item for MSI credential dialog platform matrix and lockstep versioning."
related[3]: docs/backlog/README.md,docs/backlog/poc-7-auth-roles.md,docs/backlog/poc-9-ci-cd-releases.md
status: current
updated: 2026-10-30
-->

# POC-8: MSI credential dialog, platform matrix and lockstep versioning

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-7-auth-roles.md) | [Up](README.md) | [Next](poc-9-ci-cd-releases.md)

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
| Status | Cycle 3 (planned) |
| Appetite | 2 weeks, big batch |
| Depends on | POC-5, POC-7 |
| Branch | `chore/poc-08-matrix-versioning` |
| Requirements | 7 REQ ids |
| Acceptance criteria | AC-21, AC-25, AC-33 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning).

- Record native results per OS.
- A macOS pass does not imply Windows or Linux.
- Add lockstep versioning that also reaches `tauri.conf.json` and `Cargo.toml`.
- Add an MSI dialog for the initial credential, as the fallback of decision 13.

| No-gos |
|---|
| No cross-OS claims without native verification. |
| Docker does not replace native installer validation. |
| No CI workflow yet. |

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning)):

- [REQ-VERSION-01](../requirements/11-nx-quality-testing.md)
- [REQ-VERSION-02](../requirements/11-nx-quality-testing.md)
- [REQ-VERSION-03](../requirements/11-nx-quality-testing.md)
- [REQ-TEST-09](../requirements/11-nx-quality-testing.md)
- [REQ-TEST-10](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-CFG-05](../requirements/04-configuration.md)
- [REQ-SEA-05](../requirements/10-node-sea-distribution.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-21](../requirements/11-nx-quality-testing.md)
- [AC-25](../requirements/11-nx-quality-testing.md)
- [AC-33](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning). The pitch also lists NFR-PORT-01 and NFR-TRUTH-01 (not defined in `docs/requirements`, so not linked).

---

## Tasks

[Back to navigation](#navigation)

- [ ] Dependency task, first: wait for the POC-5 spike on the first-run setup wizard. POC-8 consumes its result and depends on it. Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions). No REQ or AC id.
  - Decide whether the wizard replaces or complements the MSI credential dialog.
  - Inputs: the POC-5 spike output and the list in Decision Log item 13. Security claims are not verified.
  - Output: the decision recorded in `POC-08-Result` and in ADR-006 (auth mechanism).
  - No own spike time. If the POC-5 spike hit its 2-day breaker, keep the MSI credential dialog on Windows.
  - Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)
- [ ] Spike, first task, blocking: test WiX and Tauri capabilities for per-machine, dual and per-user installs. Then decide the scope ([OQ16](../roadmap/PROPOSAL.md#open-questions)). Source: [OQ16](../roadmap/PROPOSAL.md#open-questions). No REQ or AC id.
- [ ] The MSI installs per-machine (draft) into Program Files, and installing needs an administrator. It offers no per-user install in the first version. The autostart checkbox appears unchecked. Source: [decision 11](../roadmap/PROPOSAL.md#decision-log), [OQ16](../roadmap/PROPOSAL.md#open-questions), [OQ12](../roadmap/PROPOSAL.md#open-questions) (OQ16 is a draft; OQ12 is decided by the human). No REQ or AC id.
- [ ] Declare the OS list that POC-1 records from the Tauri 2 prerequisites page in the platform matrix ([decision 15](../roadmap/PROPOSAL.md#decision-log), [OQ4](../roadmap/PROPOSAL.md#open-questions)). Native verification depends on VM availability ([OQ7](../roadmap/PROPOSAL.md#open-questions)). Until a native run exists, each row stays `not verified`. Source: [AC-33](../requirements/11-nx-quality-testing.md), [AC-21](../requirements/11-nx-quality-testing.md)
- [ ] The MSI installs `config.default.json` read-only under `<InstallDir>`. It ships no managed `config.json`. Source: [REQ-SEA-05](../requirements/10-node-sea-distribution.md), [REQ-CFG-05](../requirements/04-configuration.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [ ] On a native Windows run, check that first start creates `config.json` under the resolved root. Check that secrets under that root have restricted permissions. This POC decides which folder the root resolves to on Windows. The ACL recipe is not verified. Source: [REQ-CFG-05](../requirements/04-configuration.md), [decision 11](../roadmap/PROPOSAL.md#decision-log), [OQ16](../roadmap/PROPOSAL.md#open-questions)
- [ ] Verify (not verified): the exact WiX v4 directory and scope names. Verify the effect of `NeverOverwrite` or `Permanent` on a key file. Verify the ACLs of the folders under the root. Decide delete or keep of an edited `config.json` on uninstall. Source: [decision 11](../roadmap/PROPOSAL.md#decision-log), [OQ16](../roadmap/PROPOSAL.md#open-questions). No REQ or AC id.
- [ ] Add a smoke test per OS. It proves that the first admin created by the setup wizard (or the MSI fallback) can log in. It proves that no default exists. Source: [REQ-TEST-09](../requirements/11-nx-quality-testing.md), [AC-21](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning))
- [ ] Run the root ECO commands natively on each declared OS/arch. Record a result matrix (verified, pending or blocked). Minimum verified-OS set is proposed in [OQ7](../roadmap/PROPOSAL.md#open-questions); Windows targets in [OQ4](../roadmap/PROPOSAL.md#open-questions) (decision 15). Source: [REQ-TEST-10](../requirements/11-nx-quality-testing.md), [AC-21](../requirements/11-nx-quality-testing.md), [AC-33](../requirements/11-nx-quality-testing.md), [OQ7](../roadmap/PROPOSAL.md#open-questions), [OQ4](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning))
- [ ] Configure an Nx Release fixed group (membership proposed in [OQ10](../roadmap/PROPOSAL.md#open-questions)). Source: [REQ-VERSION-01](../requirements/11-nx-quality-testing.md), [AC-25](../requirements/11-nx-quality-testing.md), [OQ10](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning))
- [ ] `release:version` syncs `tauri.conf.json` and `Cargo.toml`, validates all version references and builds a reproducible changelog. Source: [REQ-VERSION-03](../requirements/11-nx-quality-testing.md), [AC-25](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning))
- [ ] Validate the branch-to-SemVer mapping, including its branch table and the exemption rule. Source: [REQ-VERSION-02](../requirements/11-nx-quality-testing.md), [AC-25](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning))
- [ ] Publish `Platform-Matrix` and `POC-08-Result` under `docs/`. Source: [REQ-TEST-10](../requirements/11-nx-quality-testing.md), [AC-21](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning))

---

## Pitch items without a source id

[Back to navigation](#navigation)

These pitch items carry no REQ or AC id. They are not tasks:

- MSI dialog for the initial credential: a hidden property plus `MsiHiddenProperties`. A deferred custom action computes the hash ([pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning)). Design, not verified. No REQ or AC id in the pitch besides the per-OS smoke test above. Key storage per OS: [OQ8](../roadmap/PROPOSAL.md#open-questions).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions. No open question blocks. OQ16 is a draft. A spike decides it.

| OQ | Topic | Status |
|---|---|---|
| [OQ5](../roadmap/PROPOSAL.md#open-questions) | first-run setup wizard versus MSI dialog | decided (human decision 13): pending spike |
| [OQ4](../roadmap/PROPOSAL.md#open-questions) | OS targets follow Tauri 2 | decided (human decision 15) |
| [OQ16](../roadmap/PROPOSAL.md#open-questions) | Windows MSI scope, per-machine or per-user | proposed |
| [OQ17](../roadmap/PROPOSAL.md#open-questions) | install-time choice: server mode or client mode | proposed |
| [OQ7](../roadmap/PROPOSAL.md#open-questions) | minimum verified-OS set | proposed |
| [OQ8](../roadmap/PROPOSAL.md#open-questions) | TLS crypto library and key storage | decided (human decision 14): pending spike |
| [OQ10](../roadmap/PROPOSAL.md#open-questions) | Nx release group membership | proposed |
