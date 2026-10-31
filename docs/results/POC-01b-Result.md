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

- `apps/gateway-nest` and `apps/runtime-nest` generated with `@nestjs/cli@12.0.11 new`. `libs/shared-core` created with `pnpm init` and `tsc --init`.
- Express removed from both apps. Both use `NodeAdapter` from `@nestjs/platform-node@12.3.2`.
- `gateway-nest` answers `GET /health` with HTTP 200 and `{"status":"ok"}` in dev. The endpoint came from `nest generate controller`.
- `runtime-nest` starts in dev. Its standalone bootstrap is deferred to POC-2 (REQ-RUNTIME-02).
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
| 7 | `pnpm dlx @nestjs/cli@12.0.11 new gateway-nest --directory=apps/gateway-nest -p pnpm -g -s -t --no-observe` | exit 0; 15 files created (`nest-cli.json`, `tsconfig*.json`, `package.json`, `src/` with three files, `.oxlintrc.json`, `.prettierrc`, `.gitattributes`, `README.md`, `AGENTS.md`, two `vitest.config*.ts`) |
| 8 | same with `runtime-nest` | exit 0; same layout |
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
| 21 | `pnpm exec nest generate controller health --no-spec --flat` in `apps/gateway-nest` | exit 0; `CREATE src/health.controller.ts`, `UPDATE src/app.module.ts` |
| 22 | Manual edit `apps/gateway-nest/src/health.controller.ts` (see Manual edits) | n/a |
| 23 | `pnpm nx show projects` | exit 0; `["gateway-nest","runtime-nest","shared-core","lan-solution-template"]` |
| 24 | `pnpm nx build gateway-nest`, `pnpm nx build runtime-nest`, `pnpm nx build shared-core` | each exit 0; `1 task: 1 succeeded` each |
| 25 | `PORT=3100 pnpm --filter gateway-nest start:dev` (background) | ready after 3 s; log `Nest application successfully started`, routes `{/health, GET}` mapped |
| 26 | `curl -i http://localhost:3100/health` | `HTTP/1.1 200 OK`, `Content-Type: application/json; charset=utf-8`, body `{"status":"ok"}` |
| 27 | kill the dev process, `lsof -i :3100` | exit 1, no output: port free |
| 28 | `PORT=3200 pnpm --filter runtime-nest start:dev` (background) | ready after 3 s; `Nest application successfully started`, no error line |
| 29 | kill the dev process, `lsof -i :3200` | exit 1, no output: port free |
| 30 | `rg -n "gateway-nest\|runtime-nest" apps/gateway-nest/src apps/runtime-nest/src libs` | exit 1, no match |
| 31 | `rg -n 'express\|fastify' apps libs --glob package.json` | exit 1, no match |
| 32 | `grep -rn '[\^~]' apps/*/package.json libs/shared-core/package.json pnpm-workspace.yaml package.json` | exit 1, no match |
| 33 | `pnpm build`, `pnpm test`, `pnpm package` (root) | each exit 0; each runs `nx run-many` (3 tasks, `3 succeeded`) and prints `<op>: not defined for this package` |
| 34 | `pnpm install --frozen-lockfile` | exit 0 |

The root `build`, `test` and `package` scripts now run real `nx run-many` tasks for the three projects. The no-op message prints after success, as predicted in 1a. The message is still printed, so it does not tell the reader whether a task ran. Revisit before POC-2.

## Manual edits

Each edit has no CLI route. Every other file was written by a CLI or by `pnpm`.

