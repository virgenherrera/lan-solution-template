<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-6-postgresql-adapter-parity.md
title: "POC-6 PostgreSQL adapter parity (built on branch)"
type: backlog
summary: "PostgreSQL adapter parity with pgvector: built on a branch, pull request pending."
related[5]: docs/results/POC-06-Result.md,docs/backlog/README.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md,docs/backlog/poc-7-auth-roles.md,docs/backlog/persistence-system.md
status: current
updated: 2026-11-04
-->

# POC-6: PostgreSQL adapter parity (built on branch)

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-5-tauri-sidecar-desktop-shell.md) | [Up](README.md) | [Next](poc-7-auth-roles.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Built on branch, pull request pending ([POC-06-Result](../results/POC-06-Result.md)) |
| Appetite | none assigned (original estimate: 1 week, small batch) |
| Depends on | n/a |
| Branch | `minor/poc-06-postgresql-parity` |
| Requirements | 6 REQ ids |
| Acceptance criteria | AC-09 |

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-built-on-branch) and [PROPOSAL backlog entry](../roadmap/PROPOSAL.md#backlog).

PostgreSQL adapter parity behind the same port. Decision 8 deferred it. PostgreSQL is out of scope (TBD) and declared nowhere in code or config today. Gap: the SRS marks REQ-TEST-06 as MUST. REQ-TEST-06 and AC-09 stay unmet until this item runs.

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-built-on-branch)):

- [REQ-DB-01](../requirements/05-persistence.md)
- [REQ-DB-02](../requirements/05-persistence.md)
- [REQ-DB-03](../requirements/05-persistence.md)
- [REQ-DB-05](../requirements/05-persistence.md)
- [REQ-DB-08](../requirements/05-persistence.md)
- [REQ-TEST-06](../requirements/11-nx-quality-testing.md)

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-09](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-built-on-branch). [AC-09](../requirements/11-nx-quality-testing.md) and the PostgreSQL part of [REQ-TEST-06](../requirements/11-nx-quality-testing.md).

## Tasks

[Back to navigation](#navigation)

- [x] Add the PostgreSQL adapter (`pg` + pgvector >=0.8.7) behind the same port. Source: [REQ-DB-01](../requirements/05-persistence.md), [REQ-DB-02](../requirements/05-persistence.md), [REQ-DB-03](../requirements/05-persistence.md), [AC-09](../requirements/11-nx-quality-testing.md)
- [x] Add PostgreSQL as one more variant of the `db.engine` union ([ADR-007](../architecture/adr/ADR-007-persistence-system.md)): an engine module behind `shared-core/pg`, assets under `db-migrations/pg/` and a `pack-migrations --engine pg` run. `db-migrations/pg/` holds the Drizzle schema and the generated migrations (`pnpm --filter db-migrations run generate:pg`). `pack-migrations` packs every engine in `ENGINES`, `db-parity --engine pg` compares a live PostgreSQL with the descriptor, and the schema gate accepts the engine.
- [x] Dialect-specific migrations through the same custom migrator contract. The `CREATE EXTENSION vector` step is not part of the app migrations: the app schema has no vector column yet, and the adapter creates the extension in `verifyVector`. Source: [REQ-DB-05](../requirements/05-persistence.md), [AC-09](../requirements/11-nx-quality-testing.md)
- [x] Vector adapter without silent non-vector fallback on PostgreSQL. Source: [REQ-DB-08](../requirements/05-persistence.md), [AC-09](../requirements/11-nx-quality-testing.md) Done: `verifyVector` throws `VectorUnavailableError` when pgvector is absent or the role cannot install it, `searchSimilar` has the same shape on both engines, and the SEA boot exits 1 before any service starts.
- [x] Run the PostgreSQL part of the persistence APP. If pgvector is not installable, status is blocked-by-environment. Source: [REQ-TEST-06](../requirements/11-nx-quality-testing.md), [AC-09](../requirements/11-nx-quality-testing.md) Done: `nx run sea-runtime:smoke-pg` runs the packaged SEA against `pgvector/pgvector:pg17` in Docker (11 checks, containers removed on every exit path). It needs a running Docker daemon and fails with a clear message without one.
- [x] Apply the stable-first Drizzle rule. Test the stable tag for PostgreSQL vector support. Then fall back to `1.0.0-rc.5` (decision 10). Source: [AC-09](../requirements/11-nx-quality-testing.md) Done: stable `drizzle-orm` 0.45.4 and `drizzle-kit` 0.31.11 passed the spike with `pg` 8.23.1, so `1.0.0-rc.5` is not adopted; the reasons are in [POC-06-Result](../results/POC-06-Result.md#drizzle-stable-first-decision-10).
