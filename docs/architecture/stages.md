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

| Command | From to | Purpose | Spec |
| --- | --- | --- | --- |
| `pack-migrations` | P(BE to runtime) | Packs the generated SQL migrations into `dist/db-migrations/<engine>` so they travel inside the executable. | [ADR-004](adr/ADR-004-drizzle-build-time-migrations.md) |
| `compile-sea` | P(BE, FE to runtime) | Packages a supervisor app and its workspace services into one Node SEA executable under `artifacts/<supervisor>`. | [REQ-SEA-01](../requirements/10-node-sea-distribution.md) |
| `stage-sidecar` | P(runtime to desktop) | Copies the packaged SEA runtime to `apps/desktop/src-tauri/binaries` as the Tauri sidecar. | [REQ-DESK-01](../requirements/09-desktop-tauri.md) |
| `installer-build`, `installer-macos` | P(desktop to installer) | `installer-build` builds the desktop installer for this OS (a `.pkg` on macOS, a notice elsewhere); `installer-macos` builds that `.pkg` with `pkgbuild` and `productbuild`. | [REQ-ECO-06](../requirements/11-nx-quality-testing.md), [ADR-007](adr/ADR-007-persistence-system.md) |
| `smoke-sea`, `smoke-pg` | V(runtime) | `smoke-sea` runs the `@app` smoke checks against the packaged SEA runtime; `smoke-pg` runs the same kind of test against a real PostgreSQL with pgvector in Docker. | [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md), [REQ-TEST-07](../requirements/11-nx-quality-testing.md), [REQ-TEST-06](../requirements/11-nx-quality-testing.md) |
| `smoke-dev` | V(FE to BE, dev loop) | Runs the `@app` smoke test of the dev loop: `ng serve` proxies `/api` to the HTTPS gateway. | [REQ-DEV-02](../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-04](../requirements/06-web-gateway-https-pwa.md) |
| `verify-platform` | V(runtime, desktop) | Verifies the packaged SEA binary and the Tauri package on this host. | [REQ-SEA-06](../requirements/10-node-sea-distribution.md), [REQ-TEST-09](../requirements/11-nx-quality-testing.md) |
| `e2e-desktop` | V(desktop) | Builds the instrumented Tauri host, runs the WebdriverIO desktop E2E in a temporary base and checks that no process is left. | [REQ-TEST-08](../requirements/11-nx-quality-testing.md) |
| `db-parity` | V(BE persistence) | Migrates a throwaway database with the real migrations and compares its structure with the descriptor. | [DBM-Schema-Gate-Result](../results/DBM-Schema-Gate-Result.md) |
| `generate-certs`, `trust-ca` | S(BE, runtime; dev machine) | `generate-certs` creates or renews the CA and the gateway leaf certificate under `<base>/certs`; `trust-ca` trusts that CA in the OS store of this machine. | [ADR-008](adr/ADR-008-tls-trust-model.md), [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md), [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md) |
| `test-filter` | S(all test stages) | Validates the test selection tag, prints the runner arguments and runs the security and test steps. | [REQ-TEST-02](../requirements/11-nx-quality-testing.md) |
| `version-check`, `branch-name` | V/S(repo, release) | `version-check` checks that every workspace manifest, `Cargo.toml`, `Cargo.lock` and `tauri.conf.json` share one version; `branch-name` validates a PR source branch name and prints its release bump. | [REQ-VERSION-01](../requirements/11-nx-quality-testing.md), [REQ-VERSION-02](../requirements/11-nx-quality-testing.md) |
| `tools/scripts/release-version-actions.ts` | P(release version to BE, runtime, desktop) | Writes the new release version to each project `package.json` and, for a Tauri project, to `Cargo.toml`, `Cargo.lock` and `tauri.conf.json`. | [REQ-VERSION-01](../requirements/11-nx-quality-testing.md), [REQ-VERSION-03](../requirements/11-nx-quality-testing.md) |

The Spec links show where a tool is mentioned. They are not a justification: whether each requirement is still right is [open](#open-questions).

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
7. Does each promotion tool still earn its place, judged by what it does for a stage, and are the requirements that mention them still right or drift?
