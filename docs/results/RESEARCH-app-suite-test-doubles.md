<!-- toon-meta
fmt: TOON
doc: docs/results/RESEARCH-app-suite-test-doubles.md
title: "RESEARCH test doubles for the APP suites"
type: backlog
summary: "Source-backed research on database, filesystem and Tauri test doubles for APP suites, with the decisions taken."
ids[0]:
related[5]: docs/requirements/11-nx-quality-testing.md,docs/architecture/current-state.md,docs/results/POC-05-Result.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/architecture/adr/ADR-008-tls-trust-model.md
status: current
updated: 2026-11-09
-->

# RESEARCH test doubles for the APP suites

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md)

Branch: `docs/architecture-status-and-test-strategy`. Input of [Current state and direction](../architecture/current-state.md). The test policy is in [REQ-TEST-01](../requirements/11-nx-quality-testing.md), REQ-TEST-04, REQ-TEST-06 and REQ-TEST-08. This page adds no requirement id.

## Navigation

- [Question](#question)
- [Method](#method)
- [Database](#database)
- [Files on disk](#files-on-disk)
- [Tauri end-to-end](#tauri-end-to-end)
- [Decisions taken by the orchestrator on 2026-11-09](#decisions-taken-by-the-orchestrator-on-2026-11-09)
- [Open items and spikes](#open-items-and-spikes)

---

## Question

The human asked which parts of the system the APP suites may replace with a double. Three areas: the database (SQLite and PostgreSQL), the files the app reads and writes on disk (config, certs, secrets, logs, web bundle), and the Tauri end-to-end suite. The rule to keep is the edge-mock rule of REQ-TEST-01: mock only the edges and assert the mocks with spies.

[Back to navigation](#navigation)

## Method

Three read-only investigations (database, files on disk, Tauri) and one blind check ran on 2026-11-09. The check answered ten questions without seeing the investigators' conclusions. The check itself could not verify two items. Every item the page could not verify carries the words "not verified" in its own place. Access date of all sources: 2026-11-09. Several web sources were read through search or fetch summaries, not full pages. The page says so where it matters.

[Back to navigation](#navigation)

## Database

Repo facts, read directly:

- `DbAdapter` is the port (`libs/shared-core/src/db/port.ts:39-54`). `createDbAdapter` picks the engine from `config.db.engine` (`libs/shared-core/src/db/factory.ts:21-35`).
- The gateway calls `createDbAdapter(config, paths)` with no deps (`apps/api-gateway/src/database/database.module.ts:38`). It has no vector backend and no migrator.
- Migrations and the vector backend run in the supervisor `PersistenceService` (`apps/sea-runtime/src/services/persistence.service.ts:34-48`).
- `apps/api-gateway/test/get-test-context.ts:17-41` builds a temp base, writes a `config.json` with a SQLite file `test.db`, and overrides no provider.
- `libs/shared-core/src/db/pg/adapter.ts:76-83` connects with `pg.Client` over TCP and reads the password from a file.
- `tools/scripts/smoke-pg.ts:1-7` already starts throwaway `pgvector/pgvector:pg17` containers on random loopback ports and removes them. It needs Docker and never skips.

Options. The scenarios are the ones listed in REQ-TEST-06: initial migration, pending migration, altered checksum, restart, init failure and a genuine vector query.

| Option | Scenarios it covers | Why it falls short or fits |
|---|---|---|
| In-memory SQLite (`:memory:`) | Initial migration, pending migration, altered checksum, init failure | State dies on close, so it cannot cover restart without re-running migrations. It also needs a special case in the directory logic of `sqlite/adapter.ts:55-61`. |
| Temp-file SQLite plus fixtures | All six | Restart is close and reopen of the same file. An altered checksum is an edit through a second connection. The vector library needs its native asset on the test host. |
| PGlite in process | Migration, pending, checksum, restart if file-backed, vector by an extension | `PgAdapter` connects over TCP with `pg.Client`. Using PGlite needs a bridge or a new adapter, and REQ-TEST-06 forbids swapping the adapter. |
| Real PostgreSQL container with pgvector | All six, including the permission diagnosis in `verifyVector` | Needs a Docker daemon and a slow first image pull. The pattern already exists in `smoke-pg.ts`. |
| Hand-written in-memory `DbAdapter` double | Only gateway HTTP cases where the database is an edge | Covers no migration, checksum, restart or genuine vector scenario. It is the mock REQ-TEST-06 forbids. No injection seam exists today. |
| `drizzle-seed` | Row population only | Does not create the database or test migrations. Fit under the repo rules is not verified. |
| `pg-mem` | Unknown | pgvector support could not be verified. Not recommended. |

Verified:

- Repo path and line facts above.
- `node:sqlite` supports `allowExtension` and `:memory:` ([Node sqlite docs](https://nodejs.org/api/sqlite.html), accessed 2026-11-09, via search summary).
- PGlite lists a pgvector extension, supports `memory://` and a file data directory, and serves one connection ([PGlite extensions](https://pglite.dev/extensions/), [PGlite API](https://pglite.dev/docs/api), [PGlite README](https://github.com/electric-sql/pglite), all accessed 2026-11-09).
- The Testcontainers Node module takes a pgvector image and needs Docker ([Testcontainers PostgreSQL](https://tessl.io/registry/tessl/npm-testcontainers--postgresql), [Docker guide](https://docs.docker.com/guides/testcontainers-nodejs-getting-started/), accessed 2026-11-09, search summaries).
- `drizzle-seed` is deterministic and needs `drizzle-orm` 0.36.4 or later ([Drizzle seed](https://orm.drizzle.team/docs/seed-overview), accessed 2026-11-09, search summary).

Not verified:

- The sqliteai `sqlite-vector` library on a `:memory:` database.
- PGlite pgvector version and parity with `pgvector/pgvector:pg17`, and compatibility with the `verifyVector` SQL.
- `pg-mem` pgvector support.
- That `drizzle-seed` is acceptable as a test dev dependency under the repo rules.
- That no sea-runtime app test context exists beyond the code index finding no tests near `DbAdapter`.

[Back to navigation](#navigation)

## Files on disk

Base resolution is `sea ? dirname(execPath) : resolve(cwd)` (`libs/shared-core/src/paths.ts:21-23`). `AppPathsService` reads it at construction. `get-test-context.ts` already calls `process.chdir` to a temp base before the dynamic import of `AppModule`, so a temp base needs no code change. Paths are static at class load, so the `chdir` must come before the import, with one base per Jest worker file.

Call sites in app runtime code (blind check Q5 and the files investigation):

| Path and line | Category | Operation | In app runtime |
|---|---|---|---|
| `libs/shared-core/src/config.ts:79,83` | config | `existsSync`, `readFileSync` of `config/config.json` | Yes |
| `libs/shared-core/src/tls/identity.ts:69` | certs | `existsSync`, `readFileSync` of PEM files at gateway boot | Yes. The test `AppModule` does not run `loadTlsIdentity`. |
| `libs/shared-core/src/db/pg/adapter.ts:79` | secret | `readFileSync` of the password file | Yes, PostgreSQL engine only |
| `libs/shared-core/src/tls/generate.ts:39,63,86-105` | certs | write, rename, chmod, mkdir, read, exists | No. Only `pnpm dev:certs` runs it. |
| `libs/shared-core/src/db/sqlite/adapter.ts:60` | database directory | `mkdirSync` | Yes |
| `libs/shared-core/src/db/sqlite/vector.ts:65-88` | native extension cache | mkdir, lstat, write, rename, rm, chmod | Yes, SQLite engine |
| `apps/sea-runtime/src/persistence/dev-assets.ts:19-53` | build assets | reads of repo files | Development only |
| `apps/desktop/src-tauri/src/sidecar.rs:86,93` | config | Rust `read_to_string` of `config/config.json` | Yes, Tauri |
| `apps/desktop/src-tauri/src/trust.rs:41-59` | certs | Rust `canonicalize`, `symlink_metadata`, `File::open` of `ca.crt` | Yes, Tauri |
| `libs/shared-core/src/logger/provide-logger.ts:14-25`, `console-sink.ts:6` | logs | No file write. Sinks write to stdout or stderr through any object with `write()`. | No fs edge |
| `apps/api-gateway/src/web-bundle.ts:56-71` | web bundle | No fs. The bundle arrives as one IPC message. | No fs edge |

Techniques:

| Technique | Works with Jest 30 ESM | Spy assertions | Status |
|---|---|---|---|
| Temp base directory, real files | Yes | No direct spy. Assert the effect on the files. | Verified in repo: `get-test-context.ts` runs today. |
| `jest.unstable_mockModule('node:fs')` with a pass-through wrapper | Yes, per the Jest ESM docs | Yes | Pattern shown in the docs for `node:child_process`; the `node:fs` case is inferred, not verified. Not run in this repo. |
| `jest.spyOn` on the `node:fs` namespace | Partial | Yes | Not verified. The namespace is not writable, and `module.syncBuiltinESMExports()` only refreshes existing bindings. Fragile. |
| `memfs` | Not verified | Yes | Not verified. A virtual fs hides file modes (0600, 0700) and symlink checks. |
| `mock-fs` | Not verified | Yes | Not verified. The README names Node 18 to 22 ([mock-fs README](https://github.com/tschaub/mock-fs), accessed 2026-11-09). Support for ESM or the `node:` prefix is not verified. The repo needs Node 26.13 or later (`package.json:31`). Do not adopt. |
| Nest provider that wraps `fs` | Yes | Yes, with spy objects | Not present today. It needs app code changes. |

The ESM finding: the api-gateway Jest run is ESM (`node --experimental-vm-modules`, ts-jest `useESM`, `"type": "module"`). The Jest doc ([Jest ECMAScript modules](https://jestjs.io/docs/ecmascript-modules), accessed 2026-11-09) says: "the hoisting of `jest.mock` calls that happens in CJS won't work for ESM" and "ESM mocking is supported through `jest.unstable_mockModule`". It also says: "On Node 24.9+, automocking and manual `__mocks__` files also apply to ESM". That covers "synchronously evaluable graphs only"; a graph with top-level await, or an async-only resolver or transformer, "still requires `jest.unstable_mockModule`". The repo requires Node 26.13 or later (`package.json:31`, `"node": ">=26.13.0 <27"`), so automock and `__mocks__` should apply here. Whether an explicit `jest.mock('node:fs')` spy works in `libs/shared-core` under ts-jest ESM is not verified. The `jest.unstable_mockModule(name, factory)` plus dynamic `await import()` pattern is the one the docs show, with `node:child_process`. The `node:fs` case follows the same pattern but is inferred, not shown. The `get-test-context.ts` helper already imports `AppModule` dynamically, so the ordering fits.

A pass-through wrapper idea, marked not verified: register a `node:fs` module whose functions call the real ones, wrapped in `jest.fn`, so the test keeps real behavior and can assert `toHaveBeenCalledWith` and `not.toHaveBeenCalled`. It is not verified that this intercepts the `fs` calls made inside `libs/shared-core` under the current `moduleNameMapper` and ts-jest setup. It needs a spike inside `libs/shared-core`.

Other sources: [Node module docs](https://nodejs.org/api/module.html) and [Node permissions](https://nodejs.org/api/permissions.html), accessed 2026-11-09. The Node permission model is stable but "seat belt", not a sandbox. It could prove that the app writes only inside the temp base. Not verified inside Jest.

Rust `std::fs` reads in the Tauri shell are out of reach of JavaScript mocks. Suites that run a real executable stage the app in a temp directory and assert effects.

[Back to navigation](#navigation)

## Tauri end-to-end

Versions, from the npm and crates.io registries on 2026-11-09:

| Package | Stable | Date | Note |
|---|---|---|---|
| `@wdio/tauri-service` | 1.5.1 | 2026-10-24 | `2.0.0-next.0` published 2026-11-08. The repo pins 1.5.1. |
| `tauri-plugin-wdio` and `tauri-plugin-wdio-webdriver` | 1.5.1 | not recorded | The repo pins 1.5.1. |
| `webdriverio` | 10.2.0 | 2026-11-06 | The repo catalog pins 10.1.0 (`pnpm-workspace.yaml:58`), one minor behind 10.2.0. |
| `tauri` crate | 2.12.5 | 2026-10-21 | The repo pins 2.12.5. |
| `@tauri-apps/cli` | 2.12.4 | 2026-10-21 | The repo pins 2.12.4. |

Sources: [npm registry](https://registry.npmjs.org/@wdio/tauri-service), [crates.io tauri](https://crates.io/api/v1/crates/tauri), [crates.io tauri-plugin-wdio](https://crates.io/api/v1/crates/tauri-plugin-wdio), accessed 2026-11-09.

How the service reaches the web engine ([WebdriverIO Tauri service](https://webdriver.io/docs/wdio-tauri-service), [Tauri WebDriver docs](https://v2.tauri.app/develop/tests/webdriver/), accessed 2026-11-09):

- macOS has no WKWebView driver. The free route is the embedded provider: the plugin `tauri-plugin-wdio-webdriver` runs a WebDriver server inside the app. A paid CrabNebula provider also exists.
- Windows and Linux can use `tauri-driver` with the platform driver (Edge WebDriver or WebKitWebDriver), or the embedded provider. Not verified in this repo.
- The service spawns the app. The app path comes from `appBinaryPath` or the capability `tauri:options.application`. Auto-resolution from a project directory was removed after v1.0.x.

`browser.tauri.execute()` runs JavaScript in the frontend window and can call real Rust commands. `mock()` intercepts `invoke` in JavaScript only. It never touches Rust. Both need the Rust plugin, `withGlobalTauri` and the frontend import of `@wdio/tauri-plugin` ([plugin setup](https://raw.githubusercontent.com/webdriverio/desktop-mobile/main/packages/tauri-service/docs/plugin-setup.md), [API reference](https://raw.githubusercontent.com/webdriverio/desktop-mobile/main/packages/tauri-service/docs/api-reference.md), accessed 2026-11-09).

The plugin stays out of the commercial build. The service docs say the plugin is test-only and advise a cargo feature. The repo does this: optional crates behind the feature `wdio` (`apps/desktop/src-tauri/Cargo.toml:31-32,39-40`), registration under `cfg(feature = "wdio")` (`lib.rs:14-16`), and `withGlobalTauri` plus permissions only in the overlay `tauri.wdio.conf.json`. [POC-05-Result](POC-05-Result.md) reports 0 wdio strings in the product binary and 63 in the instrumented one. That count is a document claim, not re-run.

The POC-5 `addTauriApi` failure: [POC-05-Result](POC-05-Result.md) line 96 says the log shows a failure of `addTauriApi` in `before()` with no effect on the two tests. The log was not kept, so the exact error text is not available. A hypothesis, not verified: the frontend has no `@wdio/tauri-plugin` import (a search of `apps/web-angular/src` and the desktop app found none), so the plugin guest code never loads. The service logs a different stage name for that case (`waitForPluginInit`, from the investigation's read of the service source `index.js:3996-3999`; the file is not linked, so this is not verified), so the match is imperfect. Another hypothesis, not verified: webdriverio 10 support (service tracking issue 297 "WDIO v10 support", reported open; [issue 297](https://github.com/webdriverio/desktop-mobile/issues/297), accessed 2026-11-09; the investigation recorded the URL but the page was not re-read for this edit). To read the exact error, rerun with `logLevel` debug and keep the WDIO logs.

Verdict on the three claims of the human's unverified summary:

| Claim | Verdict |
|---|---|
| WebdriverIO launches the compiled binary and drives the native web engines. | Partly verified and imprecise. The service launches the binary. The engine is reached through a WebDriver server (embedded on macOS, `tauri-driver` on Windows and Linux), not directly. |
| `browser.tauri.mock` can intercept and simulate Rust commands. | Partly wrong. `execute` can call Rust commands. `mock` intercepts `invoke` in JavaScript only. |
| Playwright cannot drive Tauri. | Not verified. No primary source states it. The only evidence is absence on one page: [Playwright Electron API](https://playwright.dev/docs/api/class-electron), accessed 2026-11-09, lists only Electron and does not mention Tauri. The Tauri docs name WebdriverIO ([Tauri WebDriver docs](https://v2.tauri.app/develop/tests/webdriver/), accessed 2026-11-09). |

[Back to navigation](#navigation)

## Decisions taken by the orchestrator on 2026-11-09

The orchestrator took these decisions for the human, on the evidence above. They change no requirement id. REQ-TEST-06 is not edited.

| Area | Decision | Reason | Reversible | What would change it |
|---|---|---|---|---|
| SQLite | A real file under the per-test temp base. No double and no in-memory database. | An in-memory database loses state on close and cannot cover restart without re-running migrations. | Yes | A requirement that drops the restart scenario. |
| PostgreSQL | A real throwaway pgvector container, as `tools/scripts/smoke-pg.ts` does. PGlite is rejected. | `PgAdapter` connects over TCP with `pg.Client`. Swapping it is not allowed by REQ-TEST-06. | Yes | A human decision to allow an adapter swap, which edits REQ-TEST-06. |
| Seeders | Only when a scenario needs rows. No library chosen. | `drizzle-seed` is not verified under the repo rules. | Yes | A scenario that needs bulk rows, and a verified library. |
| Config, certs and secrets | A temp base path first. `get-test-context.ts` already does `process.chdir` to a temp base. A spy wrapper over `node:fs` only to assert the edge. `memfs` and `mock-fs` are not used. | The identity code validates real X.509 and key files, and file modes matter. | Yes | A failed spike of the wrapper, which would leave temp-base effects as the only assertion. |
| Logs and web bundle | No fs edge. Spy the stdout or stderr sink and the IPC message. | The code does not touch the filesystem for either. | Yes | A future file log sink or a bundle read from disk. |
| Tauri | WebdriverIO with `@wdio/tauri-service` stays, as REQ-TEST-08 says. Embedded provider on macOS. | It is the route the Tauri docs name. The plugin stays behind the `wdio` feature. | Yes | A verified Playwright route, or a failed fix of the `addTauriApi` failure. |

[Back to navigation](#navigation)

## Open items and spikes

- Not built: a `DbAdapter` injection seam. It would be needed to double the database in the gateway for non-persistence HTTP cases.
- The REQ-TEST-06 scenarios need a sea-runtime app context that does not exist yet. Migrations and the vector backend run in the `apps/sea-runtime` `PersistenceService`, not in the gateway.
- Spike: the `node:fs` pass-through wrapper under ts-jest ESM in `libs/shared-core`.
- Spike: import `@wdio/tauri-plugin` in a wdio-only frontend build to explain `addTauriApi`.
- Not verified: the claim that Playwright cannot drive Tauri.
- `webdriverio` is one minor behind (10.1.0 in `pnpm-workspace.yaml:58` against 10.2.0).

[Back to navigation](#navigation)
