<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-001-version-substitutions.md
title: "ADR-001 Version substitutions in POC-1"
type: architecture
summary: "Records the POC-1 version and tool substitutions where SRS pins or the registry policy blocked the baseline."
related[3]: docs/architecture/overview.md,docs/roadmap/PROPOSAL.md,docs/results/POC-01-Result.md
status: current
updated: 2026-11-09
-->

# ADR-001: Version substitutions in POC-1

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [POC-1 result](../../results/POC-01-Result.md)

## Status

Accepted by human decision. Recorded 2026-10-31 at the close of POC-1.

## Context

The SRS pins some versions in [02-technology-baseline.md](../../requirements/02-technology-baseline.md). During POC-1 some pins were not usable:

- The registry policy `minimumReleaseAge: 1440` (REQ-SUPPLY-01) blocks versions younger than 24 hours.
- Some pinned versions were not in the registry when checked.
- The baseline names no version for some tools.

Each check and its date is in the slice pages: [1a](../../results/POC-01a-Result.md), [1b](../../results/POC-01b-Result.md), [1c](../../results/POC-01c-Result.md), [1d](../../results/POC-01d-Result.md) and the [POC-1 result](../../results/POC-01-Result.md).

## Decision

Use these substitutions in POC-1. Each row gives the reason and what would reverse it.

| # | Item | Baseline | Used | Reason | Reversal |
|---|---|---|---|---|---|
| S1 | Nx | discovered (REQ-STACK-08) | 24.0.2 | 24.0.3 blocked by `minimumReleaseAge` when checked | Move the catalog pin to 24.0.3 after 2026-10-31T20:41Z |
| S2 | Angular runtime `@angular/core` packages | `>=22.2.5` (REQ-STACK-05) | 22.2.4 | 22.2.5 not in the registry when checked; CLI and build use 22.2.5 | Pin 22.2.5 when the registry lists it |
| S3 | TypeScript | not pinned in baseline | 6.0.3 | Newest 6.x line requested by `@nestjs/cli` schematics; avoids 7.x | Human decision, or a baseline change naming a TypeScript version |
| S4 | `@tauri-apps/cli` | minimum `2.12.5` (REQ-STACK-03) | 2.12.4 | 2.12.5 not on npm; the crate `tauri` is 2.12.5 | Pin the CLI to 2.12.5 when published |
| S5 | Nest SEA bundler | esbuild 0.28.2 (not in baseline) | `@rspack/core` 2.3.0 | The Nest apps build through the Nest CLI rspack builder (1c). The reason for leaving esbuild is not recorded in the reports | Human decision to return to esbuild and `postject` |

## Consequences

- The version table in the [POC-1 result](../../results/POC-01-Result.md#version-verification) lists each substitution and its status.
- `esbuild` stays in the lockfile as an optional peer of `vite` and `vitest`. Removing it needs a change upstream or in those packages.
- S1 and S4 can be reversed with a one-line pin change once the versions exist.
- S2 and S3 need a human decision if the baseline stays unchanged.

## Not substitutions

These are placeholders or gaps. They are not version choices, and this ADR does not decide them:

- The desktop identifier is a human decision. Its value lives only in the `identifier` field of `apps/desktop/src-tauri/tauri.conf.json`. No other file repeats it. Rust code reads it with `app.config().identifier`.
- The Tauri CSP is explicit. It limits `default-src` to `'self'` and the Tauri IPC origins, and `connect-src` also allows `http://127.0.0.1:*`. The port is a wildcard because the sidecar port is not fixed. See the [hardening result](../../results/CHORE-tauri-hardening-Result.md). The CSP is not exercised at runtime (not verified).
- `libatomic1` (deb) and `libatomic` (rpm) are declared as bundle dependencies in `tauri.conf.json`. The runtime need is verified only on arm64 (see the [POC-1c result](../../results/POC-01c-Result.md)). It is not verified on amd64.
- The crate name `app` and the crate authors cannot be set by CLI flags.

## Implementation status

Audit of 2026-11-09 against `main` at `cfec959`. The decision text above is kept as the record. This table says what the code does today.

| Decision | Decision status | Implementation | Check | Evidence | Gap |
|---|---|---|---|---|---|
| S1 Nx pinned 24.0.2 | Accepted by human decision | Implemented | confirmed | `pnpm-workspace.yaml:42` | Reversal to 24.0.3 not done (not required) |
| S2 Angular runtime 22.2.4 CLI 22.2.5 | Accepted by human decision | Implemented | single source | `pnpm-workspace.yaml:70`, `pnpm-workspace.yaml:75` | none |
| S3 TypeScript 6.0.3 | Accepted by human decision | Implemented | single source | `pnpm-workspace.yaml:55` | none |
| S4 tauri-apps/cli 2.12.4 | Accepted by human decision | Implemented | single source | `pnpm-workspace.yaml:26` | none |
| S5 Nest SEA bundler rspack 2.3.0 | Accepted by human decision | Implemented | single source | `pnpm-workspace.yaml:24`, `apps/sea-runtime/nest-cli.json:8`, `tools/rspack/nest.config.ts:17` | none |
| esbuild only as optional peer in lockfile | Accepted by human decision | Partial | adjudicated | `pnpm-lock.yaml:6476`, `pnpm-lock.yaml:6488` | esbuild 0.28.2 is also a direct dependency of the Angular build package (pnpm-lock.yaml:6814) so it is not only an optional peer |
| Desktop identifier only in tauri.conf.json identifier field | Accepted by human decision | Partial | adjudicated | `apps/desktop/src-tauri/tauri.conf.json:5` | Value present in tauri.conf.json; ADR claim that Rust reads it via app.config().identifier not found in apps/desktop/src-tauri/src (rg identifier empty); apps/desktop/src-tauri/tauri.wdio.conf.json:7 sets a second identifier wdio |
| Tauri CSP explicit default-src self and connect-src 127.0.0.1:* | Accepted by human decision | Not implemented | confirmed | `apps/desktop/src-tauri/tauri.conf.json:6` | No csp key in tauri.conf.json; apps/desktop/src-tauri/src/gateway.rs:17 says the page CSP is set by gateway response headers not Tauri |
| libatomic1 and libatomic declared as bundle deps | Accepted by human decision | Implemented | single source | `apps/desktop/src-tauri/tauri.conf.json:26`, `apps/desktop/src-tauri/tauri.conf.json:29` | none |
| Crate name app and authors not settable by CLI | Accepted by human decision | Implemented | single source | `apps/desktop/src-tauri/Cargo.toml:2`, `apps/desktop/src-tauri/Cargo.toml:5` | Authors is still the placeholder you |
