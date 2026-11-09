<!-- toon-meta
fmt: TOON
doc: docs/backlog/td-windows-linux-distribution.md
title: "Technical debt: Windows and Linux distribution"
type: backlog
summary: "Technical debt left by POC-8: Windows and Linux installers, matrix runs, client mode, signing and installer follow-ups. Nothing verified."
ids[0]:
related[8]: docs/results/POC-08-Result.md,docs/architecture/adr/ADR-011-macos-installer-and-install-time-trust.md,docs/backlog/README.md,docs/backlog/poc-8-msi-matrix-versioning.md,docs/backlog/poc-9-ci-cd-releases.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/results/POC-05-Result.md
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
| Status | Technical debt. No design. Every item is not verified. Updated 2026-11-04 with what POC-8 left on macOS: see [POC-08-Result](../results/POC-08-Result.md). |
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

- [ ] Windows and Linux installer step. `tools-cli installer-build` prints `installer not implemented on <os>` and exits 0 outside macOS; each OS needs its own builder.
- [ ] MSI with WiX. Includes the spike of [OQ16](../roadmap/PROPOSAL.md#open-questions): per-machine, dual or per-user, and the install folder.
- [ ] MSI credential dialog (hidden property plus `MsiHiddenProperties`, deferred custom action). It is the fallback of decision 13 while the wizard of [ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md) is not proven on Windows.
- [ ] `certutil` for the trust store and ACLs on the install folder (Windows).
- [ ] `.deb` and `.rpm` packages. The way each distribution trusts a CA is not designed.
- [ ] The platform matrix on Windows x64 and on Linux with WebKitGTK ([REQ-TEST-09](../requirements/11-nx-quality-testing.md)).
- [ ] Black-box smoke of native installers on each OS.
- [ ] Client mode: the shell loads its UI from a gateway on another machine ([OQ17](../roadmap/PROPOSAL.md#open-questions), pending since POC-5).
- [ ] CI matrix with `tauri-apps/tauri-action` in [POC-9](poc-9-ci-cd-releases.md). From memory of the agent; check the official documentation when the work starts.
- [ ] macOS x64: the row is `pending` in the [platform matrix](../architecture/platform-matrix.md). It needs an Intel host or a native runner.
- [ ] Apple signing and notarization of the `.pkg` and the host. The `.pkg` is unsigned and Gatekeeper behaviour is not verified ([ADR-011](../architecture/adr/ADR-011-macos-installer-and-install-time-trust.md)).
- [ ] Real run of the macOS installer: install with the Installer, the order of the two components, that an unticked trust box omits the component, the `sudo -u` branch, `add-trusted-cert` from a `postinstall`, a real `uninstall.sh` as root, and AC-18 with the trusted CA. The recipe is in the [POC-8 result](../results/POC-08-Result.md#recipe-for-the-human); the human runs it.
- [ ] Black-box smoke of the macOS installer without instrumentation (install, start, navigate, close, uninstall), as a repeatable check and not only a recipe.
- [ ] Mitigation of A1 of the U4b recheck: a CA pair planted in `certs/` before `postinstall` becomes the trust anchor. Options in [ADR-011](../architecture/adr/ADR-011-macos-installer-and-install-time-trust.md#consequences). Needs a human decision.
- [ ] A `ca.crt` swapped for a FIFO could hang the trust script (A5 of the U4b recheck). Not probed with a real FIFO.
- [ ] Smaller installer advisories: the trust script reads `TMPDIR` from the Installer; the refusal of `/`, `/usr` and `/System` relies on the template check and not on an explicit list; `._*` AppleDouble entries in the `.pkg` payload; a reinstall with no console user leaves a partial state.
- [ ] Mitigations proposed for the 7 advisories of the U5 verifier (A1 to A7 in the [POC-8 result](../results/POC-08-Result.md#advisories-still-open)). Proposals only, none implemented:
  - A1: escape the path or use `pgrep -x` with the resolved path; treat `pgrep` exit above 1 as an error.
  - A2: make the recovery idempotent: if `remove-trusted-cert` fails, still try `delete-certificate` and check the listing.
  - A3: abort instead of deleting `ca.key` when there is no anchor and the keychain holds the CA.
  - A4: accept and document the race, or check the owner of `certs/` just before the removal.
  - A5: allow-list for the base (owner root, not writable by others) instead of a deny list.
  - A6: print a message when `rm -f` fails (`|| { warn ...; FAILED=1; }`).
  - A7: remove `._*` entries from the payload (`COPYFILE_DISABLE=1` did not remove them in U3); verify the plist name in a real run.
- [ ] A8 of U5 (found by the final QC): an earlier run of `uninstall.sh` left a `lan-untrust.*` directory with a copy of the public `ca.crt` in the system temporary directory. Cause not verified; failure path not identified. The script already has `trap cleanup EXIT`. Proposal, not implemented: also trap `INT TERM HUP`. See [A8](../results/POC-08-Result.md#advisories-still-open).
- [ ] CI validation of branch names and a guard against duplicate tags ([REQ-VERSION-02](../requirements/11-nx-quality-testing.md)), the highest-impact bump when several PRs merge before a release, and GitHub Release. They belong to [POC-9](poc-9-ci-cd-releases.md), which is on hold.
- [ ] The `display` that the `package` step of `desktop` needs in CI: the E2E opens a window.
- [ ] Optional guard `cargo check --target <triple>` for the other platforms. It needs `rustup target add`, which is an installation. It needs the approval of the human.

---

## Out of scope

[Back to navigation](#navigation)

- The macOS installer itself. It is in [POC-8](poc-8-msi-matrix-versioning.md). Its result and limits are in the [POC-8 result](../results/POC-08-Result.md); the follow-ups are the macOS items above.

---

## Not verified

[Back to navigation](#navigation)

- Every item above. No Windows or Linux run exists.
- That the listed tools (WiX, `certutil`, `tauri-action`) fit this repository.
