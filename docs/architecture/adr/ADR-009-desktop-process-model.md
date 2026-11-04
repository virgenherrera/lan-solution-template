<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-009-desktop-process-model.md
title: "ADR-009 Desktop process model"
type: architecture
summary: "How the Tauri host starts, watches and stops the SEA supervisor, and how it trusts ca.crt. Verified on macOS only."
ids[0]:
related[10]: docs/architecture/adr/ADR-002-single-sea-portability.md,docs/results/POC-05-Result.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md,docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-010-first-run-admin-setup.md,docs/architecture/overview.md,docs/roadmap/PROPOSAL.md,docs/requirements/09-desktop-tauri.md
status: proposed
updated: 2026-11-04
-->

# ADR-009: Desktop process model

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-006](ADR-006-sidecar-status-contract.md) | [ADR-007](ADR-007-persistence-system.md) | [ADR-008](ADR-008-tls-trust-model.md) | [POC-5 result](../../results/POC-05-Result.md) | [POC-5 backlog](../../backlog/poc-5-tauri-sidecar-desktop-shell.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Decisions](#decisions)
- [Options rejected](#options-rejected)
- [Consequences](#consequences)
- [Not verified](#not-verified)

## Status

Proposed, 2026-11-04. Implemented and run on `minor/poc-05-tauri-sidecar` (macOS arm64 only). Evidence: the [POC-5 result](../../results/POC-05-Result.md).

Each decision below carries its origin:

- **Human**: the human decided it, quoted from the work log.
- **Agent**: the agent chose it while implementing. The human has not reviewed it. It becomes accepted when the human says so.

## Context

The desktop host is a Tauri v2 application. It ships the SEA binary as a sidecar and talks to it through the [ADR-006](ADR-006-sidecar-status-contract.md) contract. The base directory is the executable directory ([ADR-007](ADR-007-persistence-system.md#one-base-directory)). The gateway serves HTTPS with the local CA of [ADR-008](ADR-008-tls-trust-model.md). The host must stop the whole process tree on Quit and leave no orphan.

## Decisions

### D1. Focus on macOS, code for every OS (Human)

The human decided on 2026-11-04: "foco en mac si, para pruebas pues estamos en una, no obstante usaras siempre patrones de dise;o y de ingenieria que nos permitan desplegar en windows/linux/mac con el mismo codigo". Code is written once. Only macOS was run.

### D2. Server mode first, client mode pending (Human)

The human decided on 2026-11-04 (OQ17): "que tal si lo dejamos (pendiente de investigar/implementar) y por ahora vamos en FF por server mode?". The host starts the local sidecar and loads the local gateway. Loading the UI from a gateway on another machine is not built.

### D3. Sidecar by `externalBin`, one per target triple (Agent)

`bundle.externalBin` is `binaries/sea-runtime`. The SEA artifact is named with the target triple and copied to `binaries/` (ignored by git) by `tools/scripts/stage-sidecar.ts`. Tauri `build` and `package` run after the SEA package (REQ-ECO-06). Evidence: macOS aarch64 only. Other triples were not built.

### D4. Base directory is the executable directory (Agent, from ADR-007)

The host spawns the sidecar with no argument. The supervisor reads `config/config.json` next to the executable. The host reads `net.httpsPort` from the same file to build the window URL and probe the ports. Evidence: the supervisor log shows the executable directory as root even when the host cwd differs.

### D5. Tauri only starts, watches and stops the supervisor (Agent, from the epic)

The host knows one child: the supervisor. The supervisor owns the Nest processes. The host does not restart on its own: after an unexpected end it kills leftovers, shows `error`, and waits for a manual Start from the tray.

### D6. ADR-006 is the sidecar contract, host side (Agent)

- `status` events on stdout, one JSON per line. `starting` gives Starting, `ready` and `degraded` give Ready, `error` gives Error.
- Logs on stderr, forwarded to the host log.
- `{"kind":"shutdown"}` on stdin. EOF also shuts the supervisor down.
- Exit codes 0, 1 and 2 are logged. The host does not branch on them.

An unknown event kind or a line that is not JSON is logged and ignored. [ADR-010](ADR-010-first-run-admin-setup.md) proposes one more event kind and does not change this ADR.

### D7. Tree stop takes a snapshot first and hooks `RunEvent::Exit` (Agent)

Stop does these steps in order: snapshot the descendants of the supervisor, write the shutdown line, wait up to 10 s, kill the snapshot survivors. The snapshot is taken first because a child reparents to `launchd` when its parent exits, and a later parent-pid walk would miss it. The host also keeps the descendants seen at each `status` event, for the crash case.

On macOS, Cmd+Q emits only `RunEvent::Exit` and never `ExitRequested`. The host handles `ExitRequested` (it can cancel and stop the tree first) and `RunEvent::Exit` (last chance, blocks until the tree is gone). Without the `Exit` hook the tree still died, but only because stdin EOF reached the supervisor when the host ended.

### D8. Operating-system code lives only in `platform.rs` (Agent, from the human focus D1)

`platform.rs` holds process-tree discovery, liveness, kill, the staging of the certificate and the trust-store calls, selected with `cfg`:

| Target | Process tree | Trust store | State |
|---|---|---|---|
| macOS | `ps -A -o pid=,ppid=`, `kill -0`, `kill -KILL` | `security verify-cert`, `security add-trusted-cert` into the login keychain | run on macOS |
| Linux | same unix code | `pkexec` copy plus `update-ca-certificates`; `is_trusted` only checks that a file exists | not verified |
| Windows | `taskkill /T /F`, `tasklist` (no snapshot needed) | `certutil -user -addstore Root` | code exists, not run |

### D9. The window is created by code and has no IPC (Agent)

`tauri.conf.json` declares no window (`app.windows` is empty). `gateway.rs` creates the `main` window on `https://127.0.0.1:<httpsPort>/` when the supervisor first reports ready, and reloads it on a later ready. The gateway always certifies `127.0.0.1` ([ADR-008](ADR-008-tls-trust-model.md)), whatever `net.bind` says. The app has no `capabilities/` directory, no `remote` URL and no `#[tauri::command]`, so the LAN-served page has no privilege (REQ-SEC-05). Closing the window hides it: the gateway stays reachable from the LAN (REQ-DESK-06).

### D10. Autostart is opt-in and persisted in the OS entry (Human decision on the default; Agent on the mechanism)

OQ12 (human): off by default, a checkbox in the tray menu. The agent persists the choice in the OS entry itself (a LaunchAgent on macOS, a registry key on Windows, a desktop file on Linux, through `tauri-plugin-autostart`), so the app keeps no second copy of the choice.

### D11. Single instance, busy port, sidecar crash (Agent)

- The single-instance plugin is registered first. A second launch shows the first window and exits.
- Before spawning, the host binds both configured ports for a moment. A busy port ends in `error` without a spawn, so nothing can be orphaned.
- A sidecar that ends unexpectedly gives `error` after its leftovers are killed. The user restarts it from the tray.

### D12. Native E2E uses a cargo feature and an overlay (Agent)

`@wdio/tauri-service` 1.5.1 with the embedded driver provider runs the instrumented build. The cargo feature `wdio` registers `tauri-plugin-wdio` and `tauri-plugin-wdio-webdriver`. Their permissions and `withGlobalTauri` sit in the overlay `tauri.wdio.conf.json`, passed only with `--config`. The instrumented binary is built into `src-tauri/target/e2e`. `tauri-plugin-log` is skipped under the feature, because a second logger panics. The product build has 0 `wdio` strings and the instrumented build has 63. The E2E isolates a temporary base directory and never touches the OS trust store.

### D13. `ca.crt` is installed only with consent and on the bytes the user saw (Agent)

The tray item `Trust CA...` reads `<base>/certs/ca.crt` once and accepts exactly one PEM certificate that is a CA. A symlink, a non-regular file, a file over 64 KiB and a file with a private key are refused. The dialog shows the path and the SHA-256 fingerprint of the DER bytes. The OS receives a private temporary copy re-encoded from those same bytes, deleted afterwards. `ca.key` is never opened. One dialog or install runs at a time. The fix `e7a1aa4` closed the blocker B1 where fingerprint and installed bytes could differ.

## Options rejected

| Option | Reason |
|---|---|
| Give the window IPC and read the setup token with `invoke` | It needs a capability with `remote.urls` for the LAN-served page. REQ-SEC-05 forbids it. See [ADR-010](ADR-010-first-run-admin-setup.md). |
| Walk the parent-pid chain after the supervisor exits | The children are already adopted by `launchd`. |
| Handle only `ExitRequested` | Cmd+Q on macOS never emits it. |
| Put the WDIO permissions in `capabilities/` | A file there is always loaded and breaks the default build. |
| Restart the sidecar from the host after a crash | The supervisor already has a bounded restart ([ADR-002](ADR-002-single-sea-portability.md)). The host shows `error` and waits for Start (agent choice, not reviewed by the human). |

## Consequences

- One module (`platform.rs`) is the only place that needs a native run per OS.
- The first start has a gap: until `ca.crt` is trusted, the window cannot load the gateway. The tray item `Trust CA...` fixes it. Which first-run flow the user sees is an open human decision.
- Open advisories, recorded in the [result](../results/POC-05-Result.md#advisories):
  - A2: the WebView has no `on_navigation` filter and no CSP.
  - A3: Windows and Linux were not run.
  - AD1: a window exists between the dialog and the use of the temporary copy. On Linux, where `pkexec` runs the copy, only the same user id could exploit it.
  - AD2: text outside the PEM block is accepted but not installed.
  - AD3: the temporary directory stays if the process dies by SIGKILL.
  - AD4: on Linux `is_trusted` only checks that a file exists (as before).
  - AD5: the Windows and Linux branches were never executed.

## Not verified

- Windows and Linux: every `cfg` branch of `platform.rs`, the WDIO matrix, `pkexec`.
- The tray menu as a user sees and clicks it, the native dialog, the real load of the gateway in the WebView, the real keychain install.
- Quit from the tray button, from the Dock, and the window close button.
- The exact Cmd+Q shortcut on the packaged `.app`.
- A pid reuse race in the snapshot.
- Other target triples, and a separate target directory when the installer is produced.
