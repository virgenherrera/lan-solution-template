<!-- toon-meta
fmt: TOON
doc: docs/architecture/current-state.md
title: Current state and direction
type: architecture
summary: What exists today per app, lib and tool, the test model and layout direction, and the gaps.
ids[0]:
related[8]: docs/architecture/overview.md,docs/backlog/td-compile-sea-standalone.md,docs/backlog/README.md,docs/requirements/11-nx-quality-testing.md,docs/architecture/adr/ADR-013-nest-standalone-architecture.md,docs/architecture/platform-matrix.md,docs/results/RESEARCH-app-suite-test-doubles.md,docs/architecture/stages.md
status: current
updated: 2026-11-09
-->

# Current state and direction

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md) | [Test doubles research](../results/RESEARCH-app-suite-test-doubles.md)

## Navigation

- [At a glance](#at-a-glance)
- [Purpose](#purpose)
- [Component map](#component-map)
- [Direction](#direction)
- [Gaps](#gaps)
- [Open decisions](#open-decisions)
- [Decided](#decided)
- [Open items from the test-double research](#open-items-from-the-test-double-research)
- [ADR implementation status](#adr-implementation-status)
- [Stages and promotion tools](stages.md)

---

## At a glance

| Question | Answer | Section |
| --- | --- | --- |
| What exists? | Five apps, three libs, and loose scripts and configs under `tools/` | [Component map](#component-map) |
| Where does the human want to go? | One APP suite per app under `./tests/<app>/`; no unit or integration tests | [Direction](#direction) |
| What is missing? | A real runner for the smoke scripts, a `tools/scripts` tsconfig, desktop and web tests | [Gaps](#gaps) |
| What is not decided? | The sea-runtime APP suite design, Playwright for web-angular, the later app rename | [Open decisions](#open-decisions) |
| What was decided about test doubles? | Real database, temp base path for files | [Decided](#decided) |
| How far are the ADRs built? | Counts per ADR | [ADR implementation status](#adr-implementation-status) |

---

## Purpose

[Back to navigation](#navigation)

This page says what exists now and where the human decided to move. It is not a requirement. It adds no id. The requirements stay in [docs/requirements](../requirements/README.md), and the target design stays in the [overview](overview.md). Where a claim has no file behind it, the page says "not verified".

---

## Component map

[Back to navigation](#navigation)

| Component | What it does | Runs as | Tested today |
| --- | --- | --- | --- |
| `apps/api-gateway` | Nest gateway that serves `/api` and the PWA over HTTPS and talks to the database. | Gateway child process (`--service gateway`) of the single SEA; Nest watch mode in development. | `tsc --noEmit` and one Jest spec, `apps/api-gateway/test/health/get-health.spec.ts`. |
| `apps/sea-runtime` | Nest standalone supervisor: starts, restarts and stops the services and reports status on stdout. | Supervisor process, the entry of the single SEA; the Tauri sidecar. | `tsc --noEmit`; `sea-runtime:package` runs `tools-cli smoke-sea`; `sea-runtime:smoke-pg` runs `tools-cli smoke-pg`. No test files. |
| `apps/web-angular` | Angular PWA that the gateway serves. | Static assets inside the SEA; `ng serve` behind a dev proxy in development. | `tsc --noEmit -p tsconfig.app.json` only. `test:dynamic` is an `echo`. |
| `apps/desktop` | Tauri shell that starts the supervisor as a sidecar, plus the macOS installer scripts. | Native desktop process (Rust) and the build-time installer step. | `tsc --noEmit -p tsconfig.json`, `cargo check`, and a WebdriverIO e2e (`apps/desktop/e2e/host.e2e.ts`, run by `tools-cli e2e-desktop`). No Rust unit tests. |
| `libs/shared-core` | Shared contracts, Zod schemas, config and the logger. | Library, bundled into each process. | `tsc --noEmit` only. `test:dynamic` is an `echo`. |
| `libs/service-registry` | Closed service registry, dispatcher, startup order and aggregate state. | Library, bundled into the supervisor and the dispatcher. | `tsc --noEmit` only. `test:dynamic` is an `echo`. |
| `libs/db-migrations` | Drizzle migrations and descriptors for the sqlite and pg engines. | Library; the SQL is built ahead of time and embedded in the SEA. | `tsc --noEmit`; `parity` runs `tools-cli db-parity`; `drift:sqlite` and `drift:pg` use `git diff --exit-code`. |
| `tools/scripts` | One Node script, `release-version-actions.ts`, the `versionActions` module that Nx loads. | Node scripts started by package scripts and Nx targets; some run by hand. | The smoke scripts are their own checks. No other test. |
| `apps/tools-cli` | Nest standalone CLI (`nest-commander`) that replaces `tools/scripts` command by command. Today it holds `branch-name` (REQ-VERSION-02), `compile-sea`, `db-parity`, `e2e-desktop`, `generate-certs`, `installer-build`, `installer-macos`, `pack-migrations`, `smoke-dev`, `smoke-pg`, `smoke-sea`, `stage-sidecar`, `test-filter`, `trust-ca`, `verify-platform` and `version-check`. `compile-sea` is split into the services under `apps/tools-cli/src/sea`. `tools/scripts/release-version-actions.ts` stays a script: Nx loads it by path as the `versionActions` module of `nx.json` and needs a default-exported class, which a command is not. | Built with `nx build tools-cli`; run with `pnpm tools <command>` (`pnpm release:branch` calls it). | `tsc --noEmit` only. No test files. |
| `tools/rspack` | One rspack config for the Nest bundle (`tools/rspack/nest.config.ts`). | Build time, read by the bundler. | Not tested. |
| `tools/vector` | The pinned sqlite-vector asset table (`tools/vector/sqlite-vector-1.1.2.json`). | Data file read by `tools-cli compile-sea`. | Not tested. |

Process view of the production topology. The edges come from the [overview](overview.md#production-topology) and the [Tauri sidecar](overview.md#tauri-sidecar) sequence.

```mermaid
flowchart TB
    DESK["apps/desktop: Tauri shell"]
    SUP["apps/sea-runtime: supervisor process"]
    GW["apps/api-gateway: gateway process"]
    WEB["apps/web-angular: PWA assets"]
    DB[("database")]
    DESK -->|"starts sidecar, stdin commands"| SUP
    SUP -->|"stdout status events"| DESK
    SUP -->|"spawn --service gateway, IPC"| GW
    GW --> DB
    GW -->|"serves"| WEB
    DESK -->|"WebView shows"| WEB
```

---

## Direction

[Back to navigation](#navigation)

The human decided this on 2026-11-09. It is a direction, not a requirement. No requirement changed.

### Test model

Unit tests and integration tests are forbidden. There are no exceptions ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)). Only the edges of the system, such as the filesystem and outbound API calls, are mocked, and those mocks are asserted with spies (`toHaveBeenCalledTimes`, `toHaveBeenCalledWith`, `not.toHaveBeenCalled`). The database stays real. The app's own providers and business contracts are never mocked. Suites that run a real executable cannot spy across the process boundary. They assert effects on the real artifact (real files, ports and processes), as REQ-TEST-01 says. The SRS already states this. REQ-TEST-01 allows two kinds of tests: real application (APP) tests and E2E tests of the installed product. APP suites are black-box, app-level tests that go through the assembled app. Nest and Angular call this kind e2e. Each app gets one APP suite, with its own runner setup.

The target layout is `./tests/<app>/`, one folder per app. `<app>` is the app's folder name under `apps/`, so the later app rename renames these folders. This layout is the human's direction. It is not an SRS requirement and adds no id.

| App | Runner | SRS id | Exists today? |
| --- | --- | --- | --- |
| `api-gateway` | Jest and Supertest on a real `INestApplication` | [REQ-TEST-04](../requirements/11-nx-quality-testing.md) | Yes: `apps/api-gateway/test/health/get-health.spec.ts`. The spec lives in `apps/api-gateway/test/` and moves to `tests/<app>/` with the layout. |
| `web-angular` | Playwright | [REQ-TEST-05](../requirements/11-nx-quality-testing.md) | No test files. `test:dynamic` is an `echo`. |
| `sea-runtime` and its compiled SEA binary | Not chosen | [REQ-TEST-07](../requirements/11-nx-quality-testing.md) | Partly: hand-written smoke checks, the `smoke-sea` and `smoke-pg` commands of `apps/tools-cli`, no runner. |
| `apps/desktop` | WebdriverIO | [REQ-TEST-08](../requirements/11-nx-quality-testing.md) | Yes: `apps/desktop/e2e/host.e2e.ts`, run by `tools-cli e2e-desktop`. It covers the sidecar start, the startup splash, the move to the gateway origin (host log) and the navigation filter. |
| `tools/scripts`, as a future CLI app | Not chosen | None | No. It gets its own APP suite when it becomes an app. |

`apps/api-gateway/test/health/get-health.spec.ts` is an APP test, not a unit test. `apps/api-gateway/test/get-test-context.ts` builds the real `AppModule` with `Test.createTestingModule`, runs `app.init()` and sends requests through `supertest(app.getHttpServer())`. It uses a real SQLite file and the real config file in a temporary base. Today it mocks nothing and uses a real SQLite file. Under the edge-mock rule above, edges such as the filesystem and outbound API calls may be spied.

### Other direction

- `web-angular`: Playwright setup. `ng add playwright-ng-schematics` is a candidate. Not verified that it fits the current Angular version (the repo pins Angular through `catalog:angular` in `pnpm-workspace.yaml`).
- `sea-runtime`: to investigate and design. A hypothesis: a Jest black-box suite against the runtime in a child process. A possible two-level split: the compiled runtime, and the real SEA binary ([REQ-TEST-07](../requirements/11-nx-quality-testing.md) requires the compiled binary). A rebuild of the SEA costs about 3 minutes. `pnpm test -- --filter @app` selects nothing for `sea-runtime` today, because the smoke runs in `package` (see [POC-2g](../results/POC-02g-real-binary-smoke.md)).
- `tools/scripts`: becoming one CLI app, `apps/tools-cli`, built on `nest-commander` 3.21.0 (the human decided on 2026-11-09). `branch-name`, `compile-sea`, `db-parity`, `e2e-desktop`, `generate-certs`, `installer-build`, `installer-macos`, `pack-migrations`, `smoke-dev`, `smoke-pg`, `smoke-sea`, `stage-sidecar`, `test-filter`, `trust-ca`, `verify-platform` and `version-check` are commands; `release-version-actions.ts` stays a module for Nx. Every other script is ported. Help prints `tools-cli` as the program name. See [TD-TOOLS-01](../backlog/td-compile-sea-standalone.md).
- vitest is not part of the plan. The vitest entry in `apps/sea-runtime/package.json` is unused: no vitest config and no test file exist.

---

## Gaps

[Back to navigation](#navigation)

| Today | Target | What closes the gap |
| --- | --- | --- |
| Hand-written `check()` smoke scripts (APP tests with no real runner): `tools-cli smoke-sea`, `tools-cli smoke-pg`, `tools-cli verify-platform`, `tools-cli smoke-dev`. | A real runner and the `./tests/sea-runtime/` APP suite (REQ-TEST-07). | No page yet. The sea-runtime APP suite design is open. |
| The Rust desktop shell has no unit tests. It has `cargo check` and a WebdriverIO e2e. | Not decided. | No page yet. |
| `web-angular` and the three libs have only `tsc --noEmit`. Their `test:dynamic` scripts are `echo` no-ops. | Playwright e2e for the web app (direction). Libs: not decided. | No page yet. |

---

## Open decisions

[Back to navigation](#navigation)

These three belong to the human. This page changes none of them.

1. The design of the `sea-runtime` APP suite: runner, compiled bundle versus the real SEA binary, and the rebuild cost of about 3 minutes.
2. The Playwright setup for `web-angular`.
3. The later rename of the apps to self-descriptive names. It renames the `tests/<app>` folders.

### Decided

The orchestrator decided the database and filesystem questions on 2026-11-09. The evidence and the reversibility of each decision are in [RESEARCH-app-suite-test-doubles](../results/RESEARCH-app-suite-test-doubles.md#decisions-taken-by-the-orchestrator-on-2026-11-09).

- The database stays real: a SQLite file under a temporary base and a real PostgreSQL container, because mocks cannot cover REQ-TEST-06.
- Files on disk (config, certs, secrets) use a temporary base path first. A spy over `node:fs` only asserts the edge. Logs and the web bundle have no filesystem edge.

### Open items from the test-double research

Spikes are not prerequisites. Each one runs as step 0 of the implementation it unblocks and ends in a go or no-go with a fallback, so no work waits for it.

- Open: a `DbAdapter` injection seam is not built. It would be needed to double the database in the gateway.
- Open: the REQ-TEST-06 scenarios need a sea-runtime app context that does not exist yet. Migrations and the vector backend run in the `apps/sea-runtime` `PersistenceService`.
- Spike, step 0 of the first APP suite that needs the `node:fs` spy: the pass-through wrapper under ts-jest ESM in `libs/shared-core`. Go: the spy asserts the call. No-go: assert the effect on the temporary base path only.
- Spike, step 0 of the Tauri APP suite: import `@wdio/tauri-plugin` in a wdio-only frontend build to explain the `addTauriApi` failure. Go: the service drives the app. No-go: keep the REQ-TEST-08 host checks and record the cause.
- Not verified: the claim that Playwright cannot drive Tauri.
- Linux installer: only the stub of `installer-build` was run, in a `node:26.13` `linux/arm64` container (2026-11-09): it prints `installer not implemented on linux` and exits 0. No Linux installer exists. A real Linux host (WebKitGTK) and a real Windows host are still needed; see [Windows and Linux distribution](../backlog/td-windows-linux-distribution.md).
- `webdriverio` is about one minor behind.

[Back to navigation](#navigation)

---

## ADR implementation status

[Back to navigation](#navigation)

The counts come from an audit of 194 decision rows across the 13 ADRs (`jq`, grouped by `implementation`). Each ADR holds its own row table in its `## Implementation status` section.

| ADR | Implemented | Partial | Not implemented | Outdated | Not verified |
| --- | --- | --- | --- | --- | --- |
| [ADR-001](adr/ADR-001-version-substitutions.md) | 7 | 2 | 1 | 0 | 0 |
| [ADR-002](adr/ADR-002-single-sea-portability.md) | 21 | 7 | 0 | 0 | 0 |
| [ADR-003](adr/ADR-003-config-and-db-strategy.md) | 12 | 0 | 2 | 1 | 0 |
| [ADR-004](adr/ADR-004-drizzle-build-time-migrations.md) | 16 | 0 | 1 | 1 | 0 |
| [ADR-005](adr/ADR-005-live-schema-validation.md) | 13 | 1 | 0 | 0 | 0 |
| [ADR-006](adr/ADR-006-sidecar-status-contract.md) | 13 | 1 | 0 | 0 | 0 |
| [ADR-007](adr/ADR-007-persistence-system.md) | 16 | 2 | 0 | 1 | 0 |
| [ADR-008](adr/ADR-008-tls-trust-model.md) | 21 | 1 | 0 | 1 | 0 |
| [ADR-009](adr/ADR-009-desktop-process-model.md) | 14 | 0 | 0 | 0 | 0 |
| [ADR-010](adr/ADR-010-first-run-admin-setup.md) | 0 | 0 | 7 | 0 | 0 |
| [ADR-011](adr/ADR-011-macos-installer-and-install-time-trust.md) | 12 | 0 | 0 | 0 | 0 |
| [ADR-012](adr/ADR-012-sea-runtime-child-registry.md) | 5 | 0 | 1 | 0 | 0 |
| [ADR-013](adr/ADR-013-nest-standalone-architecture.md) | 8 | 4 | 0 | 0 | 2 |

The audit data file is not part of the repository. The row tables inside the ADRs are the record.
