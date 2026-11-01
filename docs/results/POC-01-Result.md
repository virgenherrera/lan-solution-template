<!-- toon-meta
fmt: TOON
doc: docs/results/POC-01-Result.md
title: "POC-1 Result"
type: backlog
summary: "Consolidated result of POC-1 slices 1a to 1e: versions, OS and Node matrix, manual edits, deviations and open items."
related[7]: docs/backlog/README.md,docs/backlog/poc-1e-hardening-desktop-skeleton.md,docs/results/POC-01a-Result.md,docs/results/POC-01b-Result.md,docs/results/POC-01c-Result.md,docs/results/POC-01d-Result.md,docs/architecture/adr/ADR-001-version-substitutions.md
status: current
updated: 2026-10-31
-->

# POC-1 Result

Consolidated result of POC-1, slices 1a to 1e. Backlog: [POC-1e](../backlog/poc-1e-hardening-desktop-skeleton.md) and [backlog index](../backlog/README.md). Slice pages: [1a](POC-01a-Result.md), [1b](POC-01b-Result.md), [1c](POC-01c-Result.md), [1d](POC-01d-Result.md). Decision record: [ADR-001](../architecture/adr/ADR-001-version-substitutions.md).

## Summary

- POC-1 delivered as five slices. Slices 1a to 1d are delivered (see [backlog index](../backlog/README.md)). Slice 1e is delivered on branch `minor/poc-01e-hardening`, one PR by human decision.
- Root sequence `pnpm install --frozen-lockfile && pnpm securityCheck && pnpm build && pnpm test && pnpm package` exits 0 on the host.
- `securityCheck` runs `pnpm audit --audit-level=high`. It exits 1 when the registry is unreachable (probed offline).
- `pnpm test -- --filter <tag>` is parsed by `tools/scripts/test-filter.ts`. Valid tags exit 0. An unknown tag exits 2 before any step runs. The filter is not passed to Nx.
- Tauri desktop skeleton `apps/desktop` builds with `nx build desktop` and packages with `nx package desktop`. It does not import other apps.
- Version substitutions are recorded in [ADR-001](../architecture/adr/ADR-001-version-substitutions.md).
- Verified on macOS arm64 (host) and Linux arm64 and amd64 in Docker. Not verified on Windows.

## Version verification

Baseline pins come from [02-technology-baseline.md](../requirements/02-technology-baseline.md). Values come from the slice result pages and the 1e reports. "not recorded" means no page or report gives the value. Nothing here is taken from memory.

