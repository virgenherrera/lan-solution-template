<!-- toon-meta
fmt: TOON
doc: docs/architecture/platform-matrix.md
title: "Platform matrix"
type: architecture
summary: "Systems and architectures the template targets, with what was built and verified on each. Only macOS arm64 ran; every other cell is not verified."
ids[0]:
related[8]: docs/requirements/11-nx-quality-testing.md,docs/requirements/10-node-sea-distribution.md,docs/backlog/poc-8-msi-matrix-versioning.md,docs/backlog/td-windows-linux-distribution.md,docs/results/POC-05-Result.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/architecture/device-trust-guide.md,docs/roadmap/PROPOSAL.md
status: current
updated: 2026-11-04
-->

# Platform matrix

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md)

[Up](overview.md)

This page meets [REQ-TEST-09 and REQ-TEST-10](../requirements/11-nx-quality-testing.md) (OS matrix and results matrix) and the rule of [REQ-SEA-06](../requirements/10-node-sea-distribution.md): validate, per platform and architecture, both the standalone SEA binary and the Tauri package that contains it. A passing build does not equal a verified runtime.

## Navigation

- [At a glance](#at-a-glance)
- [Matrix](#matrix)
- [Evidence for macOS arm64](#evidence-for-macos-arm64)
- [How to verify a host](#how-to-verify-a-host)
- [Rules](#rules)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Verified | macOS arm64 only (Darwin 27.2.0, Node v26.13.0), on branch `chore/poc-08-matrix-versioning` |
| Everything else | Not verified. No cell below claims compatibility that no command proved. |
| Status values | `verified`, `pending`, `blocked` ([REQ-TEST-10](../requirements/11-nx-quality-testing.md)) |
| Check | `pnpm run tools verify-platform` ([source](../../apps/tools-cli/src/commands/verify-platform.command.ts)) |

---

## Matrix

[Back to navigation](#navigation)

The rows are the six targets of `TARGET_TRIPLES` in [compile-sea.ts](../../tools/scripts/compile-sea.ts) (lines 76-83). No requirement lists the supported architectures: [REQ-TEST-09](../requirements/11-nx-quality-testing.md) says "every system/architecture officially declared as supported" and the roadmap declares one explicitly, Windows 10 and 11 x64 ([decision 15](../roadmap/PROPOSAL.md), line 792). The other rows are what the code can target, not a support declaration.

| System | Architecture | Target triple | Declared by | Status | Loose SEA | Tauri package |
|---|---|---|---|---|---|---|
| macOS | arm64 | `aarch64-apple-darwin` | code (`compile-sea.ts:77`) | `verified` | verified: [evidence](#evidence-for-macos-arm64) | verified: [evidence](#evidence-for-macos-arm64) |
| macOS | x64 | `x86_64-apple-darwin` | code (`compile-sea.ts:78`) | `pending` | not verified: no run, no Intel host | not verified: no run, no Intel host |
| Windows | x64 | `x86_64-pc-windows-msvc` | decision 15 ([PROPOSAL.md:792](../roadmap/PROPOSAL.md)) | `blocked` | not verified: no native Windows runner ([OQ7](../roadmap/PROPOSAL.md)) | not verified: no native Windows runner |
| Windows | arm64 | `aarch64-pc-windows-msvc` | code (`compile-sea.ts:82`) | `blocked` | not verified: no runner; not equivalent to Windows x64 ([REQ-TEST-09](../requirements/11-nx-quality-testing.md)) | not verified: no runner |
| Linux | x64 | `x86_64-unknown-linux-gnu` | code (`compile-sea.ts:79`) | `pending` | not verified: no run (a Docker smoke is allowed by [OQ7](../roadmap/PROPOSAL.md) for the gateway only) | not verified: no run |
| Linux | arm64 | `aarch64-unknown-linux-gnu` | code (`compile-sea.ts:80`) | `pending` | not verified: no run | not verified: no run |

What "built" and "verified" mean here:

- Built: the artifact exists. A cross build is not verified ([compile-sea.ts](../../tools/scripts/compile-sea.ts) header, line 3). Only the macOS arm64 SEA was built, natively.
- Verified: the checks of `verify-platform` ran natively on that host and all passed. Nothing else counts.
- The script has rows for macOS arm64 and x64. The x64 row is code, not proof.

---

## Evidence for macOS arm64

[Back to navigation](#navigation)

Run on 2026-11-04, branch `chore/poc-08-matrix-versioning`, script commit `41346a8`, macOS 27.2 on arm64, Node v26.13.0. Command, from the repository root:

```sh
node tools/scripts/verify-platform.ts
```

The script became the `verify-platform` command of `tools-cli` afterwards; the checks did not change, and this evidence was not re-run with the command.

Output (exit 0):

```text
verify-platform: host darwin-arm64 (aarch64-apple-darwin)
ok   sea: artifact sea-runtime-aarch64-apple-darwin exists [0 ms]
ok   sea: unknown service selector exits 2 [1515 ms]
ok   sea: missing config exits 1 and creates nothing [1467 ms]
ok   sea: start, /api/health ready over HTTPS, SIGTERM exit 0, no orphans (ready over HTTPS, closed, no orphans) [3197 ms]
ok   tauri: package .app exists with the sidecar next to the executable (LAN Solution Desktop.app / app) [8 ms]
ok   tauri: host starts the sidecar, /api/health ready over HTTPS, SIGTERM closes everything (ready over HTTPS, closed, no orphans) [6448 ms]
verify-platform: 6 checks passed on darwin-arm64 in 12.6 s
```

Facts and limits of that run:

- The loose SEA is `artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin`. The check copies it to a temporary install directory with a generated config, free ports and certs from [generate-certs.command.ts](../../apps/tools-cli/src/commands/generate-certs.command.ts). `/api/health` is read over HTTPS trusting that install's `ca.crt` only.
- The Tauri package is `apps/desktop/src-tauri/target/release/bundle/macos/LAN Solution Desktop.app`. The check copies its host executable and its sidecar to a temporary directory and starts the host there. The bundle is never run in place.
- The host window opens for a moment during the Tauri check: it needs a desktop session.
- After the run no `sea-runtime`, `api-gateway` or temporary directory was left (`ps -axo comm`, temporary directory listing).
- The `.app` in the working copy was built on 2026-11-04 at 10:55 local time. Which commit built it is not recorded: not verified. The check proves that this bundle works, not that it matches the current sources. Rebuild it with `pnpm exec nx run desktop:package` before a release check.
- The bundle folder also holds `certs/`, `config/` and `data/` from an earlier manual run. The check ignores them on purpose.
- The script does not touch the keychain or the OS trust store, and uses no fixed port of the repository.
- The wider native E2E (tray, WebView, autostart) is the job of [`e2e-desktop.ts`](../../tools/scripts/e2e-desktop.ts) and is described in the [POC-5 result](../results/POC-05-Result.md). This page does not repeat it.

---

## How to verify a host

[Back to navigation](#navigation)

1. Build the artifacts on that host: `pnpm exec nx run sea-runtime:package`, then `pnpm exec nx run desktop:package`.
2. Run `pnpm run tools verify-platform` on the same host.
3. Record the command, the full output and the commit in [Evidence](#evidence-for-macos-arm64) form, then change the row.

Exit codes:

| Code | Meaning |
|---|---|
| 0 | Every check passed on this host. |
| 1 | A check failed. The failed line prints the last output of the process. |
| 3 | `not verified on <host>`: the script has no checks for this host. It does not pretend to pass. |

The script knows two hosts, `darwin-arm64` and `darwin-x64`. Adding Windows or Linux means writing and running the checks there first. The debt is in [Technical debt: Windows and Linux distribution](../backlog/td-windows-linux-distribution.md).

---

## Rules

[Back to navigation](#navigation)

- A cell turns `verified` only when its acceptance command ran natively on that system and architecture and the output is on this page ([OQ7](../roadmap/PROPOSAL.md)).
- A pass on macOS never changes a Windows or Linux cell ([REQ-TEST-09](../requirements/11-nx-quality-testing.md), AC-21).
- A Windows ARM virtual machine is not proof for Windows x64 ([REQ-TEST-09](../requirements/11-nx-quality-testing.md)).
- Docker may host a Linux smoke of the gateway. It does not replace a native installer or desktop check.

---

## Not verified

[Back to navigation](#navigation)

- Every cell outside macOS arm64.
- That the macOS `.app` in the working copy matches the current sources.
- Installer on any system: the macOS arm64 `.pkg` was built and inspected (`pkgutil`, `xar`) but NOT installed; the `postinstall` ran only without root. See [U3 result](../backlog/poc-8-msi-matrix-versioning.md#u3-result-the-macos-installer).
- The trust of the CA at install time on any system: the trust component of the `.pkg` was exercised only with stubs for `security` and `pkgutil`; see [ADR-011](adr/ADR-011-macos-installer-and-install-time-trust.md) and the [POC-8 result](../results/POC-08-Result.md#not-verified).
- Uninstall on any system: the macOS arm64 `.pkg` carries `uninstall.sh` in the payload root (built and inspected, mode 100755 root) and the script was simulated without root with stubs for `security`, `pkgutil` and `launchctl`; an independent verifier found 0 blockers and 7 open advisories; it was NOT run as root and no real keychain or receipt call was made. See [U5 result](../backlog/poc-8-msi-matrix-versioning.md#u5-result-the-uninstall-script).
- Tray, WebView, autostart and code signing on any system. See [POC-8](../backlog/poc-8-msi-matrix-versioning.md).
- Cross builds of the SEA for another triple.
