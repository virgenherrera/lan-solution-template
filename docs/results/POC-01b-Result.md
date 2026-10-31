<!-- toon-meta
fmt: TOON
doc: docs/results/POC-01b-Result.md
title: "POC-1b Result"
type: backlog
summary: "Result of POC-1b: Nest CLI generation, NodeAdapter, health endpoint, dev and build checks, manual edits."
related[2]: docs/backlog/poc-1b-nest-apps.md,docs/results/POC-01a-Result.md
status: current
updated: 2026-10-31
-->

# POC-1b Result

Slice 1b of POC-1, branch `minor/poc-01b-nest`. Backlog: [POC-1b](../backlog/poc-1b-nest-apps.md). Previous slice: [POC-1a](POC-01a-Result.md).

## Summary

- `apps/api-gateway` and `apps/sea-runtime` generated with `@nestjs/cli@12.0.11 new`. `libs/shared-core` created with `pnpm init` and `tsc --init`.
- Express removed from both apps. `api-gateway` uses `NodeAdapter` from `@nestjs/platform-node@12.3.2`. `sea-runtime` no longer depends on it (see the standalone change below).
- `api-gateway` answers `GET /health` with HTTP 200 and `{"status":"ok"}` in dev. The endpoint came from `nest generate controller`.
- `sea-runtime` is a standalone Nest application context: `NestFactory.createApplicationContext(RuntimeModule)`, no HTTP listener, no port config (REQ-RUNTIME-02, moved here from POC-2). It exits with code 0 by itself after init (see Standalone change).
- `pnpm nx build` exits 0 for all three projects. No app imports the other.
- Every `^` or `~` range and every `express`/`fastify` package was removed from the manifests checked.
- Deviations: see Deviations.

## Version table

Baseline from [02-technology-baseline.md](../requirements/02-technology-baseline.md). Registry reads ran 2026-10-31 (about 18:46 UTC) with `pnpm view`.

| Package | Baseline | Check | Pin in this slice | Status |
|---|---|---|---|---|
| Node.js | `>=26.13.0 <27` (REQ-STACK-01) | local `v26.13.0` | unchanged | verified (local binary) |
| pnpm | `>=12.16.1` (REQ-STACK-02) | local `12.16.1` | unchanged | verified |
| Nx | discovered (REQ-STACK-08) | `24.0.2` (1a) | catalog `24.0.2` | verified in 1a; unchanged |
| `@nestjs/core`, `common`, `testing` | `12.3.2` (REQ-STACK-04) | latest `12.3.2` (published 2026-10-27T12:03Z) | `12.3.2` exact | verified on npm |
| `@nestjs/platform-node` | `12.3.2`, NodeAdapter (REQ-STACK-04) | `12.3.2` | `12.3.2` exact | verified on npm; `NodeAdapter` export checked at runtime |
| `@nestjs/cli` | not in baseline | latest `12.0.11` (published 2026-10-27T08:14Z, older than 24 h) | `12.0.11` via `pnpm dlx`, devDependency `12.0.11` | verified |
| `@nestjs/schematics` | not in baseline | `12.0.12` (from `@nestjs/cli` ranges) | `12.0.12` exact | verified (resolved) |
| TypeScript | not pinned in baseline | latest `7.0.2` (published 2026-07-08); `6.0.3` (published 2026-04-16) | catalog `6.0.3` | decision, see Deviations |
| Zod | `>=4.6.7` (REQ-STACK-06) | not installed in 1b | not installed | not applicable in 1b |
| Angular, Tauri | see 1a | not installed in 1b | not installed | not applicable in 1b |

Other resolved versions in the apps (exact pins): `reflect-metadata` 0.2.2, `rxjs` 7.8.2, `@nestjs/mau` 0.2.9, `@types/node` 24.19.2, `@types/supertest` 7.2.1, `@vitest/coverage-v8` 4.1.12, `oxlint` 1.90.0, `oxlint-tsgolint` 7.0.2005, `prettier` 3.9.10, `source-map-support` 0.5.21, `supertest` 7.3.1, `vite` 8.3.5, `vitest` 4.1.12.

