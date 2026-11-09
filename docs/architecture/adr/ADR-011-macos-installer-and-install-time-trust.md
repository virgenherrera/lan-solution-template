<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-011-macos-installer-and-install-time-trust.md
title: "ADR-011 macOS installer and install-time trust"
type: architecture
summary: "How the macOS .pkg installs, creates a CA per installation, trusts it only with consent, and uninstalls. Not installed."
ids[0]:
related[10]: docs/results/POC-08-Result.md,docs/backlog/poc-8-msi-matrix-versioning.md,docs/backlog/td-windows-linux-distribution.md,docs/architecture/adr/ADR-002-single-sea-portability.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/architecture/overview.md,docs/standards/README.md,docs/roadmap/PROPOSAL.md
status: proposed
updated: 2026-11-09
-->

# ADR-011: macOS installer and install-time trust

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-002](ADR-002-single-sea-portability.md) | [ADR-007](ADR-007-persistence-system.md) | [ADR-008](ADR-008-tls-trust-model.md) | [ADR-009](ADR-009-desktop-process-model.md) | [POC-8 result](../../results/POC-08-Result.md) | [POC-8 backlog](../../backlog/poc-8-msi-matrix-versioning.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Decision](#decision)
- [Options rejected](#options-rejected)
- [Consequences](#consequences)
- [Proposed amendments to ADR-002 and ADR-008](#proposed-amendments-to-adr-002-and-adr-008)
- [Not verified](#not-verified)
- [Implementation status](#implementation-status)

## Status

Proposed, 2026-11-04. Built on `chore/poc-08-matrix-versioning`, macOS arm64 only. The `.pkg` was built and inspected. It was never installed, and the trust and uninstall scripts were never run as root. Evidence and limits: the [POC-8 result](../../results/POC-08-Result.md).

Each decision below carries its origin:

- **Human**: the human decided it on the date given, quoted from the work log.
- **Agent, under delegation**: the agent chose it while implementing, under the human's delegation. The human has not reviewed it. It becomes accepted when the human says so.

The number follows the files, not the roadmap. The [ADR index](../../roadmap/PROPOSAL.md#adr-index) and the POC-9 pitch name ADR-011 for the release flow; that ADR takes the next free number when POC-9 starts.

## Context

POC-8 was cut to macOS by the human. The installer needs an assistant ([OQ24](../../roadmap/PROPOSAL.md#open-questions)), a base directory next to the executable ([ADR-007](ADR-007-persistence-system.md#one-base-directory)), the process model of [ADR-009](ADR-009-desktop-process-model.md) (host and sidecar side by side, window on the gateway origin) and the TLS files of [ADR-008](ADR-008-tls-trust-model.md). [ADR-009](ADR-009-desktop-process-model.md) D13 left the first-run CA trust to this POC: the installer generates the CA and installs it with consent, and the tray item `Trust CA...` stays as a repair path. Server mode only ([OQ17](../../roadmap/PROPOSAL.md#open-questions), human, 2026-11-04).

Two facts from the M0 spike shaped the layout. Writing a new file into a `.app` invalidated its seal in `codesign --verify` (confirmed by QC for new files, not for an empty directory). The `.pkg` scripts do not run as the user: the metadata says `auth="root"`, but no `man` page states it (not verified).

## Decision

### D1. Scope is macOS; Windows and Linux are technical debt (Human)

The human decided on 2026-11-04: "Poc ahora mismo solo podemos calodarlo all the way down en mac (solo eso haremos ahora mismo, lo demas queda como TD o otro feat (cuando ya yengamos manera de correr en dichos os". Also: "que te parece si desarrollamos pensando siempte en las 3 plataformas, y en local solo testeamos mac". The code stays portable; only macOS arm64 ran. Debt: [Windows and Linux distribution](../../backlog/td-windows-linux-distribution.md).

### D2. The installation assistant creates `config/config.json` (Human)

The human decided on 2026-11-04 ([OQ24](../../roadmap/PROPOSAL.md#open-questions)): the assistant defines the install path, which is the base directory, and creates `config/config.json` there. The runtime never creates it ([REQ-CFG-05](../../requirements/04-configuration.md)).

### D3. Uninstall deletes `config.json` and always keeps the SQLite database (Human)

The human decided on 2026-11-04. Quotes: "no (pero si la db (en caso de ser sqlite))" and "los datos de la db le pertenecen al usuario". The uninstall script removes `config.json` and never opens, lists or removes `data/`.

### D4. Format: a `.pkg` with no `.app`, the base next to the executable (Agent, under delegation)

The package is built with `pkgbuild` and `productbuild` and a Distribution XML. The host (`app`) and the sidecar (`sea-runtime`) sit in the root of one install directory, so the base is the directory of the executable and [ADR-007](ADR-007-persistence-system.md) and [ADR-009](ADR-009-desktop-process-model.md) D3 and D4 stay as written. The default is `/usr/local/lan-solution`, marked with `customLocation` so the user may choose another. That the Installer lets the user change it is not verified. The payload holds `app`, `sea-runtime`, `uninstall.sh` and `config/config.example.json`. It holds no certificate, key or user data.

### D5. The console user owns `data/` and `logs/` (Agent, under delegation)

`postinstall` creates `data/` and `logs/` and gives them to the owner of `/dev/console`, because the runtime writes there as that user. `config/` stays owned by root; the user edits `config.json`, not the directory. With no console user the installation fails with exit 1 before it creates anything.

### D6. One CA per installation, created by `postinstall` as the console user (Agent, under delegation)

`postinstall` runs `sea-runtime --generate-certs` with `sudo -u <console user> -H`. It never runs as root, and no CA or key travels in the payload or is shared between installations. A reinstall keeps the existing CA ([ADR-008](ADR-008-tls-trust-model.md) profile, files 0600, `certs/` 0700).

### D7. System trust only through an unticked box (Agent, under delegation)

The trust step is a separate component without payload, with its own choice in the Distribution XML and `start_selected="false"`. A pane explains the effect in English: the CA is created for this installation and goes into the System keychain for all users; whoever holds `ca.key` can sign a certificate for any site this Mac sees; the trust is for `ssl` and `basic`; removing the application does not undo it; how to undo it by hand. The trust command is `security add-trusted-cert -d -r trustRoot -p ssl -p basic -k /Library/Keychains/System.keychain <private copy>`. The tray item `Trust CA...` of [ADR-009](ADR-009-desktop-process-model.md) D13 stays.

### D8. A root-owned fingerprint anchors the trusted CA (Agent, under delegation)

`certs/` belongs to the console user, so `ca.crt` alone proves nothing. After `--generate-certs`, root computes the SHA-256 of `ca.crt`, checks it against the one the executable printed, and writes it to `<base>/.installer/ca.sha256` (directory 0755 and file 0644, both created by root). The trust script copies `ca.crt` to a private 0700 directory, requires exactly one PEM block that is a CA (the `CA:TRUE` line under Basic Constraints, not a loose text match), requires the fingerprint of the copy to equal the anchor, and only then calls `security`. A missing or foreign anchor exits 1 with zero `security` calls. The script never reads `ca.key`.

### D9. Root scripts touch only what they create and follow no link (Agent, under delegation)

After the first install the console user owns `data/`, `logs/`, `certs/` and `config.json`, and can plant symbolic or hard links in them. Root therefore never copies over, changes or gives away a name that already exists. There is no `chown -R`, no `mkdir -p` and no `rm -r`. A new directory is made with `mkdir` and given away with `chown -h`; `config.json` is created with a `set -C` redirection only when `config/` is a real directory owned by root; a link is refused. This rule came from two reproduced blockers of the independent review.

### D10. Uninstall removes the trust before it removes `certs/` (Agent, under delegation)

`uninstall.sh` sits in the install root and runs as `sudo <base>/uninstall.sh`. It refuses to run without root, when the application runs, when it is a link, when it is not named `uninstall.sh`, or when it sits in a system directory. It reads the anchor, finds the CA in the System keychain, runs `remove-trusted-cert -d` and `delete-certificate -Z <sha256>` on a private copy, and lists the keychain again. Only when the CA is gone does it remove `certs/` and the anchor. On any failure it keeps `certs/` and the anchor, still removes the program files, forgets no receipt and exits 1. It keeps `data/` and `logs/`, removes `config.json`, the autostart file and, when everything went well, the receipts. It uses `rm -f --` on exact names and `rmdir`, never `rm -r`. The three installer scripts (`scripts/postinstall`, `trust-scripts/postinstall` and `uninstall.sh`) are shell because the `.pkg` format runs scripts directly and the user's Mac has no node. This is the only exception to TypeScript in the project.

### D11. One lockstep version and a branch validator (Agent, under delegation)

One product version, with the root `package.json` as the source. The Nx Release group `lockstep` holds eight projects with `projectsRelationship: "fixed"`. Version actions also write `Cargo.toml`, the `app` entry of `Cargo.lock` and `tauri.conf.json`, after checking that every target file is writable. The `branch-name` command of `apps/tools-cli` maps `major/`, `minor/`, `fix/` to the bump and exempts `docs/` and `chore/` ([REQ-VERSION-01, 02 and 03](../../requirements/11-nx-quality-testing.md)). Commands and limits: [Standards](../../standards/README.md#versioning-and-release). The platform rule of [REQ-SEA-06](../../requirements/10-node-sea-distribution.md) (validate per platform) is applied on macOS only, through `verify-platform.ts` and the [platform matrix](../platform-matrix.md).

### D12. The executable gains the operation `--generate-certs` (Agent, under delegation)

The dispatcher of the executable has three outcomes. No argument starts the supervisor. `--service <id>` starts one registered service. `--generate-certs` is an operation that takes no value: it creates the TLS files of the base and exits (`0` done, `1` error). Giving it a value, or combining it with `--service`, exits `2`. The code is in `libs/shared-core/src/tls/certs-command.ts` and is not exported from `shared-core/tls`, so the gateway still cannot create certificates. See the [proposed amendments](#proposed-amendments-to-adr-002-and-adr-008).

## Options rejected

| Option | Reason |
|---|---|
| Base inside a `.app` | A new file in the bundle invalidates the seal (`codesign --verify`, confirmed on a re-signed copy). |
| `.app` in `/Applications` with the base in `~/Library/Application Support` | It needs a second input for the base and breaks the "one parameter" rule of [ADR-007](ADR-007-persistence-system.md). The root `postinstall` does not know the user's home. |
| A CA created in the build and shipped in the payload | Every installation would share one private key. |
| Generate the CA as root | The key files would belong to root, and the runtime could not use them. It also raises the cost of any link attack. |
| Trust the CA by default | Consent must be explicit. The box is unticked. |
| Trust whatever `ca.crt` holds at trust time | The console user owns `certs/` and could swap it. |
| Delete the database on uninstall | The human decided the data belongs to the user (D3). |

## Consequences

- The Installer UI has no free-text field. The configuration is a template copied once and edited by the user afterwards.
- The anchor binds the trust step to the moment of installation. It does not stop a process of the console user that plants a CA pair in `certs/` before `postinstall` runs: the anchor then pins that CA, and a ticked box trusts it (A1 of the U4b recheck). Proposed mitigation, not built: write the anchor only at the first installation, and on a reinstall require that `ca.crt` still matches the stored anchor; or generate the CA in a directory that only root writes and hand it over. Needs a human decision.
- With a custom folder owned by the user, a swap between the checks and `mkdir` or `chown -h` is possible. The default folder is owned by root.
- Open advisories of the independent reviews (U1, U4a, U4b, U5; U5 had 0 blockers and 7 advisories) are listed in the [POC-8 result](../../results/POC-08-Result.md#advisories-still-open). The preexisting ones in the certificate generator (a `certs/` link, a predictable temporary name) are unchanged.
- The package order, the real effect of an unticked box and the `sudo -u` branch depend on the Installer and are not verified.
- The removal of the application does not remove the trust unless `uninstall.sh` runs. The consent text says so.
- The CA is trusted for all users of the Mac once the box is ticked. Anyone with `ca.key` (mode 0600, owned by the console user) can sign for any site that Mac sees.
- Windows and Linux have no installer. `installer-build.ts` prints `installer not implemented on <os>` and exits 0 there.
- Apple signing and notarization are not done. The `.pkg` is unsigned.

## Proposed amendments to ADR-002 and ADR-008

Proposed by the agent, under delegation. Marked for review by the human in the pull request. This ADR does not edit [ADR-002](ADR-002-single-sea-portability.md) or [ADR-008](ADR-008-tls-trust-model.md).

- ADR-002 states that no argument means supervisor mode, `--service <id>` starts one service, and anything else exits 2. D12 adds `--generate-certs` as an operation. Proposed text: "no argument starts the supervisor; `--service <id>` starts one service; `--generate-certs` creates the TLS files and exits; combining them or giving a value exits 2; any other unknown option is ignored as before". The ignoring of other unknown options is how the dispatcher behaves today (read in code, not changed here), and it differs from the sentence "anything else exits 2".
- ADR-008 states that the packaged install gets its TLS files from the installer. D6 to D8 make that true for macOS: the installer calls `--generate-certs`, as the console user, once per installation. Proposed text: add the anchor and the consent rule of D7 and D8, and note that Windows and Linux have no installer yet.

## Not verified

- A real installation, the order of the two components, and that an unticked box omits the trust component.
- `security add-trusted-cert` from a `postinstall`, with `-p` repeated, and its idempotence.
- A real run of `uninstall.sh` as root, and the real output of `find-certificate -a -Z`, `remove-trusted-cert -d` and `delete-certificate -Z`.
- Gatekeeper with the unsigned `.pkg`; Apple signing and notarization.
- That the user can choose another installation folder.
- AC-18 with the CA trusted: the real gateway page in the window.
- Windows, Linux and macOS x64.

## Implementation status

[Back to navigation](#navigation)

Audit of 2026-11-09 against `main` at `cfec959`. The decision text above is kept as the record. This table says what the code does today.

| Decision | Decision status | Implementation | Check | Evidence | Gap |
|---|---|---|---|---|---|
| D1 scope macOS only, Win/Linux debt | Not stated | Implemented | single source | `tools/scripts/installer-build.ts:3`, `tools/scripts/installer-build.ts:11` | none |
| D2 assistant creates config/config.json | Not stated | Implemented | single source | `apps/desktop/installer/macos/scripts/postinstall:40`, `apps/desktop/installer/macos/scripts/postinstall:49` | none |
| D3 uninstall removes config.json, keeps data/ | Not stated | Implemented | single source | `apps/desktop/installer/macos/uninstall.sh:6`, `apps/desktop/installer/macos/uninstall.sh:212` | none |
| D4 .pkg no .app, base next to executable | Not stated | Implemented | confirmed | `apps/desktop/installer/macos/distribution.xml:12`, `tools/scripts/installer-macos.ts:57`, `tools/scripts/installer-macos.ts:74` | none |
| D5 console user owns data/ and logs/ | Not stated | Implemented | single source | `apps/desktop/installer/macos/scripts/postinstall:29`, `apps/desktop/installer/macos/scripts/postinstall:59`, `apps/desktop/installer/macos/scripts/postinstall:65` | none |
| D6 one CA per install via sudo -u console user | Not stated | Implemented | single source | `apps/desktop/installer/macos/scripts/postinstall:7`, `apps/desktop/installer/macos/scripts/postinstall:86` | none |
| D7 system trust only via unticked box | Not stated | Implemented | single source | `apps/desktop/installer/macos/distribution.xml:15`, `apps/desktop/installer/macos/resources/trust.html:9`, `apps/desktop/installer/macos/trust-scripts/postinstall:107` | none |
| D8 root-owned fingerprint anchors trusted CA | Not stated | Implemented | single source | `apps/desktop/installer/macos/scripts/postinstall:103`, `apps/desktop/installer/macos/scripts/postinstall:135`, `apps/desktop/installer/macos/trust-scripts/postinstall:41` | none |
| D9 root scripts follow no link, no chown -R | Not stated | Implemented | confirmed | `apps/desktop/installer/macos/scripts/postinstall:6`, `apps/desktop/installer/macos/scripts/postinstall:49`, `apps/desktop/installer/macos/uninstall.sh:9` | none |
| D10 uninstall removes trust before certs/ | Not stated | Implemented | single source | `apps/desktop/installer/macos/uninstall.sh:100`, `apps/desktop/installer/macos/uninstall.sh:161`, `apps/desktop/installer/macos/uninstall.sh:164` | none |
| D11 lockstep version and branch validator | Not stated | Implemented | single source | `nx.json:19`, `nx.json:32`, `tools/scripts/release-version-actions.ts:106` | none |
| D12 --generate-certs operation in executable | Not stated | Implemented | single source | `libs/service-registry/src/dispatcher.ts:33`, `libs/service-registry/src/dispatcher.ts:38`, `libs/service-registry/src/dispatcher.ts:45` | none |
