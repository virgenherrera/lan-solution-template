<!-- toon-meta
fmt: TOON
doc: docs/results/POC-01c-Result.md
title: "POC-1c Result"
type: backlog
summary: "Result of POC-1c: sea-runtime packaged as one native Node SEA with the api-gateway service, built by the rspack builder, run from a binary with no node on PATH."
related[2]: docs/backlog/poc-1c-sea-build.md,docs/results/POC-01b-Result.md
status: current
updated: 2026-10-31
-->

# POC-1c Result

Slice 1c of POC-1, delivered on branch `minor/poc-01b-nest` (same branch and PR as POC-1b, human decision). Backlog: [POC-1c](../backlog/poc-1c-sea-build.md). Previous slice: [POC-1b](POC-01b-Result.md).

This page describes the final state of the branch. The first version of this slice used esbuild and the Nx project `sea-build`. Both were removed. See [Replaced design](#replaced-design).

## Summary

- `sea-runtime` is the single sidecar entry and supervisor. Its `package` target runs `tools/scripts/compile-sea.ts` and writes one executable.
- The script bundles a generated role-map entry and the `dist/main.js` of each service into one ESM file. It runs native `node --build-sea` and, on macOS, `codesign --sign -`.
- Services are the workspace dependencies of `sea-runtime`. Today that is `api-gateway` only.
- Each Nest app builds to one self-contained ESM `dist/main.js` through the Nest CLI rspack builder, with one shared config in `tools/rspack/nest.config.ts`.
- With no argument the binary runs the supervisor. The supervisor spawns `process.execPath --service <id>` for each service listed in the SEA asset `services.json`. The asset is validated with Zod.
- Observed on macOS arm64: the binary runs with no `node` on PATH, its child answers `GET /health` with `HTTP/1.1 200 OK`, and SIGTERM to the supervisor leaves no process and frees port 3000.
- Not built or observed: Linux and Windows binaries, SIGINT, supervisor restart. See [Not verified](#not-verified).

## Layout

| Item | Final state |
|---|---|
| Build command | `pnpm nx package sea-runtime` |
| Target owner | `apps/sea-runtime/package.json`, `nx.targets.package`; `dependsOn: ["build"]`. `nx.targets.build` has `dependsOn: ["^build"]` |
| Output folder | `artifacts/sea-runtime/` (git-ignored, `/artifacts` in `.gitignore`). The script removes and recreates it on each run, so one executable remains per host |
| Executable name | `sea-runtime-<target-triple>[.exe]` (Tauri sidecar naming, see [Naming](#naming)) |
| Verified binary | `artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin`, 147863776 bytes, macOS arm64 |
| Triples in the script | `darwin arm64`, `darwin x64`, `linux x64`, `linux arm64`, `win32 x64`, `win32 arm64`. Only `darwin arm64` was built |
| Node | v26.13.0 (the script checks root `engines.node` `>=26.13.0 <27`) |
| SEA config | Generated in `dist/sea-package/sea-config.json` on each build. Never committed |
| SEA asset | `services.json`: `{ "services": ["api-gateway"] }` |

The `dist/sea-package/` working folder is git-ignored through the `dist/` rule.

## How it works

1. `nx show project <name> --json` finds each service folder. Services are read from `sea-runtime/package.json` entries with a `workspace:` range.
2. Each service must have a built `dist/main.js`. If it is missing, the script stops and names the build target to run.
3. The generated entry (`dist/sea-package/entry.mjs`) maps each service id to `import()` of its `dist/main.js`. No argument imports the supervisor. `--service <id>` imports that one service. An unknown id exits 2.
4. `@rspack/core` (Node API) bundles the entry into `sea-app.mjs`. Externals and ignore rules come from the shared config. A banner gives CommonJS dependencies a `require` for built-ins.
5. `node --build-sea` writes the executable. Assets: `services.json`.
6. The supervisor (`apps/sea-runtime/src/supervisor/supervisor.service.ts`) reads `services.json` with `isSea()` and `getAsset()`. It validates the content with `z.object({ services: z.array(z.string().min(1)) })`. It spawns `process.execPath` with `['--service', id]`, `shell: false`, `stdio: 'inherit'`. Outside a SEA it logs and spawns nothing.
7. On SIGINT or SIGTERM the supervisor sends the same signal to each child and waits for each exit, then exits 0.

## Build and run

```sh
NX_DAEMON=false pnpm nx package sea-runtime
env -i PATH=/usr/bin:/bin artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin
curl -i http://127.0.0.1:3000/health
```

Observed in the final QC run (fresh clone, `pnpm install --frozen-lockfile` exit 0):

| Check | Result |
|---|---|
| `nx show projects` | `api-gateway`, `sea-runtime`, `shared-core`, `lan-solution-template`. `sea-build` absent |
| `api-gateway` targets | `build`, `deploy`, `format`, `lint`, `start`, `test`. No `package` target |
| `pnpm nx package sea-runtime` | Exit 0. Order: `api-gateway:build` (local cache hit), `sea-runtime:build`, `sea-runtime:package` |
| `artifacts/sea-runtime` | One file, `sea-runtime-aarch64-apple-darwin`, 147863776 bytes |
| `which node` with `PATH=/usr/bin:/bin` | No output |
| Binary, no arguments, then `curl -i http://127.0.0.1:3000/health` | `HTTP/1.1 200 OK`, body `{"status":"ok"}` |
| Process list | Supervisor with no arguments, parent PID 1. Child with `--service api-gateway`, parent is the supervisor. Both run the same executable path. Neither is named `node`. Log line `[SupervisorService]` |
| `--service api-gateway` alone | `/health` returns 200 |
| `--service nope` | Exit 2. Stderr `unknown service "nope"; registered: api-gateway` |
| SIGTERM to the supervisor | No process left (`pgrep` empty). Port 3000 free |
| Root `pnpm build`, `pnpm test`, `pnpm package` | Each exit 0 |

The root `package` script still prints `package: not defined for this package` after a successful run. That echo comes from the root script (see [POC-1b](POC-01b-Result.md)). Not fixed here.

Separate build check (rspack slice, same branch): `apps/api-gateway/dist/main.js` 3144787 bytes and `apps/sea-runtime/dist/main.js` 1709241 bytes, each with a `main.js.map`. Each `main.js` ran alone with `node` from an empty `mktemp -d`. The api-gateway copy answered `/health` with 200. The sea-runtime copy printed the standalone start lines and exited 0.

## Naming

The Tauri sidecar documentation (https://v2.tauri.app/develop/sidecar/, read with curl in this slice) gives the naming. The page quotes two lines:

- Line 87: a sidecar executable in `src-tauri/binaries/` named with the target triple for Apple Silicon macOS (`my-sidecar-aarch64-apple-darwin`).
- Line 96: rename to `sidecar-${targetTriple}`, using the rustc host tuple.

So `<name>-<target-triple>` follows that page. The Tauri consumer side (copying or reading the file in `src-tauri`) is not verified.

## Recipe: add a new service

Not verified beyond `api-gateway`. Only one service is registered.

1. Create the Nest app with the Nest CLI, as in [POC-1b](POC-01b-Result.md): `pnpm dlx @nestjs/cli@12.0.11 new <name> --directory=apps/<name> -p pnpm -g -s -t --no-observe`.
2. Set the rspack builder in `apps/<name>/nest-cli.json`. No CLI writes this. Use the same block as `apps/api-gateway/nest-cli.json`: `compilerOptions.builder` with `type: "rspack"` and `configPath: "../../tools/rspack/nest.config.ts"`.
3. Delete the generated spec and test config files (REQ-TEST-01). Keep no unit or integration suites.
4. Make `src/main.ts` start the service when the module loads. The supervisor path imports `dist/main.js` and does not call a function. Confirmed for `api-gateway` only.
5. Register it: `pnpm -C apps/sea-runtime add -D <name> --workspace`. The package name is the service id and must match the Nx project name.
6. Run `pnpm nx package sea-runtime`. Nx builds the new service first (`^build`). The binary then lists it in `services.json`.
7. Start the binary with no arguments. Check `--service <name>` alone.

## Replaced design

- esbuild bundler (`esbuild@0.28.2`) and `postject`: removed. The final bundler is `@rspack/core` 2.3.0, pinned in the catalog. `esbuild` remains in the lockfile as an optional peer of `vite` and `vitest` (see [Decisions to take](#decisions-to-take)).
- Nx project `sea-build` (`tools/package.json`) and the `sea` field in service `package.json` files: removed. Nx cannot select services by a field. Services now come from the workspace dependencies of `sea-runtime`.
- `dist/sea/sea-app` and the `sea-app` name: replaced by `artifacts/sea-runtime/sea-runtime-<triple>`.
- Argv-only role selection: still the entry shape, now inside the supervisor model. Respawn, readiness and dispatcher validation remain for [POC-2](../backlog/poc-2-single-sea-runtime-supervisor.md).

## Manual edits (no CLI generated them)

| # | File | Edit | Reason |
|---|---|---|---|
| 1 | `tools/scripts/compile-sea.ts` | New file. Generic assembler: argv supervisor name, workspace dependency discovery, rspack Node API, SEA asset `services.json` | No CLI generates a SEA build script |
| 2 | `pnpm-workspace.yaml` | `- tools` removed from `packages` (the `tools` folder no longer holds a project) | No CLI edits this list |
| 3 | `.gitignore` | `/artifacts` added after `dist/` | No CLI writes it |
| 4 | `apps/sea-runtime/package.json` | `nx.targets.build.dependsOn: ["^build"]` and `nx.targets.package` (`dependsOn: ["build"]`, `run-commands`, output `artifacts/sea-runtime`). Dependency `api-gateway: workspace:*` added with `pnpm -C apps/sea-runtime add -D api-gateway --workspace` | Written by hand. The dependency line was added by the CLI |
| 5 | `tools/rspack/nest.config.ts` | Shared Nest rspack config: externals for every `node:` request, ignore rules, one chunk | No CLI creates it |
| 6 | `apps/*/nest-cli.json` | `compilerOptions.builder` set to `rspack` with the shared config path | No CLI sets it |
| 7 | `apps/sea-runtime/src/supervisor/supervisor.service.ts` | Body of the supervisor: SEA asset read, Zod parse, spawn of `process.execPath --service <id>`, signal stop | `nest generate service` creates an empty class |
| 8 | `apps/sea-runtime/src/supervisor/supervisor.service.ts` (commit `fff1df3`) | `Logger` name literal `'SupervisorService'` instead of the class name | The minified bundle mangled the class name in log tags |
| 9 | `apps/sea-runtime/src/runtime/runtime.module.ts` | `providers: [SupervisorService]` | `nest generate` creates an empty module |

Generated spec `apps/sea-runtime/src/supervisor/supervisor.service.spec.ts` was created by `nest generate` and removed in `fff1df3` (REQ-TEST-01).

## Deviations

- Node `--build-sea` needs `codesign --sign -` on macOS, as the SEA page of the Node docs requires. Without it the arm64 binary was killed at start.
- The shared rspack externals now treat every `node:` request as a builtin, so `node:sea` resolves at build time. This change also affects the `api-gateway` build. Existing builtins are unchanged.
- `apps/sea-runtime` build depends on `^build`, set in the project `package.json`. `nx.json` was not changed.
- Stale output from the old tool (`dist/sea`, `dist/sea-build`) was removed. The empty `tools/node_modules` folder (git-ignored) remains.
- `nest build` with the rspack builder does no type check. A separate `tsc --noEmit` run passed for `sea-runtime`. No type-check step was added to the build.
- Node prints `ExperimentalWarning: Single executable application is an experimental feature` on start. Observed in an earlier run of this slice. Not checked in the final QC. Not suppressed.
- The generated spec file was deleted in `fff1df3`. No unit or integration suite exists in the repository.

## Not verified

- Linux and Windows binaries. The host is macOS arm64 only.
- SIGINT. Only SIGTERM was exercised.
- Supervisor restart, readiness, backoff, and child exit cascade. Out of scope for this slice ([POC-2](../backlog/poc-2-single-sea-runtime-supervisor.md)).
- The REQ-BUILD-04 invalidation clause: a build is invalidated when a registered service is added or changed. Not implemented. Moved to POC-2.
- A second registered service. Recipe steps above are not run.
- Tauri consumer side (`src-tauri` sidecar). Only the naming in the doc was read.
- `api-gateway` `lint` was not run.
- Behavior of the rspack builder from a clean `dist` (the Nx cache was not cleared).
- The `.ts` config and build script depend on Node 26 native type stripping. Only Node 26.13.0 was tested.

## Decisions to take

- Decide whether `esbuild` leaves the lockfile. It is still there as an optional peer of `vite` and `vitest`. Removing it needs a change in `vite` or `vitest`.
- Decide whether app `package.json` files need catalog `devDependencies` refs. The build passes without them.
- Keep the project-level `dependsOn` in `apps/sea-runtime/package.json`, or move it to `nx.json` `targetDefaults`.
- Decide whether to add a type-check step (`tsc --noEmit`) to the build, since the rspack builder does not check types.
