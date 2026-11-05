<!-- toon-meta
fmt: TOON
doc: docs/results/POC-08-Result.md
title: "POC-08 Result"
type: backlog
summary: "Result of POC-8 on macOS: lockstep versioning, platform matrix, .pkg installer, per-install CA with consent, uninstall. Not installed."
ids[0]:
related[10]: docs/backlog/poc-8-msi-matrix-versioning.md,docs/backlog/td-windows-linux-distribution.md,docs/architecture/adr/ADR-011-macos-installer-and-install-time-trust.md,docs/architecture/platform-matrix.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/results/POC-05-Result.md,docs/standards/README.md,docs/backlog/poc-9-ci-cd-releases.md,docs/roadmap/PROPOSAL.md
status: current
updated: 2026-11-04
-->

# POC-08 Result

Branch: `chore/poc-08-matrix-versioning`. Epic: [POC-8](../backlog/poc-8-msi-matrix-versioning.md). Decision record: [ADR-011](../architecture/adr/ADR-011-macos-installer-and-install-time-trust.md) (macOS installer and install-time trust, proposed). Debt: [Windows and Linux distribution](../backlog/td-windows-linux-distribution.md). Pull request: pending.

## Summary

- Question: on macOS only, can the repository release under one version, record what was verified per platform, and ship an installer with an assistant that creates `config/config.json`, creates a CA per installation, offers to trust it only with consent, and can be uninstalled while keeping the SQLite database?
- Answer: the pieces are built and checked as far as the agent could check them without `sudo` and without the real Installer. The `.pkg` was built and inspected. It was never installed. The trust step and the uninstall script were never run as root. See [Not verified](#not-verified).
- Scope cut by the human on 2026-11-04: macOS only. Windows, Linux, macOS x64, Apple signing and notarization are technical debt ([debt page](../backlog/td-windows-linux-distribution.md)). The code is written for the three platforms; only macOS arm64 ran.
- Open: the recipe at the end of this page. The human runs it. Until then the installer is "built and simulated", not "installed".

## Slices

Seventeen commits sit on the branch after `main` (`git log --oneline main..HEAD`).

| Unit | Commits | What it built |
|---|---|---|
| Scope | `6fb6f87` | Epic cut to macOS, technical-debt page, indexes. |
| M0 spike | none (spike kept outside the repository) | Format of the macOS installer. Findings are in [ADR-011](../architecture/adr/ADR-011-macos-installer-and-install-time-trust.md). |
| U2 matrix | `41346a8`, `5777151` | `tools/scripts/verify-platform.ts` and the [platform matrix](../architecture/platform-matrix.md). |
| U1 versioning | `a12131a`, `67d706f`, `b19c563` | Nx Release group `lockstep`, version actions for `Cargo.toml`, `Cargo.lock` and `tauri.conf.json`, `version-check.ts`, `branch-name.ts`, docs in [Standards](../standards/README.md#versioning-and-release). The fix `b19c563` closes two blockers of the independent verifier. |
| U3 installer | `0872f84`, `fc71b07` | `.pkg` with assistant, `config/config.json` from `postinstall`, builder `installer-macos.ts`. |
| U4a `--generate-certs` | `68afab9`, `110fd27`, `da79c02` | New operation of the executable. The fix `da79c02` closes the blocker of the independent verifier. |
| U4b CA and consent | `57e4ab0`, `d88f37e`, `44b6ed9`, `2c97c62` | Two-component `.pkg`, CA created by `postinstall`, trust component with an unticked box. The fix `44b6ed9` closes two blockers of the independent verifier. |
| U5 uninstall | `0700f69`, `e0c8319` | `uninstall.sh` in the payload root. |
| U7 | this commit | This page, ADR-011, indexes. |

U6 (installer smoke on macOS) is not done by the agent: every step needs `sudo` or the Installer window. It is the [recipe](#recipe-for-the-human).

## Verified

"Reproduced by" says who ran the command: the author of the unit, a QC check that got only the goal and the acceptance items, or an independent verifier that tried to break the unit. Everything ran on macOS 27.2 arm64 (Node v26.13.0), 2026-11-04. Nothing here covers Windows, Linux or macOS x64.

| Item | Proof | Reproduced by | Commit |
|---|---|---|---|
| `pkgbuild` and `productbuild` build a `.pkg` with an assistant (welcome pane, Customize pane, choices) and the `.pkg` can be inspected without installing it. | `pkgutil --expand-full`, `xar -tf`, `pkgutil --check-signature` prints `no signature`. | QC (M0) | none (spike) |
| Writing a new file into a `.app` invalidates its seal, so the base is not placed inside a `.app`. | `codesign --verify --deep --strict` fails with `a sealed resource is missing or invalid` after adding `config/config.json`. Confirmed on a re-signed copy and for new files only. An empty `data/` directory did not invalidate it. | QC (M0) | none (spike) |
| One version in 11 places: nine `package.json`, `Cargo.toml`, the `app` entry of `Cargo.lock` and `tauri.conf.json`. | `pnpm release:check` exit 0 (`all 11 places at 0.1.0`). `nx release version` on an isolated copy changes exactly 11 lines. Commit, tag and push stay off. | Independent verifier, QC | `a12131a` |
| A read-only target file stops the release before any file changes. | Ten cases on an isolated copy (each target file read-only, a symbolic link, a dangling link): exit 1, `not writable; no file was changed`, 0 changes, `version-check` exit 0. | Independent verifier (recheck) | `b19c563` |
| The branch validator maps the table of REQ-VERSION-02 and rejects every other name, including the keys of `Object.prototype`. | 29 cases, then `constructor/x`, `toString/x`, `hasOwnProperty/x`, `__proto__/x`, `main`: exit 1. `major/a`, `minor/a-b`, `fix/a1`, `docs/x`, `chore/x`: exit 0. `chore/poc-08-matrix-versioning` prints `bump=none`. | Independent verifier, QC | `b19c563` |
| `release:version --dry-run` and `release:changelog --dry-run` change nothing. | exit 0, `git status` empty. | Independent verifier | `a12131a` |
| `verify-platform.ts` passes on this host and refuses a host it has no checks for. | `node tools/scripts/verify-platform.ts` exit 0, 6 checks. A preloaded `process.platform=linux` prints `not verified on linux-arm64` with exit 3. No orphan process or temporary directory is left. | Author, QC | `41346a8` |
| The `.pkg` builds in the `package` step of `desktop` and holds only `app`, `sea-runtime`, `uninstall.sh` and `config/config.example.json` in its root. | `pnpm exec nx run desktop:package --skip-nx-cache --output-style=static` exit 0, 3 passing, two runs. `pkgutil --payload-files` and `lsbom`. No `*.crt`, `*.key`, `*.db`, `*.sqlite` or `ca.*` in the expanded payload. `uninstall.sh` is `100755 0/0`. | QC (U3), author (U5) | `0872f84`, `0700f69` |
| The Distribution XML defines the trust choice with `start_selected="false"`, a separate component without payload, and a `readme` pane with the consent text. | Expanded `Distribution` and `Resources/trust.html`. | Independent verifier | `57e4ab0` |
| `--generate-certs` creates `<base>/certs` with the profile of ADR-008, never replaces a CA, never prints key material, and is not reachable from the gateway. | Real `sea-runtime` in a temporary base: `openssl verify` OK, `CA:TRUE`, fingerprint equal to `openssl x509 -fingerprint -sha256`, second run keeps `ca.key` and `ca.crt` byte for byte, an expired or mismatched CA exits 1 and changes nothing. | Author, independent verifier, QC | `68afab9` |
| `--generate-certs` combined with `--service` exits 2. `--generate-certs=1`, `=true` and `=false` exit 2 with `takes no value`. No argument still starts the supervisor, and `--service nope` still exits 2 with the same message. | Real SEA built from the commit under check; supervisor reaches `ready` over HTTPS and closes on SIGTERM with no orphan. | Independent verifier (blocker), QC (recheck) | `da79c02` |
| The main `postinstall` creates `config.json`, `data/`, `logs/` and `certs/` (0700) and runs `--generate-certs` as the console user, never as root. Root never copies over, changes or gives away a name that already exists, and follows no link. | Stubs for `chown`, `cp`, `sudo`, `security`, `pkgutil`, `stat`, `id`, the real `sea-runtime` and the real `openssl`, no root. A reinstall with a dangling `config.json` link, a link to a foreign directory and a hard link in `data/` and `logs/`: zero `chown`, `cp`, `mkdir` or `rm` on existing names. No `chown -R`, no `mkdir -p`, no `cp` in the script. | Independent verifier (recheck) | `44b6ed9` |
| The trust script trusts only the CA the installer generated. | Root writes the SHA-256 of `ca.crt` to `<base>/.installer/ca.sha256` (root-owned). With stubs: a replaced `ca.crt`, a link swapped just before the copy, a leaf with `CN=CA:TRUE`, two certificates, a missing anchor and a missing receipt each exit 1 with zero `security` calls. The legitimate flow makes one `security add-trusted-cert -d -r trustRoot -p ssl -p basic -k /Library/Keychains/System.keychain <private copy>` call and leaves no temporary directory. | Independent verifier (recheck) | `44b6ed9` |
| `uninstall.sh` removes what the table in the [epic](../backlog/poc-8-msi-matrix-versioning.md#u5-result-the-uninstall-script) lists, keeps `data/` and `logs/` byte for byte, is idempotent, and on every trust failure keeps `certs/` and the anchor and exits 1. | Simulation without root, stubs for `security`, `pkgutil`, `launchctl`, `pgrep`, `id`, `stat`, `dscl`, `sudo`, the real `openssl`; probes `p1.sh`, `p2.sh` and `p3.sh` with 0 FAIL; traps (links, hard links, extra files) with zero deletions outside the expected set. `sh -n` exit 0. | Author only | `0700f69` |
| Whole branch at `d88f37e`: build, static test, type check and docs checks pass. | `pnpm build` exit 0; `nx run desktop:test:static --skip-nx-cache` exit 0; `tsc --noEmit -p apps/desktop/tsconfig.json` exit 0; `pnpm release:check` exit 0; both Checks blocks of [Standards](../standards/README.md#checks) exit 0; regeneration of `docs/meta.toon` in an empty temporary directory and `cmp -s` exit 0. The author repeated the same commands after U5 (exit 0). | QC, author | `d88f37e`, `0700f69` |
| ADR-002, ADR-006, ADR-007, ADR-008 and ADR-009 are not edited by this branch. | `git diff main..HEAD --stat` over `docs/architecture/adr` is empty. | QC | all |

## Independent verification findings

Independent verifiers (read-only, high-risk items) reviewed U1, U4a, U4b and U5. U1, U4a and U4b had blockers. All were fixed in a later commit and re-checked. U5 had none.

| Unit | Blocker | Fix | Re-check |
|---|---|---|---|
| U1 | B1: a failure during the Nx flush left a mixed tree (seven files at the new version, four at the old). | `b19c563`: the version actions check that every target file is writable before Nx flushes anything. | Resolved. A failure inside the flush itself (a full disk) is not covered; `pnpm release:check` detects it and `git restore` reverts it. Not probed. |
| U1 | B2: `branch-name.ts` accepted the keys of `Object.prototype` (`constructor/x`) with exit 0. | `b19c563`: own-property check. | Resolved. |
| U4a | `--generate-certs=<value>` was silently ignored and the supervisor started. | `da79c02`: a value exits 2. | Resolved (QC). |
| U4b | B1: on a reinstall, root `chown` and `cp` followed links that the console user can plant in `config/`, `data/`, `logs/` and `certs/`. A hard link survives `chown -R`. | `44b6ed9`: root touches only what it creates in the run; no `chown -R`; `set -C` for `config.json`; links refused. | Resolved with stubs. |
| U4b | B2: the certificate that was trusted could differ from the one generated, because `certs/` belongs to the console user. | `44b6ed9`: root-owned fingerprint anchor, exact match required, `CA:TRUE` read from the Basic Constraints line. | Resolved with stubs. |

### Advisories still open

Texts are short. The full reports are kept outside the repository.

U1 (independent verifier):

- `nx release version` accepts a prerelease (`0.1.0-rc.1`) and build metadata (`0.1.0+build`), and a downgrade. Not documented.
- `nx release version ''` opens an interactive menu; without a terminal it may hang or exit 0.
- `branch-name.ts` has no limit on the slug length.
- `nx release version` leaves the changed files staged in the index (Nx behaviour; no commit, no tag).
- The flush is not atomic (see above), and there is a time-of-check to time-of-use gap between the writable check and the flush.
- The main branch name is rejected (exit 1). The human must confirm that `main` should fail.
- AC-25, AC-26 and AC-27, the CI check of branches, the highest-impact choice for several merged PRs and the duplicate-tag guard are not built. They belong to [POC-9](../backlog/poc-9-ci-cd-releases.md) (on hold). Not a defect of U1.

U4a (independent verifier):

- A1: if `certs/` is a symbolic link, the keys are written in the target directory and its mode becomes 0700. Preexisting in `generate.ts`, same in `pnpm dev:certs`. Severity grows if the call runs as root in a user-owned base; the installer calls it as the console user.
- A2: the temporary file name `ca.key.<pid>.tmp` is predictable and opened with flag `w`. Preexisting. A race was not reproduced.
- A3 (pass): keys are created 0600, `certs/` is 0700.
- A4: a `ca.crt` with two certificates is accepted and kept; the first is used.
- A5: `tls.extraNames` has no maximum length.
- A6: extra positional arguments and a repeated flag are ignored with exit 0.

U4b (first review, fixed ones excluded):

- A2 of the first review: if the chosen folder already holds `data/` or `logs/` that belong to someone else, the old script changed their owner. After the fix the script changes no name that already exists.
- A4: with no console user (no GUI, MDM at the login window) the installation stops with exit 1 and a partial state that can be retried.
- A6: the trust script uses `TMPDIR` of the Installer; a fixed root-only directory is suggested.
- A9, A10: that `-p` may be repeated, the idempotence of `add-trusted-cert`, and the order of the two components are not verified.

U4b (recheck):

- A1: the anchor is the hash that root computes over a `ca.crt` that lives in the user's `certs/`. A CA planted there before `postinstall` becomes the anchor and is trusted if the box is ticked. The recheck closes "replace after generation", not "plant before". Mitigation proposed in [ADR-011](../architecture/adr/ADR-011-macos-installer-and-install-time-trust.md#consequences).
- A2: `config/` stays root-owned; if the host ever rewrote `config.json` by rename inside `config/`, it would fail. No such code found. Not run.
- A3: with a custom folder owned by the user, a time-of-check to time-of-use race against `mkdir` and `chown -h`. Not possible with the default folder, which root owns.
- A4: on a reinstall with `config/` not owned by root and no `config.json`, the script exits 0 without creating it.
- A5: a swap of `ca.crt` to a FIFO between the check and `openssl` could hang the installer. Not probed with a real FIFO.
- A6: the refusal of `/`, `/usr` and `/System` relies on the template check, not on an explicit list.

U3 (QC):

- `pkgutil --payload-files` lists `._app`, `._config`, `._sea-runtime` and `config/._config.example.json` (AppleDouble, from `com.apple.provenance`). `COPYFILE_DISABLE=1` and `xattr -rc` do not remove them. The effect at install time is not verified.
- That the user can change the installation folder in the real Installer is not verified.

U5 (independent verifier, commit `e0c8319`): 0 blockers, 7 advisories, all open. The verifier ran the script with stubs and without root, in an isolated copy. It touched no real keychain. The three installer scripts (`scripts/postinstall`, `trust-scripts/postinstall` and `uninstall.sh`) are shell because the `.pkg` format runs scripts directly and the user's Mac has no node. This is the only exception to TypeScript in the project.

- A1: `pgrep -f` reads the pattern as a regular expression. With `(`, `[` or `+` in the base path the running-application check fails (`pgrep` exit 2 or no match), and the script removes `app` and `sea-runtime` while the application runs. Lower realism: the default path `/usr/local/lan-solution` is not affected. No loss of `data/`, `logs/` or trust.
- A2: if `remove-trusted-cert` succeeds and `delete-certificate` fails, the re-run fails with "the trust is still there" and needs a manual `security delete-certificate -Z`. State is safe (`certs/` and the anchor stay). Whether the real `remove-trusted-cert` fails when no trust settings exist is not verified.
- A3: with no usable anchor and no `ca.crt`, while the keychain holds the CA, the script says "nothing to untrust", deletes `ca.key` and exits 0. The CA stays trusted without its key. Reachable only without the root-owned anchor, so not in a normal install.
- A4: time-of-check to time-of-use race in `certs/`, only on the exact names `ca.crt`, `ca.key`, `leaf.crt` and `leaf.key`. Not demonstrated.
- A5: the deny list of the base does not cover `/Users/<user>` or `/private/var/root`. It needs a human running `sudo` from there.
- A6: if `rm -f` fails, `set -e` ends the script with exit 1 and no message. The state stays safe: all 13 injected failures re-ran clean.
- A7: the `.pkg` payload lists AppleDouble entries `._app`, `._config`, `._sea-runtime`, `._uninstall.sh` and `config/._config.example.json`. If the Installer writes them, the script does not list them and would leave them behind. Not verified (nothing was installed).
- A8 (found by the final QC, after the verifier): an earlier run of `uninstall.sh` left a directory `lan-untrust.*` in the system temporary directory, holding a copy of the public `ca.crt` (certificate only, never the key). Owner was the console user, mode 0700. Cause not verified. Suspect failure path: not identified by reading. `uninstall.sh` already has `trap cleanup EXIT` (lines 34 to 40) that removes the copy and the directory, so a normal exit or a failed check does not explain it; a signal that the shell cannot trap (`SIGKILL`) or an interrupted run would. The leftover was deleted by hand. Proposed mitigation, not implemented: also trap `INT TERM HUP` so they run `cleanup` and exit.

The verifier confirmed, with stubs and without root: the database stayed intact (same SHA-256 and same tree in every variant), no deletion went through a link, trust is removed only by the hash of the root-owned anchor with `delete-certificate -Z`, 13 injected `rm` failures re-ran safely, and the payload script is 0755 root. Proposed mitigations are in [technical debt](../backlog/td-windows-linux-distribution.md). None is built.

## Not verified

The agent did not do any of the following. Each one is in the [recipe](#recipe-for-the-human) or is technical debt.

- A real installation with `Installer.app` (or `sudo installer`): the assistant screens, the location pane, the `postinstall` run as root, the `chown` to the console user, a reinstall that keeps `config.json`.
- The order in which the Installer runs the two components.
- That an unticked box omits the trust component.
- The `sudo -u <console user>` branch of the main `postinstall` (stub only).
- `security add-trusted-cert` from a `postinstall`, and `-p` given twice.
- A real run of `uninstall.sh` as root, and real `find-certificate -a -Z`, `remove-trusted-cert -d`, `delete-certificate -Z`, `launchctl bootout` and `pkgutil --forget` calls.
- That the autostart file is named after `productName` (read in cargo sources only).
- Gatekeeper behaviour of the unsigned `.pkg`. No signature, no notarization.
- The real load of the gateway page in the window with the CA trusted (AC-18), and the tray and autostart seen by a person.
- Windows (x64 and arm64), Linux (x64 and arm64) and macOS x64. Their rows in the [platform matrix](../architecture/platform-matrix.md) stay `pending` or `blocked`.
- The `display` that the `package` step needs in CI (the E2E opens a window).

## Recipe for the human

Marked: the human runs it. The agent did not run any line. Nothing here is verified. It needs `sudo` and a desktop session. Build first with `pnpm exec nx run desktop:package --skip-nx-cache`.

```sh
P=apps/desktop/src-tauri/target/release/lan-solution-desktop-0.1.0-aarch64-apple-darwin.pkg
B=/usr/local/lan-solution

# 1. Install with the trust box TICKED (Installer.app: Customize pane).
open "$P"
ls -l "$B" "$B/certs"                      # app, sea-runtime, uninstall.sh, config/, data/, logs/, certs/ (0700)
openssl x509 -noout -fingerprint -sha256 -in "$B/certs/ca.crt"   # equals the fingerprint in /var/log/install.log
cat "$B/.installer/ca.sha256"              # the same hash, owned by root
security find-certificate -a -Z /Library/Keychains/System.keychain | grep -c "$(tr -d ':' < "$B/.installer/ca.sha256")"   # 1
security verify-cert -c "$B/certs/ca.crt"  # successful

# 2. Open the host. The window must load the gateway page over HTTPS (AC-18).
#    The tray item "Trust CA..." must report the CA as already trusted.

# 3. Edit the config, then reinstall over the same folder.
echo '{"edited":true}' > "$B/config/config.json"
sudo installer -pkg "$P" -target /
cat "$B/config/config.json"                # still the edited content

# 4. Uninstall. Quit the application first. The database must stay.
shasum -a 256 "$B"/data/*                  # note the hash
sudo "$B/uninstall.sh"                     # exit 0
ls -l "$B"                                 # only data/, logs/ and uninstall.sh
shasum -a 256 "$B"/data/*                  # the same hash
security find-certificate -a -Z /Library/Keychains/System.keychain | grep -c "<fingerprint noted in step 1>"   # 0
pkgutil --pkgs='com.virgenherrera.lansolution.*'   # no receipt

# 5. Install again with the box UNTICKED, in ANOTHER folder (Installer.app: Customize pane and location).
open "$P"
#    Expected: certs/ holds a NEW CA (different fingerprint). security find-certificate must
#    find nothing for it, and security verify-cert -c <new ca.crt> must fail.
#    Check in /var/log/install.log that the trust script did not run before the main one.

# Reverse of everything: uninstall.sh as in step 4, then remove what it keeps if you want it gone.
sudo rm -rf "$B"          # copy "$B/data" first if you want to keep the database
sudo pkgutil --forget com.virgenherrera.lansolution
sudo pkgutil --forget com.virgenherrera.lansolution.trust
```

If the box was ticked and `uninstall.sh` exits 1, the CA may still be trusted. The by-hand commands are in the [epic](../backlog/poc-8-msi-matrix-versioning.md#u4b-result-the-installer-creates-the-tls-files-and-offers-to-trust-the-ca): `security remove-trusted-cert -d <ca.crt>` and `security delete-certificate -Z <sha256> /Library/Keychains/System.keychain`.

## Open decisions for the human

- Review [ADR-011](../architecture/adr/ADR-011-macos-installer-and-install-time-trust.md): every decision of the agent is proposed, not accepted. The ADR-002 and ADR-008 amendments it proposes are for review in the pull request.
- Confirm that the branch `main` should fail the branch validator.
- Decide whether to mitigate A1 of the U4b recheck (a CA planted before `postinstall`) before a release.
- Run the recipe. Until then the installer is not installed, and the trust and uninstall steps are not run as root.
