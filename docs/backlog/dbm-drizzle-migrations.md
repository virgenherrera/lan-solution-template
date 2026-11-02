<!-- toon-meta
fmt: TOON
doc: docs/backlog/dbm-drizzle-migrations.md
title: "DBM Drizzle build-time migrations"
type: backlog
summary: "Backlog item for build-time Drizzle migrations applied by the in-house migrator in the supervisor."
related[4]: docs/backlog/README.md,docs/backlog/poc-3-config-sqlite-vector.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/requirements/amendments-2026-11-02.md
status: current
updated: 2026-11-02
-->

# DBM: Drizzle build-time migrations

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-9-ci-cd-releases.md) | [Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Tasks](#tasks)
- [Slices](#slices)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Done on `minor/dbm-drizzle-migrations`; see [DBM-Result](../results/DBM-Result.md) |
| Depends on | POC-3 |
| Branch | `minor/dbm-drizzle-migrations` |
| Delivery | One branch, one PR |
| Decision | [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md) (accepted) |
| Requirements | REQ-DB-03, REQ-DB-04, REQ-DB-05, REQ-DB-06, REQ-STACK-07 |
| Acceptance criteria | AC-07, AC-08, AC-10 (same as POC-3) |

This is not a POC from the roadmap pitches. It extends POC-3 on a human request of 2026-11-02. The slice names are an assumption.

---

## Goal

[Back to navigation](#navigation)

- Declare tables as classes. Build them to SQL files with `drizzle-kit`.
- Keep `drizzle-kit` out of the final build. Only the generated SQL travels in the SEA.
- Apply the SQL with the in-house migrator, in the supervisor, before any service starts.
- Start with SQLite. Keep the design open for PostgreSQL and a later engine.

| No-gos |
|---|
| No `drizzle-kit` or `drizzle-orm` code in the SEA. |
| No second history table. |
| No unit or integration suites ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)). |
| No `pg/` folder before POC-6. |
| No downgrade guard (proposed, not approved). |

---

## Requirements

[Back to navigation](#navigation)

- [REQ-DB-03](../requirements/05-persistence.md)
- [REQ-DB-04](../requirements/05-persistence.md) (amended)
- [REQ-DB-05](../requirements/05-persistence.md) (amended)
- [REQ-DB-06](../requirements/05-persistence.md)
- [REQ-STACK-07](../requirements/02-technology-baseline.md) (amended)
- [REQ-TEST-01](../requirements/11-nx-quality-testing.md)

Proof is by real runs of the build and the packaged binary. AC ids are those of POC-3; a DBM-specific AC is not defined.

---

## Tasks

[Back to navigation](#navigation)

- [x] Prove with a spike that `drizzle-kit` generates offline SQL and a class contract compiles. Source: [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md)
- [x] Amend REQ-DB-04, REQ-DB-05 and REQ-STACK-07. Close [OQ15](../roadmap/PROPOSAL.md#open-questions). Write ADR-004. Source: [amendments-2026-11-02](../requirements/amendments-2026-11-02.md)
- [x] Create `libs/db-migrations` with the contract, the SQLite schema and the first migration.
- [x] Extend the migrator: statement markers, history columns, manifest check, RxJS event stream.
- [x] Add a pack step, a manifest, SEA assets and a drift target.
- [x] Run migrations and the `app_meta` upserts in the supervisor boot pipeline.
- [x] Compare the migrated database with the descriptor by introspection.
- [x] Publish the result page, finalize ADR-004 and regenerate `docs/meta.toon`.

---

## Slices

[Back to navigation](#navigation)

One branch, one PR. Slice names DBM-a to DBM-h are an assumption.

| Slice | Scope | Depends on |
|---|---|---|
| DBM-a | Spike: offline `generate`, `--> statement-breakpoint`, no-change regenerate, `check`, `--custom`, class contract | none |
| DBM-b | Docs: amend REQ-DB-04, REQ-DB-05, REQ-STACK-07; close OQ15; ADR-004; this page | DBM-a |
| DBM-c | `libs/db-migrations`: `contract/`, `sqlite/schema.ts`, `drizzle.config.ts`, first migration for `app_meta` | DBM-a |
| DBM-d | Migrator: marker split, checksum over full text, `runtime_version` and `duration_ms` in `schema_migrations`, manifest check, RxJS event stream | DBM-c |
| DBM-e | Pack step that rejects an unmarked multi-statement file, `manifest.json`, SEA assets, drift target with `git diff --exit-code` | DBM-c |
| DBM-f | Boot pipeline in `apps/sea-runtime`: migrations, `app_meta` upserts, packaged-binary smoke that finds no Drizzle code. Dev (`nest start`) does not run persistence yet | DBM-d, DBM-e |
| DBM-g | Parity check: temporary database, `PRAGMA table_info` and indexes against `contract/tables.ts` | DBM-c, DBM-d |
| DBM-h | Result page, ADR-004 set to accepted, `docs/meta.toon`, independent verification | DBM-f, DBM-g |

Design rules for all slices:

- The runtime never imports Drizzle. Only `drizzle-kit` and `drizzle-orm` types and builders run at build time.
- Versions are exact. Direct dependencies use no `^` or `~`.
- Generate every project file with its official CLI through `pnpm dlx` or `nx`. Hand edits are listed in the slice result.
- `app_meta` is the first table. Its keys and rules are in [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md#tables).

---

## Open questions

[Back to navigation](#navigation)

| Topic | Status |
|---|---|
| [OQ15](../roadmap/PROPOSAL.md#open-questions): REQ-STACK-07 amendment | decided (human, 2026-11-02) |
| Slice names DBM-a to DBM-h | assumption, not answered by the human |
| `app_meta` as the first table | assumption, not answered by the human |
| Downgrade guard from `runtime_version` | proposed, not approved |
| `1.0.0-rc.5` fallback behavior with the class contract | not verified |
