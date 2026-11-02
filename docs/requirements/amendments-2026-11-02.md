<!-- toon-meta
fmt: TOON
doc: docs/requirements/amendments-2026-11-02.md
title: "Amendments 2026-11-02"
type: requirement
summary: Records agent-applied amendments for build-time Drizzle migrations, following a human request of 2026-11-02.
ids[0]:
related[6]: docs/requirements/README.md,docs/requirements/amendments-2026-10-30.md,docs/requirements/traceability.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/architecture/adr/ADR-005-live-schema-validation.md,docs/backlog/dbm-schema-gate.md
status: current
updated: 2026-11-02
-->

# Amendments 2026-11-02

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](amendments-2026-10-30.md) | [Up](README.md) | [Next](traceability.md)

## Navigation

- [At a glance](#at-a-glance)
- [Approval status](#approval-status)
- [Amendments 2026-11-02](#amendments-2026-11-02)

## At a glance

[Back to navigation](#navigation)

Three requirement changes, one closed question, one amendment and one proposal. Cause: the human asked for Drizzle at build time only, then for a startup schema check. Next: the human reviews [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md) and [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md).

| Id | Change | Open question |
|---|---|---|
| [REQ-DB-04](05-persistence.md) | `drizzle-kit` runs at build time only. The SEA carries the generated SQL. Migrations run in the supervisor | none |
| [REQ-DB-05](05-persistence.md) | The history table gains `runtime_version` and `duration_ms` | none |
| [REQ-STACK-07](02-technology-baseline.md) | `drizzle-orm` `0.45.4` and `drizzle-kit` `0.31.11`, exact. `1.0.0-rc.5` stays the fallback | [OQ15](../roadmap/PROPOSAL.md#open-questions), closed |
| [REQ-DB-06](05-persistence.md) | The startup order gains a schema structure check after the migrations | none |
| [REQ-DB-10](05-persistence.md) | New, proposed, not approved. The supervisor compares the live schema with the descriptor in the binary | none |

## Approval status

[Back to navigation](#navigation)

| Item | State |
|---|---|
| Direction: Drizzle at build time only, SQL in the SEA | Human request, 2026-11-02 |
| Versions `0.45.4` and `0.31.11` | Agent proposal, verified in a spike on 2026-11-02 |
| Text of [REQ-DB-04](05-persistence.md), [REQ-DB-05](05-persistence.md), [REQ-STACK-07](02-technology-baseline.md) | Agent proposal |
| [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md) | Accepted 2026-11-02, after the code and the smoke run (see DBM-Result) |
| Slice names, `app_meta` as first table | Assumption, not answered by the human |
| Downgrade guard from `runtime_version` | Proposed, not approved, not applied |
| Text of [REQ-DB-06](05-persistence.md) (schema check step) | Agent proposal, applied in the doc only |
| [REQ-DB-10](05-persistence.md) | Proposed, not approved. The human has not approved it |
| [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md) | Accepted 2026-11-02, after the code and the packaged run (see DBM-Schema-Gate-Result) |
| Slice names DBM-i to DBM-n | Assumption, not answered by the human |

## Amendments 2026-11-02

[Back to navigation](#navigation)

The SRS v1.6 line numbers for these texts are not verified. Each entry names the requirement file instead.

- [REQ-DB-04](05-persistence.md). Before: `drizzle-kit` must not be installed or run. Migrations run during Nest initialization. After: `drizzle-kit` runs only at build time as a `devDependency`. The SEA carries only the generated SQL and no Drizzle code. The in-house migrator applies the SQL in the supervisor, before any service starts and before readiness.
- [REQ-DB-05](05-persistence.md). Before: the history holds `version`, `checksum` and `applied_at`. After: it also holds `runtime_version` and `duration_ms`. There is one history table, `schema_migrations`. Each migration and its history row share one transaction.
- [REQ-STACK-07](02-technology-baseline.md). Before: a stable tag is preferred and `1.0.0-rc.5` is the fallback. After: `drizzle-orm` `0.45.4` and `drizzle-kit` `0.31.11`, exact and in `devDependencies` only. `1.0.0-rc.5` for both packages stays the fallback if a spike step fails. This closes [OQ15](../roadmap/PROPOSAL.md#open-questions).
- [Roadmap proposal](../roadmap/PROPOSAL.md). The no-go "no drizzle-kit" now reads "no drizzle-kit at run time". The POC-3 problem text says the migrator applies SQL that `drizzle-kit` generates at build time.
- [ADR-003](../architecture/adr/ADR-003-config-and-db-strategy.md). Its Drizzle section links to [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md).
- [REQ-DB-06](05-persistence.md). Before: the order is `... → verify/apply migrations → publish DB ready → publish gateway ready`. After: `... → verify/apply migrations → verify schema structure → publish DB ready → publish gateway ready`. The supervisor runs the structure check once, when it initializes persistence. See [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md).
- [REQ-DB-10](05-persistence.md). New and proposed. It is not approved. Before: no requirement compared the live schema with an expected structure. After (proposal): the supervisor **MUST** compare the live schema with the descriptor in the binary. It **MUST** fail on a missing element, a difference, or an extra `NOT NULL` column without a default. It **MUST** tolerate the other extras.

POC-3 pages and the [POC-3 result](../results/POC-03-Result.md) stay as written. They record what POC-3 built.