| Package | Pinned (SRS or REQ) | Version used | Published (when a report has it) | Status |
|---|---|---|---|---|
| Node.js | `>=26.13.0 <27` (REQ-STACK-01) | v26.13.0 | v26 LTS from 2026-10-28 (schedule read in 1a) | verified (local binary); compatibility of the rest of the stack with Node 26 not verified |
| pnpm | `>=12.16.1` (REQ-STACK-02) | 12.16.1 | not recorded | verified (local binary) |
| Nx | discovered after check (REQ-STACK-08) | 24.0.2 | 24.0.2: 2026-10-26T20:25Z; 24.0.3: 2026-10-30T20:41Z (not used) | verified; deviation D1 |
| TypeScript | not pinned in baseline | 6.0.3 | 6.0.3: 2026-04-16; 7.0.2: 2026-07-08 (not used) | decision; deviation D3; not verified against baseline |
| Zod | `>=4.6.7` (REQ-STACK-06) | 4.6.7 | 2026-10-12 | verified (1b, catalog) |
| NestJS `@nestjs/core`, `common`, `testing`, `platform-node` | `12.3.2` (REQ-STACK-04) | 12.3.2 | 2026-10-27T12:03Z | verified on npm; `NodeAdapter` checked at runtime |
| `@nestjs/cli` | not in baseline | 12.0.11 | 2026-10-27T08:14Z | verified; generation for core 12.3.2 beyond the dev run not verified |
| `@nestjs/schematics` | not in baseline | 12.0.12 | not recorded | verified (resolved by the CLI) |
| Angular CLI `@angular/cli` | `>=22.2.5` (REQ-STACK-05) | 22.2.5 | not recorded | verified |
| Angular runtime `@angular/core` packages | `>=22.2.5` (REQ-STACK-05) | 22.2.4 | not recorded | deviation D2; 22.2.5 was not in the registry when checked |
| Tailwind | not in baseline | not recorded | not recorded | not verified (no version in the result pages or reports) |
| rspack `@rspack/core` | not in baseline | 2.3.0 (catalog) | not recorded | verified for the pin (1c); the build was run |
| Tauri CLI `@tauri-apps/cli` | minimum `2.12.5` (REQ-STACK-03) | 2.12.4 (exact) | npm latest 2.12.4; 2.12.5 not on npm | discrepancy D4; not decided |
| Tauri crate `tauri` | minimum `2.12.5` (REQ-STACK-03) | 2.12.5 (`Cargo.lock`) | not recorded | verified (lockfile); `tauri-build` 2.7.4, `tauri-plugin-log` 2.10.1 |
| Rust (`rustc`, `cargo`) | not in baseline | 1.94.1 | not recorded | verified (host, 1e) |
| esbuild | not in baseline | 0.28.2 in 1c, then removed as bundler | not recorded | removed from the SEA build (see note N1) |
| Playwright `@playwright/test` | in the catalog per baseline; no version pinned | 1.64.1 (scratch install, 1d) | not recorded | scratch only, not in the repo; sibling repos use 1.61.0 (observed earlier, not verified) |

Note N1, esbuild: the SEA build moved from esbuild to `@rspack/core` in 1c. `esbuild` stays in the lockfile as an optional peer of `vite` and `vitest`. Removing it needs a change in `vite` or `vitest` (open decision).

## OS and Node matrix

### Host facts

| Item | Value |
|---|---|
| Host OS | macOS 27.2 (build 26B123) |
| Architecture | arm64 |
| Node.js | v26.13.0 |
| pnpm | 12.16.1 |
| rustc and cargo | 1.94.1 |
| Xcode | 27.1 (Command Line Tools installed) |

### Verification by OS and architecture

| OS | Architecture | Status |
|---|---|---|
| macOS 27.2 | arm64 | verified (host; 1c, 1d, 1e) |
| Linux, Debian bookworm, Node container `node:26.13.0-bookworm` | arm64 | verified in Docker (1c) |
| Linux, Debian bookworm | amd64 | verified in Docker, emulated on the arm64 host with `--platform linux/amd64` (1c) |
| Windows | any | not verified |

The Linux checks cover the SEA binary from 1c. They do not cover a Tauri build on Linux or Windows. Linux and Windows Tauri builds are not verified.

### Tauri 2 supported operating systems

Source: [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/), fetched 2026-10-31 (saved in the 1e scratch area). Line numbers as given in the 1e hardening report.

| OS | Page text | Label |
|---|---|---|
| macOS | "macOS Catalina (10.15) and later", line 89 | verified (page text); host 27.2 is above 10.15 (verified by comparison) |
| Windows | "Windows 7 and later", line 90 | verified (page text); not verified on a Windows host. WebView2 minimums not recorded: not verified |
| Linux | distributions listed on the page, line 88; no version minimum stated | verified (page text); minimum not verified |

