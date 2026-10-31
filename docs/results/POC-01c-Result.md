<!-- toon-meta
fmt: TOON
doc: docs/results/POC-01c-Result.md
title: "POC-1c Result"
type: backlog
summary: "Result of POC-1c: api-gateway packaged as one native Node SEA through an Nx package target, verified from a binary with no node on PATH."
related[2]: docs/backlog/poc-1c-sea-build.md,docs/results/POC-01b-Result.md
status: current
updated: 2026-10-31
-->

# POC-1c Result

Slice 1c of POC-1, delivered on branch `minor/poc-01b-nest` by human decision (same branch and PR as POC-1b). Backlog: [POC-1c](../backlog/poc-1c-sea-build.md). Previous slice: [POC-1b](POC-01b-Result.md).

## Summary

- `tools/scripts/compile-sea.ts` bundles `apps/api-gateway/dist/main.js` with esbuild, generates the SEA config at build time, and runs the native `node --build-sea`. No postject.
- The `package` target lives in `apps/api-gateway/package.json` and depends on the `build` target. The root `package` script runs it.
- The output executable is `dist/sea/api-gateway`, about 143 MiB. It is git-ignored through the existing `dist/` rule.
- The executable started with `PATH=/usr/bin:/bin` (no node on that PATH) and answered `GET /health` with `HTTP/1.1 200 OK`.
- Deviations: see Deviations.

## Build command

```sh
NX_DAEMON=false pnpm nx package api-gateway
```

Exit 0. The run output shows `nx run api-gateway:build` before `nx run api-gateway:package`. The root script also passes:

```sh
NX_DAEMON=false pnpm package
```

The root run reported `2 tasks: 2 succeeded, 1 cached`.

## Binary

| Item | Value |
|---|---|
| Path | `dist/sea/api-gateway` (git-ignored, `dist/` rule in `.gitignore`) |
| Size | 150227648 bytes (about 143 MiB) |
| Architecture | arm64 Mach-O |
| Signature | ad-hoc, applied by the script (`codesign --sign -`), `codesign --verify` valid |
| Node | v26.13.0 (satisfies root `engines.node` `>=26.13.0 <27`, checked by the script) |

The SEA config is generated into `dist/sea-build/sea-config.json` on each build. It is never committed.

## Observed run

```sh
env -i PATH=/usr/bin:/bin which node    # prints nothing, exit 1
env -i PATH=/usr/bin:/bin dist/sea/api-gateway
curl -i http://127.0.0.1:3000/health
```

Observed:

- `which node` with `PATH=/usr/bin:/bin` printed nothing and exited 1.
- `curl -i` returned `HTTP/1.1 200 OK`, `Content-Type: application/json; charset=utf-8`, body `{"status":"ok"}`.
- The process command was the binary path (`.../dist/sea/api-gateway`). `lsof` showed it listening on `127.0.0.1:3000`.
- The app does not print `process.execPath`, so the binary identity is shown by the process command and not by an in-app value.
- Node printed `ExperimentalWarning: Single executable application is an experimental feature`. This slice does not suppress it.
- The process was killed with `kill <pid>`. `lsof -nP -iTCP:3000` then returned nothing (port 3000 free).
- Scratch log directory: `mktemp -d` under the system temp dir (outside the repository).

## Bundler decision

`esbuild@0.28.2` (exact, `pnpm add -w -D -E --save-catalog`). Published 2026-08-08, older than the 24 h `minimumReleaseAge`. No requirement or roadmap page names a bundler (`rg -i 'esbuild|rolldown|webpack|rollup' docs/requirements docs/roadmap` found nothing), so the smallest suitable option was chosen. This is a deviation to decide.

## Node build-sea findings

