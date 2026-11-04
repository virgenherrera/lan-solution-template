<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-8-msi-matrix-versioning.md
title: "POC-8 MSI credential dialog, platform matrix and lockstep versioning"
type: backlog
summary: "Backlog item for the platform matrix, lockstep versioning and the macOS installer. Windows and Linux are technical debt."
related[8]: docs/backlog/README.md,docs/backlog/poc-7-auth-roles.md,docs/backlog/poc-9-ci-cd-releases.md,docs/backlog/persistence-system.md,docs/backlog/td-windows-linux-distribution.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/results/POC-05-Result.md
status: current
updated: 2026-11-04
-->

# POC-8: MSI credential dialog, platform matrix and lockstep versioning

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-7-auth-roles.md) | [Up](README.md) | [Next](poc-9-ci-cd-releases.md)

## Navigation

- [At a glance](#at-a-glance)
- [Scope of this delivery](#scope-of-this-delivery)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [U3 result: the macOS installer](#u3-result-the-macos-installer)
- [U4a result: the executable creates the per-install TLS files](#u4a-result-the-executable-creates-the-per-install-tls-files)
- [Moved to technical debt](#moved-to-technical-debt)
- [Pitch items without a source id](#pitch-items-without-a-source-id)
- [Open questions](#open-questions)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Opened 2026-11-04 on `chore/poc-08-matrix-versioning`. macOS only. Nothing built yet. |
| Appetite | 2 weeks, big batch. This delivery is a part of it. |
| Depends on | POC-5 (merged in PR #21). POC-7 only for the first admin ([ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md), proposed). |
| Branch | `chore/poc-08-matrix-versioning` |
| Requirements | 7 REQ ids (the pitch). This delivery covers REQ-VERSION-01, 02 and 03, and the macOS part of REQ-SEA-06. |
| Acceptance criteria | AC-21, AC-25, AC-33 |
| Technical debt | [Windows and Linux distribution](td-windows-linux-distribution.md) |

---

## Scope of this delivery

[Back to navigation](#navigation)

The human cut the scope on 2026-11-04. Quotes are verbatim, in Spanish.

- Human: "Poc ahora mismo solo podemos calodarlo all the way down en mac (solo eso haremos ahora mismo, lo demas queda como TD o otro feat (cuando ya yengamos manera de correr en dichos os".
- Human: "que te parece si desarrollamos pensando siempte en las 3 plataformas, y en local solo testeamos mac". The agent reads this as: write code and docs for the three platforms, and run and verify on macOS only.

| In scope | Decided by |
|---|---|
| Lockstep versioning: REQ-VERSION-01, REQ-VERSION-02 and REQ-VERSION-03. | Pitch (human-approved roadmap) |
| The platform matrix, documented. macOS is `verified` only where a command ran natively. Every other row is `not verified`. | Agent (delegated), from REQ-TEST-09 and REQ-TEST-10 |
| REQ-SEA-06: only the rule "validate per platform", and only on macOS. | Agent (delegated by the human) |
| macOS installer as a `.pkg` with an installation assistant. | Agent (delegated). The human asked for an "asistente de instalacion". The format is to confirm by spike M0. |
| The assistant creates `config/config.json` ([OQ24](../roadmap/PROPOSAL.md#open-questions)). | Human, 2026-11-04 |
| The `postinstall` script installs `ca.crt` into the trust store, with the consent of the user ([ADR-009](../architecture/adr/ADR-009-desktop-process-model.md), [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md)). | Agent (delegated), from ADR-009 D13 |
| Uninstall script: removes `config.json` and ALWAYS keeps the SQLite database. The data belongs to the user. | Human, 2026-11-04. Quotes: "no (pero si la db (en caso de ser sqlite))" and "los datos de la db le pertenecen al usuario". |
| Server mode only. Client mode stays pending ([OQ17](../roadmap/PROPOSAL.md#open-questions)). | Human, 2026-11-04 |
| Apple signing and notarization: technical debt, not verified. | Agent (delegated) |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning), cut to macOS by the scope above.

- Record native results per OS. A macOS pass does not imply Windows or Linux.
- Add lockstep versioning that also reaches `tauri.conf.json` and `Cargo.toml`.
- Ship a macOS installer with an assistant, on the principle that the code is written for the three platforms and tested on macOS.

| No-gos |
|---|
| No cross-OS claims without native verification. |
| Docker does not replace native installer validation. |
| No CI workflow yet ([POC-9](poc-9-ci-cd-releases.md) is on hold). |
| No Windows or Linux installer in this delivery. |
| The uninstall never deletes the SQLite database. |

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
- [REQ-SEA-06](../requirements/10-node-sea-distribution.md) ([traceability](../requirements/traceability.md) maps it to POC-8)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-21](../requirements/11-nx-quality-testing.md)
- [AC-25](../requirements/11-nx-quality-testing.md)
- [AC-33](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-8-msi-credential-dialog-platform-matrix-and-lockstep-versioning). The pitch also lists NFR-PORT-01 and NFR-TRUTH-01 (not defined in `docs/requirements`, so not linked). Only macOS can close them in this delivery.

---

## Tasks

[Back to navigation](#navigation)

The working document with routes and evidence is kept outside the repository. Task ids: M0 (spike), U1 to U7 (units).

- [ ] M0: spike on the `.pkg` format on macOS. Check `pkgbuild`, `productbuild`, a `distribution.xml` with an assistant (Welcome, Conclusion, a custom panel is not verified), `postinstall` and `preinstall` scripts, and how an assistant can write `config/config.json`. Decide the format. Output: a short result in `POC-08-Result`. Source: the human asked for an "asistente de instalacion"; the format is an agent decision. Not verified. No REQ or AC id.
- [ ] U1: lockstep versioning. An Nx Release fixed group ([OQ10](../roadmap/PROPOSAL.md#open-questions)); `release:version` syncs `tauri.conf.json` and `Cargo.toml` and validates all version references; a reproducible changelog; the branch-to-SemVer table with the exemption for `docs/*` and `chore/*`. Today the manifests disagree (`package.json` files carry `0.0.1`, `tauri.conf.json` and `Cargo.toml` carry `0.1.0`). Risk: release tooling. Source: [REQ-VERSION-01](../requirements/11-nx-quality-testing.md), [REQ-VERSION-02](../requirements/11-nx-quality-testing.md), [REQ-VERSION-03](../requirements/11-nx-quality-testing.md), [AC-25](../requirements/11-nx-quality-testing.md)
- [ ] U2: platform matrix and local scripts. Declare the OS list ([OQ4](../roadmap/PROPOSAL.md#open-questions)); record `verified`, `pending` or `blocked` per row ([OQ7](../roadmap/PROPOSAL.md#open-questions)); macOS is `verified` only where the command ran natively; every other row says `not verified`. REQ-SEA-06: the rule "validate per platform", macOS only. Source: [REQ-TEST-09](../requirements/11-nx-quality-testing.md), [REQ-TEST-10](../requirements/11-nx-quality-testing.md), [REQ-SEA-06](../requirements/10-node-sea-distribution.md), [AC-21](../requirements/11-nx-quality-testing.md), [AC-33](../requirements/11-nx-quality-testing.md)
- [x] U3 (commit `0872f84`, built and inspected, NOT installed): the `.pkg` with an assistant, and `config/config.json`. The assistant defines the install path, which is the base directory, and creates `config/config.json` there. The installer ships no `config.default.json`. Depends on M0. Source: [OQ24](../roadmap/PROPOSAL.md#open-questions), [REQ-CFG-05](../requirements/04-configuration.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md)
- [ ] U4: `ca.crt` in the `postinstall`, with consent. The installer generates the CA and installs it into the trust store only after the user consents; the tray item `Trust CA...` stays as a repair path. Risk: security (trust store). Depends on U3. Source: [ADR-009](../architecture/adr/ADR-009-desktop-process-model.md) D13, [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md)
- [ ] U5: uninstall script. It removes `config.json` and ALWAYS keeps the SQLite database. Depends on U3. Source: decision of the human, 2026-11-04.
- [ ] U6: installer smoke on macOS. Steps that need `sudo` are run by the human from a recipe. Depends on U3, U4 and U5. Source: [REQ-TEST-09](../requirements/11-nx-quality-testing.md), [AC-21](../requirements/11-nx-quality-testing.md)
- [ ] U7: publish `POC-08-Result` and the ADR for the installer, under `docs/`. Last. Source: [REQ-TEST-10](../requirements/11-nx-quality-testing.md), [AC-21](../requirements/11-nx-quality-testing.md)

---

## U3 result: the macOS installer

[Back to navigation](#navigation)

The `desktop:package` target now ends with `node tools/scripts/installer-build.ts` (REQ-ECO-06: no new public script). On macOS it runs `pkgbuild` and `productbuild` ([installer-macos.ts](../../tools/scripts/installer-macos.ts)) and writes `apps/desktop/src-tauri/target/release/lan-solution-desktop-<version>-<triple>.pkg`. The version is the lockstep `package.json` version and the identifier is `identifier` from `tauri.conf.json`. On any other OS it prints `installer not implemented on <os>` and exits 0, so the native package stays valid ([debt](td-windows-linux-distribution.md)). Resources live in `apps/desktop/installer/macos/`.

Decisions of the agent (delegated):

- Base location, option c of the M0 spike: no `.app`. The host (`app`) and the sidecar (`sea-runtime`) sit in the ROOT of the install directory, so the base is the directory of the executable ([ADR-007](../architecture/adr/ADR-007-persistence-system.md)). The default location is `/usr/local/lan-solution`; the Distribution XML marks it with `customLocation`.
- `config/config.json` is created by `postinstall` from `config/config.example.json` (shipped in the payload, copied from `libs/shared-core`) only when it does not exist. A reinstall never overwrites it ([REQ-CFG-05](../requirements/04-configuration.md)).
- `data/` and `logs/` are created by `postinstall`, not shipped, and owned by the console user (the owner of `/dev/console`, `stat -f%Su /dev/console`). The payload holds no certificate, key or user data. `certs/` and the CA belong to U4.
- `postinstall` is a shell script, an exception to TypeScript: the `.pkg` format runs scripts directly and the user's Mac has no node. It writes only inside the install directory.

Verified on macOS 27.2 arm64, 2026-11-04 (build and inspection only):

- `pnpm exec nx run desktop:package --skip-nx-cache --output-style=static`: exit 0, 3 passing in the E2E, about 2m 15s, `.pkg` of 49 118 585 bytes.
- `xar -tf`: one component package (Bom, Payload, Scripts, PackageInfo), `Resources/welcome.html`, `Distribution`. `pkgutil --payload-files`: `app`, `sea-runtime` and `config/config.example.json` in the root; no `bin/`, no `.app`. `PackageInfo`: `auth="root"`, `install-location="/usr/local/lan-solution"`, `postinstall`.
- `Distribution`: welcome pane (English), server mode choice with the default location, no CA choice. `pkgutil --check-signature`: no signature.
- `postinstall` run WITHOUT root in a temporary directory with `$2` = destination: creates `config.json` from the template, `data/`, `logs/`; a second run keeps an edited `config.json` and `data/`; it exits 1 with a clear message when the template or the destination is missing. `sh -n`: exit 0. shellcheck is not installed.

Recipe for the human (needs `sudo`; the agent did not run it):

```sh
P=apps/desktop/src-tauri/target/release/lan-solution-desktop-0.1.0-aarch64-apple-darwin.pkg
open "$P"                                   # Installer.app; or: sudo installer -pkg "$P" -target /
ls -l /usr/local/lan-solution /usr/local/lan-solution/data   # app, sea-runtime, config/, data/ and logs/ owned by you
echo '{"edited":true}' > /usr/local/lan-solution/config/config.json
sudo installer -pkg "$P" -target /          # reinstall
cat /usr/local/lan-solution/config/config.json   # must still print the edited content
# reverse
sudo rm -rf /usr/local/lan-solution
sudo pkgutil --forget com.virgenherrera.lansolution
```

---

## U4a result: the executable creates the per-install TLS files

[Back to navigation](#navigation)

The `sea-runtime` executable has one new operation, `--generate-certs`. The installer (U4b) calls it, so each install gets its own CA and leaf. No CA or key travels in the payload.

Operations of the executable and their exit codes:

| Invocation | What it does | Exit codes |
|---|---|---|
| no argument | starts the supervisor | the supervisor's own code |
| `--service <id>` | starts one registered service | the service's own code; `2` for an unknown, empty or repeated id |
| `--generate-certs` | creates `<base>/certs/{ca.crt, ca.key, leaf.crt, leaf.key}` and exits | `0` done; `1` error (config missing or invalid, CA unusable); `2` when combined with `--service` |

Behaviour:

- The base is the directory of the executable ([ADR-007](../architecture/adr/ADR-007-persistence-system.md)). The operation reads `<base>/config/config.json` for `tls.extraNames`.
- It runs the same generator as `pnpm dev:certs` (`generateTlsIdentity` in `libs/shared-core/src/tls/generate.ts`). Profile, validity and file modes are those of [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md): `certs/` 0700, keys 0600.
- It never replaces an existing CA. A second run keeps `ca.crt` and `ca.key` and reissues only a missing, expiring or renamed leaf. A CA that is unusable, or a lone `ca.crt` or `ca.key`, exits 1 and changes nothing.
- It prints the paths, `CA created|kept` and the CA SHA-256 fingerprint (for the installer to record). It never prints key material.
- The code is `libs/shared-core/src/tls/certs-command.ts`. It is not exported from `shared-core/tls`, so the gateway still cannot create certificates. The generated SEA entry imports it by path; the dispatcher (`libs/service-registry`) returns the new target kind `generate-certs`.

Verified on macOS 27.2 arm64, 2026-11-04, with the real `sea-runtime` binary copied into a temporary base:

- Files and modes as above; `openssl verify -CAfile ca.crt leaf.crt` prints OK; the CA has `CA:TRUE`; the leaf SAN has `localhost`, `127.0.0.1`, `::1`, the host name, the LAN addresses and the `extraNames` added to `config.json`; the printed fingerprint equals `openssl x509 -fingerprint -sha256`.
- A second run keeps `ca.key`, `ca.crt` and `leaf.crt` byte for byte; a changed `extraNames` reissues only the leaf.
- The supervisor of that base reaches `ready` and `curl --cacert certs/ca.crt https://127.0.0.1:8443/api/health` returns `{"status":"ready"}`; no process is left after `SIGTERM`.
- Against the previous binary: `--service nope` still exits 2 with the same message, and `pnpm dev:certs` yields the same certificate profile.

The dispatcher list in [ADR-002](../architecture/adr/ADR-002-single-sea-portability.md) ("no argument means supervisor mode, `--service <id>` starts one service, anything else exits 2") and the sentence in [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md) that the packaged install gets its files from the installer were not edited. Both need a human decision (U7).

---

## Moved to technical debt

[Back to navigation](#navigation)

These pitch items need a Windows or Linux run that does not exist today. They are listed, with nothing verified, in [Windows and Linux distribution](td-windows-linux-distribution.md):

- The MSI with WiX, the OQ16 spike and the MSI credential dialog.
- `certutil` and ACLs on Windows.
- `.deb` and `.rpm` packages.
- The matrix on Windows x64 and on Linux with WebKitGTK.
- Black-box smoke of native installers.
- Client mode.
- The CI matrix in POC-9.
- Apple signing and notarization.

---

## Pitch items without a source id

[Back to navigation](#navigation)

These pitch items carry no REQ or AC id. They are not tasks:

- MSI dialog for the initial credential: a hidden property plus `MsiHiddenProperties`. A deferred custom action computes the hash. Design, not verified. Moved to [technical debt](td-windows-linux-distribution.md). Key storage: plain files under `<base>/certs` ([ADR-008](../architecture/adr/ADR-008-tls-trust-model.md#storage)).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions. No open question blocks.

| OQ | Topic | Status |
|---|---|---|
| [OQ5](../roadmap/PROPOSAL.md#open-questions) | first-run setup wizard versus MSI dialog | decided (human decision 13); recommendation proposed in ADR-010; the MSI part is technical debt |
| [OQ4](../roadmap/PROPOSAL.md#open-questions) | OS targets follow Tauri 2 | decided (human decision 15) |
| [OQ16](../roadmap/PROPOSAL.md#open-questions) | Windows MSI scope, per-machine or per-user | proposed; moved to technical debt |
| [OQ17](../roadmap/PROPOSAL.md#open-questions) | install-time choice: server mode or client mode | decided (human, 2026-11-04): server mode now, client mode pending |
| [OQ24](../roadmap/PROPOSAL.md#open-questions) | where the installer assistant creates `config/config.json` | decided (human, 2026-11-04) |
| [OQ7](../roadmap/PROPOSAL.md#open-questions) | minimum verified-OS set | decided (human) |
| [OQ8](../roadmap/PROPOSAL.md#open-questions) | TLS crypto library and key storage | decided (agent, 2026-11-03, delegated): built-ins of Node suffice, see [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md) |
| [OQ10](../roadmap/PROPOSAL.md#open-questions) | Nx release group membership | proposed |

---

## Not verified

[Back to navigation](#navigation)

- A real install of the `.pkg`: the assistant screens, the install location pane (the choice is not user-disabled in the XML, whether the Installer lets the user change the folder is not verified), the root run of `postinstall`, the `chown` to the console user, and the reinstall keeping `config.json`. See the recipe in [U3 result](#u3-result-the-macos-installer).
- Gatekeeper behaviour of the unsigned `.pkg`.
- Windows, Linux, Apple signing and notarization. Nothing here was run on them.
