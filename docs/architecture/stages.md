<!-- toon-meta
fmt: TOON
doc: docs/architecture/stages.md
title: Stages and promotion tools
type: architecture
summary: The human's stage idea of 2026-11-09, stage table, promotion tools, cross-stage contracts, config layers and open questions.
ids[0]:
related[5]: docs/architecture/overview.md,docs/architecture/current-state.md,docs/requirements/11-nx-quality-testing.md,docs/backlog/td-compile-sea-standalone.md,docs/architecture/adr/ADR-013-nest-standalone-architecture.md
status: proposed
updated: 2026-11-09
-->

# Stages and promotion tools

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md)

[Up](overview.md)

## Navigation

- [Human direction](#human-direction)
- [Stage model](#stage-model)
- [Runtime as a host for more services](#runtime-as-a-host-for-more-services)
- [Promotion tools](#promotion-tools)
- [Cross-stage contracts](#cross-stage-contracts)
- [Config layers](#config-layers)
- [Open questions](#open-questions)

---

## Human direction

[Back to navigation](#navigation)

Source: the human, 2026-11-09, in conversation. This is a paraphrase, not a quote. It is a direction, not a requirement. It adds no id and changes no SRS text. Nothing on this page is decided.

- The product is one fullstack Node app (Nest backend, Angular frontend).
- The sea-runtime is that app in one executable, so only one Node binary is embedded.
- It is built as a supervisor, so more microservices can be added later if a feature needs them.
- The Tauri desktop is the same app again, as a sidecar.
- Each layer is a stage that bounds the APP test suites ([current-state](current-state.md#test-model)).
- The transversal promotion tools are to be redesigned surgically, after asking what each one is for.

The full line-by-line duplicate inventory is in git history at commit 79c2cf4. It will be regenerated when the refactor starts.

## Stage model

[Back to navigation](#navigation)

The stage names are working labels ([open](#open-questions)). Checked against the code on 2026-11-09.

| Stage | What it is | Boundary in | Boundary out | Suite and runner | Exists today? |
| --- | --- | --- | --- | --- | --- |
| FE | The Angular PWA. | Gateway responses under `/api`. | Built bundle files that `compile-sea` embeds. | Playwright, [REQ-TEST-05](../requirements/11-nx-quality-testing.md) | No. |
| BE | The Nest gateway: HTTP, database, config file. | `config.json`, `--web` argv, web bundle and `state`/`shutdown` over IPC. | HTTP responses and `ready` over IPC. | Jest and Supertest, [REQ-TEST-04](../requirements/11-nx-quality-testing.md) | Yes (`apps/api-gateway/test`). |
| Runtime | BE, FE assets, migrations and sqlite-vector in one SEA binary with a supervisor. | argv roles, `config.json`, sidecar commands on stdin. | Status events on stdout, certs for `--generate-certs`. | Not chosen; [REQ-TEST-07](../requirements/11-nx-quality-testing.md), [REQ-TEST-06](../requirements/11-nx-quality-testing.md) | Partly: `smoke-sea`, `smoke-pg`. |
| Desktop | The runtime as a Tauri sidecar, plus WebView and installer. | Staged sidecar, its stdout events, `net` of `config.json`. | `shutdown` on stdin, native package. | WebdriverIO, [REQ-TEST-08](../requirements/11-nx-quality-testing.md) | Yes (`apps/desktop/e2e`). |

## Runtime as a host for more services

[Back to navigation](#navigation)

The supervisor shape exists so more services can run next to the gateway (human direction). One service exists today and no second one was ever built. Pieces that already support it:

- Dispatcher: `--service <id>` starts one registered id (`libs/service-registry`, `dispatcher.ts`).
- Service table in `apps/sea-runtime/src/services.ts`, written by `compile-sea` into `services.json`.
- Supervisor: spawns each service as a child of the same binary (`child-spawner.ts`), ordered by `dependsOn`.
- Readiness timeout, bounded restart and graceful stop (`supervisor-config.ts`, `service-lifecycle.ts`).
- IPC control messages `ready`, `state`, `shutdown` (`control-channel.ts`).

A second service would need an entry in `services.ts`, a built bootstrap at `dist/main.js` of its project, and a bootstrap that sends `ready` and obeys `shutdown`. Not verified: how `compile-sea` resolves a second project, and whether a second service can share the gateway's ports, database or logger.

## Promotion tools

[Back to navigation](#navigation)

Each command is a provider in `apps/tools-cli/src/tools-cli.module.ts`. The column "From to" reads P(a to b) = promotes a to b, V = verifies, S = support. The classification is mine and is [open](#open-questions). Not verified: that each command is used only by the stage named.

| Command | From to | What crosses the boundary, and what is missing without it | Simplification hypothesis | Spec |
| --- | --- | --- | --- | --- |
| `pack-migrations` | P(BE to runtime) | The runtime has no SQL migrations to run until this command copies them, with `manifest.json` and `build-info.json`, into `dist/db-migrations/<engine>`. | Unknown. | [ADR-004](adr/ADR-004-drizzle-build-time-migrations.md) |
| `compile-sea` | P(BE, FE to runtime) | The bundle, the services, the web bundle and the packed migrations are separate outputs until this command embeds them in one SEA executable under `artifacts/<supervisor>`. | Needed as the stage bridge. | [REQ-SEA-01](../requirements/10-node-sea-distribution.md) |
| `stage-sidecar` | P(runtime to desktop) | Tauri finds no sidecar until this command copies the SEA executable, already named `sea-runtime-<target-triple>`, to `src-tauri/binaries`. | Needed as the stage bridge. | [REQ-DESK-01](../requirements/09-desktop-tauri.md) |
| `installer-build`, `installer-macos` | P(desktop to installer) | The Tauri host and the sidecar sit side by side after `tauri build --no-bundle`, and without these commands no `.pkg` exists; other OSes get a notice and exit 0. | Needed as the stage bridge, if the installer stays in the desktop stage. | [REQ-ECO-06](../requirements/11-nx-quality-testing.md) |
| `smoke-sea`, `smoke-pg` | V(runtime) | Nothing runs the packaged binary on high loopback ports, in a throwaway base, until `smoke-sea` does, and `smoke-pg` does the same against PostgreSQL with pgvector in Docker. | Hand-written APP checks; a standard runner under `tests/<app>` could own them (REQ-TEST-07 leaves the runner open, current-state records the direction). | [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md), [REQ-TEST-07](../requirements/11-nx-quality-testing.md), [REQ-TEST-06](../requirements/11-nx-quality-testing.md) |
| `smoke-dev` | V(FE to BE, dev loop) | Nothing proves that `ng serve` reaches the HTTPS gateway through the `/api` proxy, trusting the CA only by `NODE_EXTRA_CA_CERTS`, until this command starts both in a throwaway base. | Hand-written APP check; Playwright (REQ-TEST-05) could own it. | [REQ-DEV-02](../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-04](../requirements/06-web-gateway-https-pwa.md) |
| `verify-platform` | V(runtime, desktop) | A passing build proves no runtime; this command starts the packaged SEA binary and the Tauri package on this host, in temporary install directories. | Hand-written APP check of the artifacts; unknown. | [REQ-SEA-06](../requirements/10-node-sea-distribution.md), [REQ-TEST-09](../requirements/11-nx-quality-testing.md) |
| `e2e-desktop` | V(desktop) | The WebdriverIO suite needs an instrumented Tauri host, a base directory with the sidecar and a check that no process is left, and this command provides all three. | The suite already uses a standard runner (WebdriverIO, REQ-TEST-08); the wrapper is stage setup, so unknown. | [REQ-TEST-08](../requirements/11-nx-quality-testing.md) |
| `db-parity` | V(BE persistence) | The migrations and the descriptor in `libs/db-migrations/contract/tables.ts` can drift apart until this command migrates a throwaway database and compares the two. | Unknown. | [DBM-Schema-Gate-Result](../results/DBM-Schema-Gate-Result.md) |
| `generate-certs`, `trust-ca` | S(BE, runtime; dev machine) | The gateway only validates `<base>/certs` and never writes there, so `generate-certs` creates the CA and leaf, and `trust-ca` makes this machine accept that CA. | `generate-certs` has a second entry point in the runtime (`libs/shared-core/src/tls/certs-command.ts`); `trust-ca` unknown. | [ADR-008](adr/ADR-008-tls-trust-model.md), [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md), [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md) |
| `test-filter` | S(all test stages) | The root `test` script has no way to check a `@ut`, `@int` or `@app` tag before the security check and the Nx fan-out run, and this adapter adds that check. | Unknown. | [REQ-TEST-02](../requirements/11-nx-quality-testing.md) |
| `version-check`, `branch-name` | V/S(repo, release) | Nothing stops the workspace manifests, `Cargo.toml`, `Cargo.lock` and `tauri.conf.json` from drifting apart, or a PR branch from carrying no release bump, until these commands check them. | Unknown. | [REQ-VERSION-01](../requirements/11-nx-quality-testing.md), [REQ-VERSION-02](../requirements/11-nx-quality-testing.md) |
| `tools/scripts/release-version-actions.ts` | P(release version to BE, runtime, desktop) | The new release version stays in one place until this script writes it to each project `package.json` and, for Tauri, to `Cargo.toml`, `Cargo.lock` and `tauri.conf.json`. | Unknown. | [REQ-VERSION-01](../requirements/11-nx-quality-testing.md), [REQ-VERSION-03](../requirements/11-nx-quality-testing.md) |

The Spec links show where a tool is mentioned. They are not a justification, and the hypotheses are not decisions: each is a guess to check with the human, who wants to simplify by understanding why a tool exists, not by removing it.

[TD-TOOLS-01](../backlog/td-compile-sea-standalone.md) records the move of loose scripts into this CLI.

## Cross-stage contracts

[Back to navigation](#navigation)

Kept in sync by hand across a stage boundary. These are the duplicates that matter architecturally.

- Web bundle message schema: defined on both sides of the IPC (`sea-runtime` `web-bundle.ts` and `api-gateway` `web-bundle.ts`).
- Asset names and `build-info.json` format: written by `compile-sea` and `pack-migrations`, read by the runtime persistence code.
- The `net` block of `config.json`: Zod in `shared-core` `config.ts`, untyped read in Rust `sidecar.rs`.
- Install base (executable folder): `shared-core` `paths.ts` and `sidecar.rs`.
- Sidecar stdio protocol: `sidecar-protocol.ts` and `sidecar.rs`.
- Certificate generation: two entry points, `certs-command.ts` (packaged) and `generate-certs.command.ts` (dev).

## Config layers

[Back to navigation](#navigation)

| # | Layer | Declared in | Who sets the values |
| --- | --- | --- | --- |
| 1 | Persisted `config.json` (`db`, `net`, `tls`) | `libs/shared-core/src/config.ts` | The installer or the operator. |
| 2 | Gateway argv (`--web`) | `apps/api-gateway/src/schemas/server-config.ts` | The supervisor. |
| 3 | Dispatcher and SEA argv | `libs/service-registry/src/schemas/dispatcher-config.ts` | Code defaults. |
| 4 | Supervisor policy | `libs/service-registry/src/schemas/supervisor-config.ts` | Code defaults. |
| 5 | Assembler | `libs/service-registry/src/schemas/assembler-config.ts` | Code defaults. |
| 6 | Logger | `libs/shared-core/src/schemas/logger-config.ts` | Each process at its call site. |

## Open questions

[Back to navigation](#navigation)

All open. The human decides. This page decides none.

1. Which tools are transversal (serve every stage) and which belong to one stage?
2. What are the stage names? FE, BE, runtime and desktop are working labels.
3. Do FE and BE stay separate stages? Today FE has no suite and BE has one.
4. Is the installer a fifth stage or part of desktop?
5. Where does the runtime APP suite sit: compiled bundle, SEA binary, or both ([current-state](current-state.md#open-decisions))?
6. Where should the cross-stage contracts live: in the lib of the stage that reads them, or elsewhere?
7. For each promotion tool, what crosses the stage boundary through it and what would the stage lack without it? Only then: does a simpler way (like installing Jest and Playwright instead of hand-made test tooling) fit, and are the requirements that mention it still right?