- `node --help | rg -i sea` lists `--build-sea=...` and `--experimental-sea-config=...`.
- Official doc read with curl (`https://nodejs.org/api/single-executable-applications.html`, Node v26.13.0 docs). Top-level config keys: `main`, `mainFormat`, `executable`, `output`, `disableExperimentalSEAWarning`, `useSnapshot`, `useCodeCache`, `useVfs`, `vfsArchive`, `execArgv`, `execArgvExtension`, `assets`.
- The script uses `main`, `mainFormat: "module"`, `output`, `useVfs: false`, `useSnapshot: false`, `useCodeCache: true`, `execArgvExtension: "none"`. This Node accepted all of them (`node --build-sea` exit 0).
- The doc requires `codesign --sign - <output>` on macOS after `--build-sea`. Without it the arm64 binary was killed (exit 137).
- Injected-main `require()` only loads built-in modules. The bundle therefore carries a `createRequire` banner for built-ins.

## Manual edits (no CLI generated them)

- `tools/scripts/compile-sea.ts`: new file. No CLI generates a SEA build script.
- `apps/api-gateway/package.json`: `nx.targets.package` was written with `pnpm pkg set --json` (CLI). The JSON content is the only hand-chosen part.
- `pnpm-workspace.yaml`: `allowBuilds.esbuild: true` was written with `pnpm approve-builds esbuild` (CLI). `catalog.esbuild` was written by `pnpm add --save-catalog` (CLI).
- `.gitignore`: no edit. The existing `dist/` rule covers `dist/sea/` and `dist/sea-build/`.

## Deviations

- Bundler is esbuild, not named by any requirement page (see Bundler decision).
- Nx home of the `package` target is `apps/api-gateway`, not a tools project. Reason: the root `package` script runs `nx run-many -t package`, and a target on the app keeps it working with no new workspace project. A `tools/` project would also need a `pnpm-workspace.yaml` entry.
- `mainFormat: "module"` instead of the default CommonJS. `apps/api-gateway/src/main.ts` uses top-level await and esbuild rejects top-level await in CJS output. `mainFormat: "module"` works without `useVfs`.
- Optional Nest peers are external and not bundled: `@nestjs/microservices`, `@nestjs/websockets`, `class-validator`, `class-transformer`. The bundle builds and the app starts without them. Nest loads them only for microservices, websockets, and validation pipes, which the app does not use. Each is a bundle-time external, not a runtime proof.
- Banner `createRequire(import.meta.url)` gives CJS dependencies a `require` for built-ins. Node prints a warning that the injected `require()` supports only built-in modules. No file-system module is loaded.
- macOS ad-hoc `codesign --sign -` step, as the SEA doc requires.
- `ExperimentalWarning` is printed on each start. Not suppressed (`disableExperimentalSEAWarning` left at its default).
- The "invalidated when a registered service changes" clause of the backlog task is not implemented. The target declares no `inputs`/`outputs`. Not verified.
- Root `pnpm package` prints `package: not defined for this package` after a successful run. That echo comes from the existing root script, not from this slice.

## Checks not met as written

- Brief check `rg -n -i postject . --glob '!node_modules' --glob '!docs' --glob '!pnpm-lock.yaml'` prints two lines from `lan-solution-template-SRS-v1.6.md` (requirement text that says `postject` MUST NOT be used). No code, config, or script in the repository mentions postject. The SRS is not edited.
- The commit is not made. The brief asks for a commit, but `AGENTS.md` requires explicit user approval for commits, and an agent brief is not that approval. The changes are uncommitted on `minor/poc-01b-nest`.

## Decisions to take

- Approve the commit on `minor/poc-01b-nest` (Conventional Commit, no Co-Authored-By, no push).
- Confirm esbuild as the bundler, or name another.
- Confirm the Nx home of `package` (app target versus a tools project).
- `AGENTS.md` says "documentation only: no application code, no installs". POC-1b already added apps and installs on this branch. Decide whether that rule still applies.
- Decide whether to suppress the SEA experimental warning (`disableExperimentalSEAWarning`).