We keep no OS list of our own. Decision 15 in [PROPOSAL](../roadmap/PROPOSAL.md#decision-log) follows Tauri 2.

### Node 26 LTS record

Source: `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json`, read 2026-10-31, entry `v26` (recorded in [POC-1a](POC-01a-Result.md#node-lts-record)).

| Field | Value |
|---|---|
| start | 2026-05-05 |
| lts | 2026-10-28 |
| maintenance | 2027-10-20 |
| end | 2029-04-30 |

The pin `>=26.13.0 <27` is the v26 LTS line. Compatibility of Nest, Angular, Tauri and Zod with Node 26: not verified.

## Manual edits by slice

Each entry has no CLI route, or the CLI could not write it. Full rows with reasons are in each slice page.

### 1a ([page](POC-01a-Result.md#manual-edits))

- `pnpm-workspace.yaml`: stale `catalog` entry for `nx` removed so the CLI could recreate it. Reason: `pnpm add --save-catalog` did not update an existing entry.
- `.gitignore`: `node_modules/` line added. Reason: no CLI writes it.

### 1b ([page](POC-01b-Result.md#manual-edits))

- `pnpm-workspace.yaml`: `packages:` list (`apps/*`, `libs/*`). Reason: no CLI writes the package list.
- `.gitignore`: `dist/` and `*.tsbuildinfo`. Reason: no CLI writes them.
- `apps/api-gateway/src/main.ts`, `apps/sea-runtime/src/main.ts`: `NodeAdapter` bootstrap. Reason: no flag for the adapter; REQ-STACK-04 forbids Express.
- Health controller `@Get()` body, `libs/shared-core/src/index.ts`. Reason: generators create empty classes.
- Zod server config, config module provider, `app.module.ts` provider move. Reason: generators create no bodies.
- `apps/sea-runtime` standalone bootstrap, and removal of its HTTP files. Reason: no CLI writes a standalone bootstrap or removes generated files.
- Deleted generated Vitest configs, app `AGENTS.md` files and app `README.md` files. Reason: forbidden in this slice; READMEs break the metadata chain.

### 1c ([page](POC-01c-Result.md#manual-edits-no-cli-generated-them))

- `tools/scripts/compile-sea.ts`: generic SEA assembler. Reason: no CLI generates a SEA build script.
- `pnpm-workspace.yaml`: `tools` removed from `packages`. Reason: no CLI edits the list.
- `.gitignore`: `/artifacts`. Reason: no CLI writes it.
- `apps/sea-runtime/package.json`: `nx.targets` for build and package, and `api-gateway` dependency. Reason: no CLI writes Nx targets for this layout.
- `tools/rspack/nest.config.ts`: shared Nest rspack config. Reason: no CLI creates it.
- `apps/*/nest-cli.json`: `builder` set to `rspack`. Reason: no CLI sets it.
- `apps/sea-runtime` supervisor body and runtime module providers. Reason: generators create empty classes.

### 1d ([page](POC-01d-Result.md#manual-edits-no-cli-generated-them))

- `apps/web-angular`: test no-op script; deleted `tsconfig.spec.json`; `.postcssrc.json` (Tailwind PostCSS, manual per the Tailwind guide); `styles.css` theme; `index.html` splash and theme script; route, shell, page and guard bodies; `angular.json` proxy option; `proxy.conf.json`. Reason: `ng new` gives stubs, and `ng add` writes version ranges.
- `pnpm-workspace.yaml`: `allowBuilds` entries. Reason: pnpm build-script trust decisions.
- `tools/scripts/compile-sea.ts`: classification of service and web bundle. Reason: decision 17.
- `apps/web-angular/README.md` deleted. Reason: a generated README without a `toon-meta` block breaks the metadata chain.

### 1e

- `apps/desktop/src-tauri/tauri.conf.json`: `identifier` changed from `com.tauri.dev` to `com.example.lansolution.desktop` (PLACEHOLDER). Reason: `tauri init` has no identifier flag, and `tauri build` refuses `com.tauri.dev`.
- `nx.json`: `targetDefaults` (`test` depends on `build`, `package` depends on `test`). Reason: no CLI edits `targetDefaults`.
- `apps/sea-runtime/package.json` and `apps/desktop/package.json`: project-level `dependsOn` lists `test` explicitly. Reason: a project-level `dependsOn` replaces the `targetDefaults` list.
- `package.json`: root `securityCheck` script and `test` script. Reason: no CLI writes a security gate or a filter adapter call.
- `tools/scripts/test-filter.ts`: new file. Reason: no CLI generates it.

## Deviations

- **D1. Nx 24.0.2, not 24.0.3.** `minimumReleaseAge: 1440` rejected 24.0.3 (published 2026-10-30T20:41Z) when checked. The protection stays on. Reverse: move the catalog pin after 2026-10-31T20:41Z if wanted. Source: [1a](POC-01a-Result.md#discrepancies).
- **D2. Angular runtime packages 22.2.4, not 22.2.5.** `@angular/core` runtime packages were pinned to 22.2.4 because 22.2.5 was not in the registry when checked. The CLI and build use 22.2.5. Reverse: pin 22.2.5 when it is in the registry. Decision needed. Source: [1d](POC-01d-Result.md#deviations).
- **D3. TypeScript 6.0.3.** The baseline gives no TypeScript pin. 6.0.3 is the newest 6.x line requested by `@nestjs/cli` schematics, and it avoids the 7.x major. Reverse: human decision or a baseline change. Not verified against the baseline. Source: [1b](POC-01b-Result.md#deviations).
- **D4. `@tauri-apps/cli` 2.12.4 against crate `tauri` 2.12.5.** `@tauri-apps/cli` 2.12.5 is not on npm. Reverse: pin the CLI to 2.12.5 when published, or record a human decision. Not decided. Source: [1a](POC-01a-Result.md#discrepancies), 1e report.
- **D5. esbuild replaced by rspack for the Nest builds.** Reverse: none planned; reverting needs `esbuild` and `postject` back, removed in 1c. Source: [1c](POC-01c-Result.md#replaced-design).
- **Not version substitutions, but deviations from defaults:**
  - Identifier `com.example.lansolution.desktop` is a PLACEHOLDER. Needs a real value.
  - Crate name `app`, library `app_lib` and authors cannot be set by CLI flags. They are unchanged.
  - `app.security.csp` is `null`. Needs a decision before the security POCs.

## Open items and not verified

- Linux SEA binary needs `libatomic.so.1` at run time. `debian:bookworm-slim` does not ship it. Not resolved in POC-1. Source: [1c](POC-01c-Result.md#not-verified).
- Sidecar is not wired in `apps/desktop`. POC-5 owns it.
- Test filter arguments are translated and printed, but no runner consumes them, because no APP tests exist. Filter selection and the no-match failure in real Jest or Playwright runs are not verified.
- `test:static` runs type checks only. It does not run lint or format. REQ-ECO-03 and REQ-ECO-05 stay open.
- `nx run-many -t package` alone skips `securityCheck`. Only the root chain runs it.
- `apps/api-gateway` and `apps/web-angular` have no APP tests. `test:dynamic` is a no-op in every package.
- The `package` target is never cached, and the SEA binary is not reproducible.
- Unknown paths return the index with 200. POC-4 owns the 404 rule.
- Windows: not verified (no build, no run, no Tauri check).
- Phone width, keyboard and focus, and Lighthouse: not verified (1d).
- Tauri Linux builds: not verified.
- WebView2 minimums: not recorded, not verified.
- Tailwind version: not recorded, not verified.
- Node 26 compatibility of Nest, Angular, Tauri and Zod: not verified.
- The rspack builder does no type check. No `tsc --noEmit` step runs in the build (open decision from 1c).
- Whether `esbuild` leaves the lockfile: open decision.

## Requirements with no pitch task

REQ-REP-05 documentation is this result set. REQ-ECO-05 and REQ-DEPS-01 are not implemented by design: there is no lint or format gate yet, and `bumpDependencies` and `test:doctor` remain TBD.

## Commits

Slice 1e commits on `minor/poc-01e-hardening`:

- `1342cf3` feat: generate Tauri v2 desktop skeleton with pinned CLI and crates
- `3c91445` build: add Nx build and package targets for desktop
- `cf6338d` feat(security): add fail-closed securityCheck root script
- `72ff75f` feat(test): add per-package test:static, test:dynamic and filter adapter
- `a906532` build(nx): model build, test and package order in targetDefaults
- `0151ba3` fix(test): run filter adapter first in root test script