## Commands run

Run from the repository root unless noted. Exit codes come from each command itself.

| # | Command | Result |
|---|---|---|
| 1 | `git branch --show-current` | `minor/poc-01b-nest`, exit 0 |
| 2 | `npm view @nestjs/cli version` | failed, `EBADDEVENGINES`: npm 12.2.1 rejects the root `devEngines.packageManager` (pnpm). Read-only, no change. Replaced by step 3 |
| 3 | `pnpm view @nestjs/cli version`, `pnpm view @nestjs/cli time --json` | `12.0.11`; `12.0.11` published `2026-10-27T08:14:48Z`, older than 24 h. `12.0.10` published 2026-10-20 |
| 4 | `pnpm view @nestjs/platform-node@12.3.2 version`, `pnpm view @nestjs/core@12.3.2 time` | `12.3.2`; core published 2026-10-27T12:03Z |
| 5 | `pnpm view typescript dist-tags`, `pnpm view typescript time --json` | latest `7.0.2`; `6.0.3` published 2026-04-16 |
| 6 | `pnpm dlx @nestjs/cli@12.0.11 new --help` | exit 0. Flags confirmed: `--directory`, `-p`, `-g`, `-s`, `-t`, `--no-observe`. No flag disables Express |
| 7 | `pnpm dlx @nestjs/cli@12.0.11 new api-gateway --directory=apps/api-gateway -p pnpm -g -s -t --no-observe` | exit 0; 15 files created (`nest-cli.json`, `tsconfig*.json`, `package.json`, `src/` with three files, `.oxlintrc.json`, `.prettierrc`, `.gitattributes`, `README.md`, `AGENTS.md`, two `vitest.config*.ts`) |
| 8 | same with `sea-runtime` | exit 0; same layout |
| 9 | `rm` of `apps/*/vitest.config.ts`, `apps/*/vitest.config.e2e.ts`, `apps/*/AGENTS.md` | exit 0 (manual deletion, see Manual edits) |
| 10 | `mkdir -p libs/shared-core && pnpm init` in `libs/shared-core` | exit 0 |
| 11 | `pnpm add -w -D -E --save-catalog typescript@6.0.3` | exit 0; `catalog.typescript: 6.0.3` |
| 12 | `pnpm exec tsc --init` in `libs/shared-core` | exit 0; `tsconfig.json` created |
| 13 | `pnpm pkg set` in `libs/shared-core` (`scripts.build`, `scripts.test`, `main`, `types`) | exit 0 |
| 14 | `pnpm install` | exit 0, `Already up to date` |
| 15 | `pnpm --filter <app> remove @nestjs/platform-express @types/express` | exit 0 for both apps |
| 16 | `pnpm --filter <app> add -E @nestjs/platform-node@12.3.2` | exit 0 for both apps |
| 17 | `pnpm --filter <app> add -E [-D] <dep>@<resolved>` (38 commands, generated from `pnpm ls --depth 0 --json`) | 38 of 38 exit 0. Every `^` range in both apps replaced by an exact version |
| 18 | `pnpm pkg delete 'scripts["test:watch"]' ...` (4 keys per app) | exit 0 after bracket path. First try with `scripts.test:watch` failed: `ERR_PNPM_PKG_INVALID_PROPERTY_PATH` (exit 1) |
| 19 | `pnpm pkg set scripts.test="echo 'test: not defined for this package'"` per app | exit 0 |
| 20 | Manual edit `apps/*/src/main.ts` (see Manual edits) | n/a |
| 21 | `pnpm exec nest generate controller health --no-spec --flat` in `apps/api-gateway` | exit 0; `CREATE src/health.controller.ts`, `UPDATE src/app.module.ts` |
| 22 | Manual edit `apps/api-gateway/src/health.controller.ts` (see Manual edits) | n/a |
| 23 | `pnpm nx show projects` | exit 0; `["api-gateway","sea-runtime","shared-core","lan-solution-template"]` |
| 24 | `pnpm nx build api-gateway`, `pnpm nx build sea-runtime`, `pnpm nx build shared-core` | each exit 0; `1 task: 1 succeeded` each |
| 25 | `PORT=3100 pnpm --filter api-gateway start:dev` (background) | ready after 3 s; log `Nest application successfully started`, routes `{/health, GET}` mapped |
| 26 | `curl -i http://localhost:3100/health` | `HTTP/1.1 200 OK`, `Content-Type: application/json; charset=utf-8`, body `{"status":"ok"}` |
| 27 | kill the dev process, `lsof -i :3100` | exit 1, no output: port free |
| 28 | `PORT=3200 pnpm --filter sea-runtime start:dev` (background) | ready after 3 s; `Nest application successfully started`, no error line |
| 29 | kill the dev process, `lsof -i :3200` | exit 1, no output: port free |
| 30 | `rg -n "api-gateway\|sea-runtime" apps/api-gateway/src apps/sea-runtime/src libs` | exit 1, no match |
| 31 | `rg -n 'express\|fastify' apps libs --glob package.json` | exit 1, no match |
| 32 | `grep -rn '[\^~]' apps/*/package.json libs/shared-core/package.json pnpm-workspace.yaml package.json` | exit 1, no match |
| 33 | `pnpm build`, `pnpm test`, `pnpm package` (root) | each exit 0; each runs `nx run-many` (3 tasks, `3 succeeded`) and prints `<op>: not defined for this package` |
| 34 | `pnpm install --frozen-lockfile` | exit 0 |
| 35 | `pnpm --dir apps/<app> add -E --save-catalog zod@4.6.7` (both apps) | exit 0. `catalog.zod: 4.6.7` in `pnpm-workspace.yaml`; `zod: catalog:` in both apps. 4.6.7 published 2026-10-12, older than 24 h. Matches the REQ-STACK-06 minimum `>=4.6.7` |
| 36 | `pnpm exec nest generate module config --no-spec --flat` and `pnpm exec nest generate provider server-config --no-spec --flat` in each app | exit 0 each; `CREATE src/config.module.ts`, `CREATE src/server-config.ts`, `UPDATE src/app.module.ts` |
| 37 | Bodies of `src/server-config.ts` and `src/config.module.ts` (see Manual edits) | n/a |
| 38 | `pnpm nx build api-gateway`, `pnpm nx build sea-runtime` | each exit 0 |
| 39 | Zod probe (`node`, scratch file outside the repo) on `serverConfigSchema` | `{}` parses to `{"port":3000,"hostname":"127.0.0.1"}`; `{port:'abc',hostname:'0.0.0.0'}` throws `ZodError` with 2 issues |
| 40 | `pnpm --dir apps/api-gateway start:dev` (background), `curl -i http://127.0.0.1:3000/health` | `HTTP/1.1 200 OK`, body `{"status":"ok"}` |
| 41 | `pnpm --dir apps/sea-runtime start:dev` (background) | `Nest application successfully started` on `127.0.0.1:3001`, no error line |
| 42 | kill the listening PIDs with `lsof -t`, `lsof -nP -iTCP:3000 -iTCP:3001 -sTCP:LISTEN` | exit 1, no output: both ports free |
| 43 | `git rm` of `apps/sea-runtime/src/{app.controller,app.service,app.module,config.module,server-config}.ts` | exit 0 (row 14) |
| 44 | `pnpm exec nest generate module runtime --no-spec` in `apps/sea-runtime` | exit 0: `CREATE src/runtime/runtime.module.ts` (`@Module({})`) |
| 45 | Manual edit `apps/sea-runtime/src/main.ts` (row 13) | n/a |
| 46 | `pnpm --filter sea-runtime remove @nestjs/platform-node` (from repo root) | exit 0; `package.json` and `pnpm-lock.yaml` drop that one dependency, no other change |
| 47 | `pnpm install --frozen-lockfile` | exit 0 |
| 48 | `rg -n 'NodeAdapter\|NestFactory.create\(\|listen\(\|platform-node\|SERVER_CONFIG\|server-config' apps/sea-runtime` | exit 1, no match |
| 49 | `NX_DAEMON=false pnpm nx build sea-runtime`, `NX_DAEMON=false pnpm nx build api-gateway` | each exit 0; `build` runs `nest build` |
| 50 | `pnpm run start:dev` in `apps/sea-runtime` (background; script `nest start --watch`) | `Found 0 errors`, `RuntimeModule dependencies initialized`, then `The application exited with code 0. Waiting for file changes`. `lsof -nP -iTCP -sTCP:LISTEN` shows no listener from this run |
| 51 | kill the watcher tree (`nest start --watch`, its `sh` wrapper and the `pnpm` parent) | processes gone |
| 52 | `pnpm run start:dev` in `apps/api-gateway` (background); `curl -i http://127.0.0.1:3000/health` | `Nest application successfully started`; `HTTP/1.1 200 OK`, body `{"status":"ok"}` |
| 53 | kill the gateway watcher tree; `lsof -nP -iTCP:3000 -sTCP:LISTEN` | exit 1, no output: port 3000 free |
| 54 | `NX_DAEMON=false pnpm nx reset` | exit 0 |

