<!-- toon-meta
fmt: TOON
doc: docs/backlog/persistence-system.md
title: "Persistence system"
type: backlog
summary: "Backlog item for a strict engine-keyed config, lazy engine loading, a barrel split and engine-keyed migration assets."
ids[0]:
related[6]: docs/backlog/README.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/roadmap/PROPOSAL.md,docs/requirements/amendments-2026-10-30.md,docs/requirements/04-configuration.md,docs/requirements/05-persistence.md
status: proposed
updated: 2026-11-03
-->

# Persistence system

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](dbm-schema-gate.md) | [Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [How to run in dev](#how-to-run-in-dev)
- [Slices](#slices)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Proposed. T5 (this documentation) comes first. T1 to T4, T6 and T7 are not built |
| Depends on | DBM schema gate ([ADR-005](../architecture/adr/ADR-005-live-schema-validation.md)) |
| Branch | `minor/persistence-system` |
| Delivery | One branch, one PR (ask-on-risk) |
| Decision | [ADR-007](../architecture/adr/ADR-007-persistence-system.md) (proposed) |
| Requirements | [REQ-CFG-04](../requirements/04-configuration.md), [REQ-CFG-05](../requirements/04-configuration.md) (amendment proposed), [REQ-DB-02](../requirements/05-persistence.md), [REQ-DB-03](../requirements/05-persistence.md) |
| Acceptance criteria | AC-07, AC-08, AC-10 (same as POC-3); a specific AC is not defined |

The human asked for this on 2026-11-03. The slice names T1 to T7 are an assumption.

---

## Goal

[Back to navigation](#navigation)

- The config is strict. It is one engine or nothing. A missing or invalid config always throws.
- Only the selected engine is loaded at runtime.
- The handshake to the database stays ([ADR-005](../architecture/adr/ADR-005-live-schema-validation.md), DBM-n).

| No-gos |
|---|
| No PostgreSQL engine, driver or config block. The union takes it later as one more variant. |
| No auto-creation of the config by the runtime. The installer assistant is TBD. |
| No `superRefine`, `.default` or `.prefault` in the config schema. |
| No change of REQ text without the human. |
| No unit or integration suites ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)). |

---

## Requirements

[Back to navigation](#navigation)

- [REQ-CFG-04](../requirements/04-configuration.md)
- [REQ-CFG-05](../requirements/04-configuration.md) (amendment proposed, waits for the human)
- [REQ-DB-02](../requirements/05-persistence.md)
- [REQ-DB-03](../requirements/05-persistence.md)
- [REQ-TEST-01](../requirements/11-nx-quality-testing.md)

Proof is by real runs of the build, the static checks and the packaged binary.

---

## How to run in dev

[Back to navigation](#navigation)

The base directory in dev is `process.cwd()`, whatever pnpm gives ([ADR-007](../architecture/adr/ADR-007-persistence-system.md#one-base-directory)).

- Copy `libs/shared-core/config.example.json` to `<cwd>/config/config.json`.
- A missing file makes the service throw. Nothing creates it.
- `pnpm --filter` changes the cwd to the app folder. To share one dev base, start every app from the same cwd.

---

## Slices

[Back to navigation](#navigation)

One branch, one PR. Slice names T1 to T7 are an assumption.

| Slice | Scope | Depends on | Evidence required |
|---|---|---|---|
| T1 | Config: strict discriminated union on `engine` in `libs/shared-core/src/config.ts`. The auto-create path is removed. A `config.example.json` is added | none | Static checks pass. Loading a missing file, a file with extra keys, both blocks, an unknown engine, an empty object and `null` each throw. A valid sqlite config loads |
| T2 | Engine registry: lazy `await import()` of the selected engine. Barrel split of `shared-core`. `SqliteVector` moves into the sqlite engine | T1 | The `shared-core` root no longer exports the engine code. The bundle is one file. Only the selected engine is evaluated |
| T3 | Nest wiring: an async `DATABASE_ADAPTER` provider in `sea-runtime` and `api-gateway` | T2 | `pnpm build` passes. Both apps start with a valid config and exit non-zero without one |
| T4 | Engine-keyed migration assets under `db-migrations/<engine>/`, with sqlite only: `pack-migrations`, `assets.ts`, migrations source, schema check, tables list | T2 | The parity check exits 0. The packed assets list the sqlite folder only. No pg folder exists |
| T5 | Docs: [ADR-007](../architecture/adr/ADR-007-persistence-system.md), this page, open questions, the proposed amendment, the README map, `docs/meta.toon` | none | The Checks commands of [Standards](../standards/README.md#checks) exit 0 |
| T6 | Base directory: one function returns `process.cwd()` in dev and the executable directory in a built binary. Layout `config/config.json`, `data/`, `logs/`, `certs/` under it. No `.local/`, no dev script. The package smoke writes a valid config into its scratch base directory | T1 | Services and the migration script throw without `config/config.json`. With the file copied from `config.example.json` they start. The smoke passes |
| T7 | Integration: `pnpm build`, lint and static tests per app, `pnpm package` with the smoke, and an independent verification (contract change) | T1 to T6 | `pnpm package` exits 0. The verifier reports no blocker |

Design rules for all slices:

- The config schema is the single place that decides the engine. Domain consumers keep depending on ports ([REQ-DB-02](../requirements/05-persistence.md)).
- The `import()` argument is a literal or a ternary of literals.
- Generate every project file with its official CLI through `pnpm dlx` or `nx`. Hand edits are listed in the slice result.

---

## Open questions

[Back to navigation](#navigation)

| Topic | Status |
|---|---|
| One base directory (cwd in dev, executable directory in prod) and the dev config: [OQ23](../roadmap/PROPOSAL.md#open-questions) | decided (human), 2026-11-03 |
| Where the installer assistant defines the install path and creates `config/config.json`: [OQ24](../roadmap/PROPOSAL.md#open-questions) | open, TBD with the installer (POC-8) |
| Remove the shipped `config.default.json` copy ([REQ-CFG-05](../requirements/04-configuration.md)): [OQ25](../roadmap/PROPOSAL.md#open-questions) | proposed amendment, waits for the human |
| PostgreSQL variant of the config union | TBD, belongs to POC-6 |
| Measurements in [ADR-007](../architecture/adr/ADR-007-persistence-system.md) on other Node, rspack versions and Windows | not verified |
