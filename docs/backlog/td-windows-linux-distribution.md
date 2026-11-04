<!-- toon-meta
fmt: TOON
doc: docs/backlog/td-windows-linux-distribution.md
title: "Technical debt: Windows and Linux distribution"
type: backlog
summary: "Technical debt moved out of POC-8: Windows and Linux installers, matrix runs, client mode and signing. Nothing verified."
ids[0]:
related[6]: docs/backlog/README.md,docs/backlog/poc-8-msi-matrix-versioning.md,docs/backlog/poc-9-ci-cd-releases.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/results/POC-05-Result.md
status: proposed
updated: 2026-11-04
-->

# Technical debt: Windows and Linux distribution

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Origin](#origin)
- [Debt items](#debt-items)
- [Out of scope](#out-of-scope)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Technical debt. No design. Every item is not verified. |
| Appetite | none |
| Depends on | a way to run Windows and Linux natively (a VM or a native runner, [OQ7](../roadmap/PROPOSAL.md#open-questions)) |
| Requirements | none new. No id is invented here. The items relate to REQ-TEST-09 and REQ-TEST-10 as written in [POC-8](poc-8-msi-matrix-versioning.md). |
| Origin | [POC-8](poc-8-msi-matrix-versioning.md), cut to macOS by the human on 2026-11-04 |

---

## Origin

[Back to navigation](#navigation)

The human cut POC-8 to macOS on 2026-11-04. Quote, verbatim, in Spanish: "lo demas queda como TD o otro feat (cuando ya yengamos manera de correr en dichos os". The code is still written for the three platforms; only macOS runs locally.

---

## Debt items

[Back to navigation](#navigation)

Every item is not verified.

- [ ] Windows and Linux installer step. `tools/scripts/installer-build.ts` prints `installer not implemented on <os>` and exits 0 outside macOS; each OS needs its own builder.
- [ ] MSI with WiX. Includes the spike of [OQ16](../roadmap/PROPOSAL.md#open-questions): per-machine, dual or per-user, and the install folder.
- [ ] MSI credential dialog (hidden property plus `MsiHiddenProperties`, deferred custom action). It is the fallback of decision 13 while the wizard of [ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md) is not proven on Windows.
- [ ] `certutil` for the trust store and ACLs on the install folder (Windows).
- [ ] `.deb` and `.rpm` packages. The way each distribution trusts a CA is not designed.
- [ ] The platform matrix on Windows x64 and on Linux with WebKitGTK ([REQ-TEST-09](../requirements/11-nx-quality-testing.md)).
- [ ] Black-box smoke of native installers on each OS.
- [ ] Client mode: the shell loads its UI from a gateway on another machine ([OQ17](../roadmap/PROPOSAL.md#open-questions), pending since POC-5).
- [ ] CI matrix with `tauri-apps/tauri-action` in [POC-9](poc-9-ci-cd-releases.md). From memory of the agent; check the official documentation when the work starts.
- [ ] Optional guard `cargo check --target <triple>` for the other platforms. It needs `rustup target add`, which is an installation. It needs the approval of the human.

---

## Out of scope

[Back to navigation](#navigation)

- The macOS installer. It is in [POC-8](poc-8-msi-matrix-versioning.md).
- Apple signing and notarization are macOS debt, tracked in the POC-8 result.

---

## Not verified

[Back to navigation](#navigation)

- Every item above. No Windows or Linux run exists.
- That the listed tools (WiX, `certutil`, `tauri-action`) fit this repository.