The root `build`, `test` and `package` scripts now run real `nx run-many` tasks for the three projects. The no-op message prints after success, as predicted in 1a. The message is still printed, so it does not tell the reader whether a task ran. Revisit before POC-2.

## Manual edits

Each edit has no CLI route. Every other file was written by a CLI or by `pnpm`.

| # | File | Edit | Reason |
|---|---|---|---|
| 1 | `pnpm-workspace.yaml` | Added `packages:` with `- apps/*` and `- libs/*` | No CLI writes the workspace package list. `pnpm add -w` does not add it |
| 2 | `.gitignore` | Appended `dist/` and `*.tsbuildinfo` | No CLI writes these. `nest build` writes `dist/` and `tsconfig.build.tsbuildinfo` in each app |
| 3 | `apps/api-gateway/src/main.ts` | Import `NodeAdapter` from `@nestjs/platform-node`; `NestFactory.create(AppModule, new NodeAdapter())` | `nest new` has no flag for the adapter. REQ-STACK-04 forbids Express |
| 4 | `apps/sea-runtime/src/main.ts` | Same as edit 3 | Express was removed from `sea-runtime` too. Superseded by row 13 (the file no longer uses `NodeAdapter`) |
| 5 | `apps/api-gateway/src/health.controller.ts` | Added `Get` to the import; `@Get()` with `check(): { status: string }` returning `{ status: 'ok' }` | `nest generate controller` creates an empty class only. The handler body has no CLI route |
| 6 | `libs/shared-core/src/index.ts` | Created with `export const sharedCoreName = 'shared-core';` | `tsc --init` creates no source file. This is the minimum export |
| 7 | Deleted `apps/api-gateway/vitest.config.ts`, `apps/api-gateway/vitest.config.e2e.ts`, `apps/api-gateway/AGENTS.md`, and the same three in `apps/sea-runtime` | `rm` | Test configs and an app-level AGENTS.md are forbidden in this slice |
| 8 | Deleted `apps/api-gateway/README.md` and `apps/sea-runtime/README.md` | `git rm` | Nest boilerplate README. The docs check (`docs/standards/README.md`) requires a `toon-meta` block on every tracked `.md` except root `AGENTS.md` and `README.md`, and the regeneration command would fail on the app READMEs |
| 9 | `apps/*/src/server-config.ts` body (`sea-runtime` copy removed, row 14): `zod` schema `serverConfigSchema` (`port` int 1–65535, default 3000 for `api-gateway`, 3001 for `sea-runtime`; `hostname` `z.literal('127.0.0.1')`, default `127.0.0.1`), `SERVER_CONFIG` symbol token, `ServerConfig` type, `parseServerConfig(input)` returning `Object.freeze(schema.parse(input))` | `nest generate provider` creates an empty `@Injectable()` class named `ServerConfig` | The generator has no schema body. The class was replaced by a schema and a frozen type, so `ServerConfig` is no longer a class |
| 10 | `apps/*/src/config.module.ts` body (`sea-runtime` copy removed, row 14): provider `{ provide: SERVER_CONFIG, useFactory: () => parseServerConfig({}) }`, exported | `nest generate module` creates an empty `@Module({})` | The generator has no provider. Zero input for now, see Deviations |
| 11 | `apps/*/src/main.ts` (`api-gateway` only; `sea-runtime` main replaced in row 13): `process.env.PORT ?? 3000` replaced by `app.get<ServerConfig>(SERVER_CONFIG)` and `app.listen(config.port, config.hostname)` | Rows 3 and 4 of this table list the bootstrap; the port and hostname now come from the frozen config | No env read in app code |
| 12 | `apps/*/src/app.module.ts`: `ServerConfig` removed from `providers`; `ConfigModule` kept in `imports` | The CLI added the provider to `AppModule`, not to `ConfigModule` | The token is provided by `ConfigModule` only |
| 13 | `apps/sea-runtime/src/main.ts` body: `await NestFactory.createApplicationContext(RuntimeModule);`, `RuntimeModule` imported from `./runtime/runtime.module.js` | `nest generate` has no standalone bootstrap body. `NodeAdapter` and `listen` are removed because `sea-runtime` must expose no port |
| 14 | `git rm` of `apps/sea-runtime/src/app.controller.ts`, `app.service.ts`, `app.module.ts`, `config.module.ts`, `server-config.ts` | No CLI removes generated files. These files only served the HTTP app and the port config |