| # | File | Edit | Reason |
|---|---|---|---|
| 1 | `pnpm-workspace.yaml` | Added `packages:` with `- apps/*` and `- libs/*` | No CLI writes the workspace package list. `pnpm add -w` does not add it |
| 2 | `.gitignore` | Appended `dist/` and `*.tsbuildinfo` | No CLI writes these. `nest build` writes `dist/` and `tsconfig.build.tsbuildinfo` in each app |
| 3 | `apps/gateway-nest/src/main.ts` | Import `NodeAdapter` from `@nestjs/platform-node`; `NestFactory.create(AppModule, new NodeAdapter())` | `nest new` has no flag for the adapter. REQ-STACK-04 forbids Express |
| 4 | `apps/runtime-nest/src/main.ts` | Same as edit 3 | Express was removed from `runtime-nest` too. Without the adapter the app would fail at start. The standalone bootstrap stays deferred |
| 5 | `apps/gateway-nest/src/health.controller.ts` | Added `Get` to the import; `@Get()` with `check(): { status: string }` returning `{ status: 'ok' }` | `nest generate controller` creates an empty class only. The handler body has no CLI route |
| 6 | `libs/shared-core/src/index.ts` | Created with `export const sharedCoreName = 'shared-core';` | `tsc --init` creates no source file. This is the minimum export |
| 7 | Deleted `apps/gateway-nest/vitest.config.ts`, `apps/gateway-nest/vitest.config.e2e.ts`, `apps/gateway-nest/AGENTS.md`, and the same three in `apps/runtime-nest` | `rm` | Test configs and an app-level AGENTS.md are forbidden in this slice |
| 8 | Deleted `apps/gateway-nest/README.md` and `apps/runtime-nest/README.md` | `git rm` | Nest boilerplate README. The docs check (`docs/standards/README.md`) requires a `toon-meta` block on every tracked `.md` except root `AGENTS.md` and `README.md`, and the regeneration command would fail on the app READMEs |

Not manual: the `test` script and the removed `test:*` scripts (`pnpm pkg`), the `build` script and `main`/`types` in `libs/shared-core/package.json` (`pnpm pkg set`), the health controller route file (`nest generate`), and the `app.module.ts` registration (`nest generate`).

## Deviations

- **Express removal.** Removed by `pnpm remove` and replaced by `pnpm add -E`. Both changed `package.json` and `pnpm-lock.yaml` in the same first commit as the generated files. The commit split differs from the brief: commit (a) holds generation, manifests and workspace wiring, commit (b) holds the `main.ts` adapter edit and the health endpoint.
- **TypeScript version.** The baseline gives no TypeScript pin. `6.0.3` was chosen because it is the newest 6.x line already requested by `@nestjs/cli` and its schematics (`^6.0.2`), it is older than 24 h, and it avoids the TypeScript 7 major. Not verified against the baseline; open for a decision.
- **Test tooling kept.** `vitest`, `vite`, `@vitest/coverage-v8`, `supertest`, `@types/supertest`, `@nestjs/testing` remain as devDependencies. `tsconfig.json` of each app lists `vitest/globals` in `types`, which fails to compile if the package is removed. The configs and spec files are gone; no test was added. No test script runs anything.
- **Test scripts.** `test` is now the no-op message (`test: not defined for this package`) with exit 0 (REQ-ECO-02). `test:watch`, `test:cov`, `test:debug`, `test:e2e` were deleted because they called removed configs.
- **`@nestjs/mau`.** Added by `nest new` as a devDependency. Not reviewed; not removed. Not verified what it does.
- **Projects list.** `pnpm nx show projects` also lists the root project `lan-solution-template`, as in 1a. The brief expected three names.
- **Root scripts.** Still print the no-op message after success (see the note under Commands run).
- **Health path.** The brief used `<health path>`. The generated path is `/health` from `@Controller('health')`. `GET /` (generated `AppController`, `Hello World!`) is kept.
- **Ports.** Both apps read `PORT`, default 3000. The checks used 3100 and 3200 to avoid a clash.
- **App `README.md` files** generated by `nest new` were deleted (manual edit 8), not kept: they lack a `toon-meta` block and break the docs regeneration command.
- **Lint.** `lint` script was not run. The generated script runs `oxlint --type-aware src/ test/` and `test/` does not exist.
- **Nest version pin.** The CLI `12.0.11` and the core `12.3.2` come from different releases of the same line. `@nestjs/schematics` `12.0.12` is what the CLI resolved. Not verified that the CLI generates correctly for core `12.3.2` beyond the dev run.

## Deferred

- **REQ-RUNTIME-02 standalone bootstrap** (`createApplicationContext`) for `runtime-nest`: deferred to POC-2. Not implemented here. `runtime-nest` keeps the HTTP bootstrap it was generated with, adapted to `NodeAdapter`.

## Not verified

- Compatibility of Nest, Oxlint, Vitest and Prettier with Node 26 beyond the dev runs in this slice.
- Behaviour of `pnpm nx build` cache across machines.
- Full `lint` and `format` scripts.
- Whether `@nestjs/mau` is needed.
- The TypeScript pin choice against the baseline.
