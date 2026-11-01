<!-- toon-meta
fmt: TOON
doc: docs/results/CHORE-tauri-hardening-Result.md
title: "CHORE Tauri hardening Result"
type: backlog
summary: "Result of the Tauri hardening chore: explicit CSP, Windows offline WebView2 installer and Linux libatomic dependencies."
related[2]: docs/architecture/adr/ADR-001-version-substitutions.md,docs/results/POC-01-Result.md
status: current
updated: 2026-10-31
-->

# CHORE Tauri hardening Result

## Summary

`apps/desktop/src-tauri/tauri.conf.json` now carries an explicit CSP, a Windows offline WebView2 installer mode, and deb/rpm dependencies on libatomic. [ADR-001](../architecture/adr/ADR-001-version-substitutions.md) records the CSP decision. No GUI run happened. The runtime effect of every change is not verified.

## Changes

| File | Change | Written by |
| --- | --- | --- |
| `apps/desktop/src-tauri/tauri.conf.json` | `app.security.csp` set to an explicit string (was `null`) | manual |
| `apps/desktop/src-tauri/tauri.conf.json` | `bundle.windows.webviewInstallMode` = `{type: offlineInstaller, silent: true}` | manual |
| `apps/desktop/src-tauri/tauri.conf.json` | `bundle.linux.deb.depends` = `["libatomic1"]`, `bundle.linux.rpm.depends` = `["libatomic"]` | manual |
| `docs/architecture/adr/ADR-001-version-substitutions.md` | CSP bullet replaced; libatomic bullet added | manual |
| `docs/results/CHORE-tauri-hardening-Result.md` | this page | manual |
| `docs/meta.toon` | regenerated | regeneration command from Metadata block v1 |

No CLI writes `tauri.conf.json`, so the edit is manual. Keys were confirmed with `rg` in `apps/desktop/node_modules/@tauri-apps/cli/config.schema.json` (`webviewInstallMode`, `offlineInstaller`, `DebConfig.depends`, `RpmConfig.depends`).

CSP value:

```text
default-src 'self' ipc: http://ipc.localhost; connect-src 'self' ipc: http://ipc.localhost http://127.0.0.1:*; img-src 'self' asset: http://asset.localhost blob: data:
```

The port is a wildcard on purpose. The sidecar port comes from the `serverConfigSchema` default in `apps/api-gateway/src/server-config.ts` and is not fixed for POC-5. A static JSON cannot derive it.

## Validation

| Command | Exit | Tail |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | `Done in 2.5s using pnpm v12.16.1` |
| `pnpm exec nx run desktop:build --skip-nx-cache` | 0 | `NX 2 tasks: 2 succeeded`, cache skipped, 28.0s (runs `cargo check`, so `tauri-build` parsed the config) |
| `pnpm run build` | 0 | `NX 5 tasks: 5 succeeded, 4 cached` |
| `pnpm run test` | 0 | `NX 10 tasks: 10 succeeded, 9 cached` |
| `ldd` on the Linux SEA binary | not run | No `artifacts/` directory and no Linux SEA binary in this worktree. The evidence is [POC-01c-Result.md](POC-01c-Result.md) lines 109, 123 and 219: arm64 needed `libatomic1`; amd64 was not tested. |

## Risks

- The CSP is not exercised at runtime. There was no GUI run (not verified).
- Tauri injects nonces into `script-src` and `style-src`. How Angular inline styles behave under this CSP is not verified.
- The port wildcard allows any local port on `127.0.0.1`.
- `offlineInstaller` adds about 127 MB to the Windows installer, per https://v2.tauri.app/distribute/windows-installer/ (documentation claim, not measured here).
- The deb and rpm `depends` are untested on a real install (not verified).
- The SEA binary is not yet bundled as a sidecar. The dependency is forward-looking for POC-5.

## Integration plan

Branch `chore/tauri-hardening`, cut from `chore/tech-debt-poc-1` (commit `8624bcc`).

1. Merge PR #7 (`chore/tech-debt-poc-1`) into `main` first. This branch builds on its desktop identifier change.
2. Rebase `chore/tauri-hardening` on the new `main`. If PR #7 is squash-merged, rebase with `git rebase --onto main 8624bcc`, so only this branch's commits replay.
3. Regenerate `docs/meta.toon` after the rebase if `main` added or changed any `.md` page. Run the metadata check.
4. Rerun `pnpm exec nx run desktop:build --skip-nx-cache`, `pnpm run build` and `pnpm run test`. Then open the pull request (human decision).

Impact on POC-5 (sidecar):

- When POC-5 declares the SEA binary as a Tauri sidecar, the libatomic dependency stops being forward-looking. POC-5 must run `ldd` on the amd64 and arm64 Linux binaries and install the built deb and rpm on a clean image.
- If POC-5 fixes the sidecar port, replace `http://127.0.0.1:*` in `connect-src` with that one origin. Keep the port in one place only. If the port stays dynamic, the wildcard stays and the risk above stays open.
- If POC-5 serves the Angular app from the sidecar instead of `frontendDist`, the window origin changes. The CSP then needs a review, because `'self'` no longer means the Tauri asset origin.
- POC-5 must open a real window on each OS to exercise the CSP. This closes the first two items under Not verified.

## Not verified

- CSP behavior in a running Tauri window on any OS.
- Angular inline style and script behavior under the CSP.
- Windows installer size and silent offline install.
- deb and rpm install with the declared dependencies.
- Whether the amd64 binary needs `libatomic1`.