Not manual: the `test` script and the removed `test:*` scripts (`pnpm pkg`), the `build` script and `main`/`types` in `libs/shared-core/package.json` (`pnpm pkg set`), the health controller route file (`nest generate`), and the `app.module.ts` registration (`nest generate`).

## Deviations

- **Express removal.** Removed by `pnpm remove` and replaced by `pnpm add -E`. Both changed `package.json` and `pnpm-lock.yaml` in the same first commit as the generated files. The commit split differs from the brief: commit (a) holds generation, manifests and workspace wiring, commit (b) holds the `main.ts` adapter edit and the health endpoint.
- **TypeScript version.** The baseline gives no TypeScript pin. `6.0.3` was chosen because it is the newest 6.x line already requested by `@nestjs/cli` and its schematics (`^6.0.2`), it is older than 24 h, and it avoids the TypeScript 7 major. Not verified against the baseline; open for a decision.
- **Test tooling kept.** `vitest`, `vite`, `@vitest/coverage-v8`, `supertest`, `@types/supertest`, `@nestjs/testing` remain as devDependencies. `tsconfig.json` of each app lists `vitest/globals` in `types`, which fails to compile if the package is removed. The configs and spec files are gone; no test was added. No test script runs anything.
- **Standalone scope.** `sea-runtime` config and listener were removed in the standalone change, which supersedes the Configuration row above for `sea-runtime`. `api-gateway` keeps its config.
- **Orphan watchers.** Two `nest start --watch` processes with parent PID 1 from this repository were found before the checks (`apps/sea-runtime`, PID 33234; `apps/api-gateway`, PID 33206). Both were killed. Their origin was not verified.
- **Test scripts.** `test` is now the no-op message (`test: not defined for this package`) with exit 0 (REQ-ECO-02). `test:watch`, `test:cov`, `test:debug`, `test:e2e` were deleted because they called removed configs.
- **`@nestjs/mau`.** Added by `nest new` as a devDependency. Not reviewed; not removed. Not verified what it does.
- **Projects list.** `pnpm nx show projects` also lists the root project `lan-solution-template`, as in 1a. The brief expected three names.
- **Root scripts.** Still print the no-op message after success (see the note under Commands run).
- **Health path.** The brief used `<health path>`. The generated path is `/health` from `@Controller('health')`. `GET /` (generated `AppController`, `Hello World!`) is kept.
- **Configuration (replaces `PORT`).** Apps read no environment variable and no file (`rg 'process\.env|process\.argv|dotenv|@nestjs/config|readFileSync'` over `apps/*/src` prints nothing). Each app validates its settings with a Zod schema once, freezes the result and injects it by the `SERVER_CONFIG` token. `api-gateway` defaults to `127.0.0.1:3000`; `sea-runtime` defaults to `127.0.0.1:3001`. The hostname is limited to `127.0.0.1`, so `0.0.0.0` is rejected. Invalid input throws a `ZodError` at startup (edit 39). For now the input is `{}`, so the defaults apply. Persisted `config.json` is POC-3 scope and is not implemented here.
- **Config shape.** The brief asked for a Zod "config class". `nest generate` produces only empty classes, so the config is a schema, a frozen type and a parse function. Not verified against the nest-base pattern beyond its file layout.
- **App `README.md` files** generated by `nest new` were deleted (manual edit 8), not kept: they lack a `toon-meta` block and break the docs regeneration command.
- **Lint.** `lint` script was not run. The generated script runs `oxlint --type-aware src/ test/` and `test/` does not exist.
- **Nest version pin.** The CLI `12.0.11` and the core `12.3.2` come from different releases of the same line. `@nestjs/schematics` `12.0.12` is what the CLI resolved. Not verified that the CLI generates correctly for core `12.3.2` beyond the dev run.

