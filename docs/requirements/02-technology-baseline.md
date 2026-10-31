<!-- toon-meta
fmt: TOON
doc: docs/requirements/02-technology-baseline.md
title: Technology Baseline
type: requirement
summary: Fixes technology versions and supply-chain rules for reproducible installs.
ids[12]: REQ-STACK-01,REQ-STACK-02,REQ-STACK-03,REQ-STACK-04,REQ-STACK-05,REQ-STACK-06,REQ-STACK-07,REQ-STACK-08,REQ-STACK-09,REQ-STACK-10,REQ-SUPPLY-01,REQ-SUPPLY-02
related[3]: docs/requirements/README.md,docs/requirements/01-purpose-and-scope.md,docs/requirements/03-file-structure.md
status: current
updated: 2026-10-30
-->

# Technology Baseline (SRS §2)

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](01-purpose-and-scope.md) | [Up](README.md) | [Next](03-file-structure.md)

Pins versions and supply-chain rules. Next: [file structure](03-file-structure.md).

## Navigation

- [At a glance](#at-a-glance)
- [2. Technology baseline and reproducibility](#2-technology-baseline-and-reproducibility)

## At a glance

[Back to navigation](#navigation)

| Topic | Point |
|---|---|
| Stack | Node.js 26, pnpm 12, NestJS 12.3.2, Angular 22, Tauri 2, Zod 4 |
| Vectors | `sqlite-vector` 1.1.2; `pgvector >=0.8.7` |
| Pins | Exact direct versions; lockfile committed |
| Supply chain | `minimumReleaseAge: 1440`, explicit `allowBuilds`, frozen-lockfile installs |
| Risk | Drizzle RC is a fallback only; flag it |

## 2. Technology baseline and reproducibility

[Back to navigation](#navigation)

| Requirement | Technology | Constraint |
|---|---|---|
| REQ-STACK-01 | Node.js | `>=26.13.0 <27`; build the SEA with a fixed Node 26 version |
| REQ-STACK-02 | pnpm | `>=12.16.1`; `packageManager` pinned to a verified exact version |
| REQ-STACK-03 | Tauri | v2, minimum `2.12.5`; effective versions pinned |
| REQ-STACK-04 | NestJS | `12.3.2`; `@nestjs/platform-node` / `NodeAdapter`; no Express or Fastify |
| REQ-STACK-05 | Angular | `>=22.2.5`, major 22; install a compatible exact version and demonstrate zoneless |
| REQ-STACK-06 | Zod | `>=4.6.7`, major 4; declare the exact version in the catalog |
| REQ-STACK-07 | Drizzle ORM | Stable tag preferred; `1.0.0-rc.5` is the fallback if the stable tag lacks vector support in SQLite or PostgreSQL (human decision 10, 2026-10-30), for `drizzle-orm/node-sqlite`. Record the chosen tag |
| REQ-STACK-08 | pnpm Workspaces + Nx | Local Nx, no Nx Cloud; compatible version pinned after discovery |
| REQ-STACK-09 | SQLite vector | `sqlite-vector` native extension `1.1.2`, per platform/architecture |
| REQ-STACK-10 | PostgreSQL vector | `pgvector >=0.8.7`, verifying the version on the instance |

- The `package.json` of every workspace package **MUST** pin direct dependencies to exact versions. It **MUST NOT** use `^` or `~` for those dependencies. `pnpm-lock.yaml` **MUST** be committed.
- Shared packages **MUST** centralize versions through the pnpm catalog. The catalog manages `zod`, `@playwright/test`, TypeScript and quality tools. Keep the `catalog:` style and `savePrefix: ""` of the reference repository. Adapt the `apps/*` and `libs/*` paths. Do not mechanically reproduce its versions, which belong to a different Node/Nest generation.
- **Install protection (REQ-SUPPLY-01).** After verifying compatibility with pnpm 12, adopt the real pattern from [`fullstack-base/pnpm-workspace.yaml`](https://github.com/virgenherrera/fullstack-base/blob/50afc753617d628e0d8c5bd7ed2521ceae9a4298/pnpm-workspace.yaml). The pattern uses `minimumReleaseAge: 1440` (24 h) and an explicit `allowBuilds` for install scripts. Exceptions needed for a security update are reviewed and documented. The sibling repo's entries must **not** be copied automatically. Do not confuse these measures with detection of unknown zero-days.
- **Integrity (REQ-SUPPLY-02).** Use the pinned manager and a committed `pnpm-lock.yaml`. Use `pnpm install --frozen-lockfile` in CI. Audit **all** dependencies (including dev/build). Do not install arbitrary code or run an unpinned `pnpm dlx` during CI. Validate the sidecar's Rust dependencies with a verified auditing tool (e.g. `cargo-audit`) once it is pinned, without excluding them from the general gate.
- Each version and package name **MUST** be checked before installing; if a combination turns out to be incompatible, the agent **MUST** document the blocker and choose the smallest variation that preserves the requirements, without inventing APIs.
- If the Drizzle RC `1.0.0-rc.5` is used as a fallback, it **MUST** be flagged as an explicit risk, not as a stable release.
