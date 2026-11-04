<!-- toon-meta
fmt: TOON
doc: docs/results/POC-05-Result.md
title: "POC-05 Result"
type: backlog
summary: "Result of POC-5 in server mode: Tauri host, SEA sidecar, tray, CA trust, native E2E. Built and verified on macOS only."
ids[0]:
related[8]: docs/backlog/poc-5-tauri-sidecar-desktop-shell.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/architecture/adr/ADR-010-first-run-admin-setup.md,docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/results/POC-04-Result.md,docs/backlog/log-service-otel-grpc.md,docs/roadmap/PROPOSAL.md
status: current
updated: 2026-11-04
-->

# POC-05 Result

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md)

Branch: `minor/poc-05-tauri-sidecar`. Epic: [POC-5](../backlog/poc-5-tauri-sidecar-desktop-shell.md). Decisions: [ADR-009](../architecture/adr/ADR-009-desktop-process-model.md) (desktop process model) and [ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md) (first admin authentication, proposed).

## Navigation

- [Summary](#summary)
- [Slices](#slices)
- [Verified](#verified)
- [Independent verification finding](#independent-verification-finding)
- [Advisories](#advisories)
- [Not verified](#not-verified)
- [Hand edits and deviations](#hand-edits-and-deviations)
- [Open decisions for the human](#open-decisions-for-the-human)

## Summary

- Question: can a Tauri v2 host start, watch and stop the SEA supervisor as a sidecar, show its state in a tray, load the HTTPS gateway in a WebView, and be tested by a native E2E that leaves no orphan?
- Answer: yes on macOS arm64, server mode only. Client mode is pending (OQ17, decided by the human on 2026-11-04). The human also decided the focus: macOS first, with code that stays multi-platform.
- Not done: any run on Windows or Linux, the tray UI seen by a person, the native Trust CA dialog, the real WebView load of the gateway. See [Not verified](#not-verified).
- A PR is pending. Nothing is pushed.

## Slices

| Task | Commit | What it built |
|---|---|---|
| U1 | `f8eb47c` | `externalBin` sidecar per triple, spawn with no argument, ADR-006 host side, process tree stop with snapshot, `platform.rs`. |
| U2 | `e38407f` | Tray, hide to tray, autostart opt-in, single instance, busy port, crash recovery with manual restart. |
| U3 | `3567f89` | Window created by code on the gateway origin, no IPC, Trust CA item with native dialog and SHA-256 fingerprint. |
| U3 fix | `e7a1aa4` | Install the exact `ca.crt` bytes the user confirmed (blocker B1), refuse a symlink, ignore a second click. |
| E1 | `210cb1f` | Native E2E with `@wdio/tauri-service` on an instrumented build (`desktop:e2e`). |

The spikes S1 (host against the ADR-006 contract), S2 (WDIO on macOS) and S3 (first admin) ran before these slices. S3 has no code: its result is [ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md).

## Verified

Everything below ran on macOS aarch64 (Darwin, tauri 2.12.5, rustc 1.94.1, Node 26.13.0). Each row was reproduced by an independent check, not only by the author.

| Item | Proof | Commit |
|---|---|---|
| `externalBin` per triple copies `binaries/sea-runtime-aarch64-apple-darwin` to `target/debug/sea-runtime`. Only the host triple was built. | The host log `sidecar spawned pid=...`. | `f8eb47c` |
| Spawn with no argument. The base directory is the executable directory, not the cwd of the host. | The supervisor log shows `root` equal to the executable directory with a different cwd. | `f8eb47c` |
| `status` events arrive on stdout, one JSON per line. Logs arrive on stderr. | `starting`, `ready`, `stopping` parsed by `serde_json`. `curl -sk https://127.0.0.1:<port>/api/health` answers `{"status":"ready"}`. | `f8eb47c` |
| `shutdown` on stdin ends the supervisor with exit 0. EOF also ends it, in two ways: the host drops the handle, and `kill -9` of the host. | `received shutdown command`, `terminated code=Some(0)`. After `kill -9` the tree is gone in under 4 s. | `f8eb47c` |
| Exit code 1 (missing `config/config.json`) and exit code 2 (unknown service). | `terminated code=Some(1)` and `code=Some(2)`. | `f8eb47c` |
| Quit leaves no orphan: the app exit path, a hung supervisor (SIGSTOP, grace of 10 s then kill of the snapshot), and `kill -9` of the host. | `ps -axo pid,command` filtered on `sea-runtime` and `./app` printed nothing after each case. | `f8eb47c` |
| On macOS, Cmd+Q emits only `RunEvent::Exit`, never `ExitRequested`. The `Exit` hook stops the tree. | Spike S1 log. The exact Cmd+Q shortcut was not tried on the `.app`: the AppleScript quit event was used. | `f8eb47c` |
| Operating-system code is only in `platform.rs` behind `cfg`. | Code reading by the independent check. | `f8eb47c` |
| Busy port, single instance, hide to tray with the gateway still reachable, unexpected sidecar end with manual Start, and the opt-in autostart logic (through the plugin API, LaunchAgent on macOS). | Independent reproduction, 12 of 12 items. The clicks on the tray menu were not part of it (see Not verified). | `e38407f` |
| The window is created by code on `https://127.0.0.1:<httpsPort>/`. No capability file, no permission, no `remote` URL. | Reproduction, 9 of 9 items. | `3567f89` |
| The trust code refuses a symlink, a non-regular file, a file over 64 KiB, a private key, a file with other than one PEM block, and a certificate that is not a CA. The fingerprint and the installed file come from the same DER bytes. | Adversarial verification, B1 fixed and re-checked. | `e7a1aa4` |
| The product build has 0 `wdio` strings. The instrumented build has 63. | Count of `wdio` matches in `strings -a` of each binary. | `210cb1f` |
| `pnpm exec nx run desktop:e2e` gives 2 passing tests (health `ready` with the test's own CA, and the `main` window handle exists) and leaves no orphan. | Independent run with `--skip-nx-cache` (the first run was a cache hit). | `210cb1f` |
| Order of builds: Tauri `build` and `package` run after the SEA package. | Independent check ran the build and `desktop:test:static`, both exit 0. | `f8eb47c` |

Nothing in this table covers Windows or Linux.

## Independent verification finding

An adversarial verifier (read-only, high-risk item: trust store and security) found one blocker and four advisories in U3 (`3567f89`).

- B1: the fingerprint shown to the user and the bytes given to the trust store could differ. A `ca.crt` with several PEM certificates, or a file read a second time by path, could install something the user never saw.
- Fix in `e7a1aa4`: read the file once, accept exactly one PEM certificate, re-encode the DER that was hashed into a private temporary copy, and give only that copy to the OS. A symlink is refused (A1). A click while a dialog or an install is open is ignored (A4).
- A bounded re-check by the same verifier: B1, A1 and A4 resolved, no blocker left.

## Advisories

Open and not fixed in this branch.

Resolved: A2 (navigation filter) in commit 47faaa7. The WebView only navigates to `https://127.0.0.1:<httpsPort>`; other URLs and new windows are denied and logged. `nx run desktop:e2e` checks four foreign URLs on macOS (3 passing): the window URL does not change and the host log names each block. The `on_new_window` deny and a real `target=_blank` click were not run (not verified).

| Id | Advisory |
|---|---|
| A2b | CSP of the gateway responses, not verified whether it exists. The CSP of the remote page is set by the response headers of the api-gateway, not by Tauri. Not changed here. |
| A3 | Windows and Linux were not run. |
| AD1 | A window exists between the dialog and the use of the temporary copy. On Linux, where `pkexec` runs the copy, only the same user id could exploit it. |
| AD2 | Text outside the PEM block is accepted but not installed. |
| AD3 | The temporary directory stays if the process dies by SIGKILL. |
| AD4 | On Linux `is_trusted` only checks that a file exists (as before). |
| AD5 | The Windows and Linux branches were never executed. |

## Not verified

Stated literally. None of these was observed by a person or by a test.

- The tray icon, the menu, the tooltip, and the autostart checkbox as a user sees and clicks them.
- The native Trust CA dialog.
- The real load of the gateway in the WebView. There is no trust of `ca.crt` in the E2E run, by design, so the page is never asserted.
- IPC from JavaScript (the design grants none; no test calls `invoke`).
- `browser.tauri.execute` and the mocks of WDIO. The log shows a failure of `addTauriApi` in `before()` with no effect on the two tests.
- Windows and Linux: code, `platform.rs` branches, WDIO matrix.
- Quit from the tray button, from the Dock, and the window close button path.
- The real install of `ca.crt` into the macOS login keychain. The human runs it (test and reverse commands were given with the U3 report).
- The exact Cmd+Q shortcut on the packaged `.app`.
- A pid reuse race in the descendant snapshot.
- Other target triples for `externalBin`.
- A separate target directory for the E2E build when the installer is produced (the E2E script uses `target/e2e`; the bundle step was not run).

## Hand edits and deviations

Generated files come from the official CLIs. Edits without a CLI:

- `apps/desktop/src-tauri/src/*.rs` (`platform.rs`, `sidecar.rs`, `tray.rs`, `gateway.rs`, `trust.rs`, `lib.rs`), `tauri.conf.json` (`externalBin`, `app.windows` empty), `tauri.wdio.conf.json`.
- `apps/desktop/wdio.conf.mjs`, `apps/desktop/e2e/host.e2e.mjs`, `tools/scripts/e2e-desktop.ts`.
- `pnpm-workspace.yaml`: the build scripts of `edgedriver` and `geckodriver` are blocked in `allowBuilds`.
- `Cargo.toml`: versions pinned exactly (the CLI wrote `"2"`).

Deviations:

- The spike hooks `SPIKE_AUTOQUIT_MS`, `SPIKE_EOF` and `SPIKE_SIDECAR_ARGS` were not kept.
- WDIO permissions live in the overlay `tauri.wdio.conf.json`, not in `capabilities/` (a file there is always loaded and breaks the default build).
- The first-run wizard has no code in this POC. ADR-010 is a proposal.
- Requirement ids: REQ-DESK-01, REQ-DESK-02, REQ-DESK-03, REQ-DESK-04, REQ-DESK-05, REQ-DESK-06, REQ-SEC-05, REQ-TLS-02, REQ-TEST-08, REQ-TEST-09 and REQ-ECO-06 (11 ids, the list in the [epic](../backlog/poc-5-tauri-sidecar-desktop-shell.md)). The log service and the first-run setup have no REQ or AC id.

## Open decisions for the human

Not decided. They stay open.

1. First start: while `ca.crt` is not trusted the window cannot load the gateway. Which flow does the user see?
2. CSP of the gateway responses (A2b).
3. The real keychain install of `ca.crt` (the human runs it).
4. The five questions of [ADR-010](../architecture/adr/ADR-010-first-run-admin-setup.md#open-questions-for-the-human).
5. Client mode (OQ17) and the log service ([idea](../backlog/log-service-otel-grpc.md)).