## Standalone change (REQ-RUNTIME-02)

- `apps/sea-runtime/src/main.ts`: `await NestFactory.createApplicationContext(RuntimeModule);`. `RuntimeModule` is in `src/runtime/runtime.module.ts`, generated by `nest generate module`.
- Removed from `sea-runtime`: `AppModule`, `AppController`, `AppService`, `ConfigModule`, `server-config.ts` (port and hostname config), and the `@nestjs/platform-node` dependency.
- Lifecycle at this step: no `OnModuleInit` and no `enableShutdownHooks` were added. Nothing kept the event loop alive, so the dev process exited with code 0 after init. Later on this branch the supervisor spawns the service children (see POC-1c). Outside a SEA, `sea-runtime` still exits with code 0 after init.

## Later changes on this branch

These commits follow the 1b slice on the same branch. Details and observed results are in [POC-1c](POC-01c-Result.md).

- Build: every Nest app builds through the Nest CLI rspack builder. One shared config is in `tools/rspack/nest.config.ts`. Each `nest-cli.json` sets `compilerOptions.builder` by hand. Each app builds to one ESM `dist/main.js` (plus `main.js.map`). esbuild was removed from the workspace catalog.
- SEA: `apps/sea-runtime` owns the `package` target. `tools/scripts/compile-sea.ts` is a generic assembler. The supervisor is a minimal spawn of `process.execPath --service <id>`. The Zod-validated service list is the SEA asset `services.json`.
- The Nx project `sea-build` and the `sea` field of service manifests were removed.

## Deferred

- Dispatcher, closed registry, respawn, readiness, backoff, and process-tree cleanup (REQ-RUNTIME-01, REQ-RUNTIME-03 to REQ-RUNTIME-06): POC-2. Not implemented here. The minimal supervisor spawn and stop are in POC-1c.

## Not verified

- Supervisor restart and keep-alive semantics (POC-2). POC-1c observed the supervisor alive while its child ran.
- Compatibility of Nest, Oxlint, Vitest and Prettier with Node 26 beyond the dev runs in this slice.
- Behaviour of `pnpm nx build` cache across machines.
- Full `lint` and `format` scripts.
- Whether `@nestjs/mau` is needed.
- The TypeScript pin choice against the baseline.
