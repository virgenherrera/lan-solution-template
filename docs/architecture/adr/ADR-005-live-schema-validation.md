<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-005-live-schema-validation.md
title: "ADR-005 Live schema validation"
type: architecture
summary: "Proposes a startup gate that compares the live database structure with the descriptor in the binary."
related[5]: docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/backlog/dbm-schema-gate.md,docs/requirements/05-persistence.md,docs/requirements/amendments-2026-11-02.md,docs/requirements/traceability.md
status: accepted
updated: 2026-11-02
-->

# ADR-005: Live schema validation

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-004](ADR-004-drizzle-build-time-migrations.md) | [DBM schema gate backlog](../../backlog/dbm-schema-gate.md) | [Amendments 2026-11-02](../../requirements/amendments-2026-11-02.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Decision](#decision)
- [Options rejected](#options-rejected)
- [Blind spots](#blind-spots)
- [Consequences](#consequences)
- [Not verified](#not-verified)

## Status

Accepted, 2026-11-02, as the record of what DBM-j to DBM-m built. A packaged run and an independent verification prove it (0 blockers). The human asked for the direction. The details below are agent proposals. [REQ-DB-10](../../requirements/05-persistence.md) is a proposal too. The human has not approved it.

## Context

[ADR-004](ADR-004-drizzle-build-time-migrations.md) runs the migrations in the supervisor. It checks the migration history. It does not check the shape of the tables. A manual edit, a restored backup or a newer build can leave a different shape.

The human said that such a case "deberia tronar". The human also said "no hablamos de versiones, sino de como esperamos que sea el schema". So the check is structural. It never compares versions.

The runtime must read the live structure with the engine itself. SQLite has `PRAGMA table_info`. PostgreSQL has `information_schema`.

## Decision

### Option A: compare the live structure with a descriptor in the binary

- The binary carries the expected structure as a Zod descriptor. The source stays `contract/tables.ts`, neutral to the engine.
- Each `DbAdapter` gets one new method, `introspectSchema(): Promise<LiveSchema>`. Each adapter is the strategy for its engine.
- The supervisor reads the live schema and compares it with the descriptor. A failure exits with code 1. No service spawns.
- The gate runs once. It sits in the persistence boot, between the migrations and the `app_meta` write. The `app_meta` table is itself a validated table.
- There is no periodic probe. The gate runs when persistence initializes and at no other time.

### Policy per element

| Element | Live schema differs | Result |
|---|---|---|
| Expected table | missing | fail |
| Expected column | missing | fail |
| Column type | different logical type | fail |
| Column nullability | different | fail |
| Column primary key | different | fail |
| Expected index | missing | fail |
| Extra column, nullable or with a default | present | tolerate and log |
| Extra column, `NOT NULL`, no default, not a primary key | present | fail |
| Extra table | present | tolerate and log |
| Extra index | present | tolerate and log |
| `schema_migrations` and `sqlite_*` tables | any | ignored |

The `NOT NULL` extra column fails by structure alone. An older binary does not know it. Every `INSERT` from that binary would break.

The migrator already checks the history in `schema_migrations` ([REQ-DB-05](../../requirements/05-persistence.md)). The gate does not repeat that work.

### Detection

- SQLite: `notnull = 1`, `dflt_value IS NULL` and `pk = 0` mark an extra column that needs a value on insert.
- PostgreSQL: `is_nullable = 'NO'` and `column_default IS NULL` mark the same case.

### Descriptor and shared comparator

- The descriptor is a Zod schema in `libs/db-migrations/contract/descriptor.ts`. `tables.ts` stays the single source. The types come from `z.infer`.
- One pure function, `compareSchema(expected, live, mode)`, lives in `libs/db-migrations/contract/compare.ts`. It does not depend on `shared-core`.
- The mode is `exact` or `required`. The build parity check uses `exact`. It reports every extra as an error. The runtime gate uses `required`. It applies the policy table.
- The parity check from ADR-004 uses this shared comparator. Its decisions do not change.
- `tablesSchema.parse` validates the descriptor in the build and once at runtime.

### Error output and exit code

The gate prints this text and exits with code 1:

```text
[supervisor] schema check FAILED (engine sqlite, 2 problem(s)):
  app_meta.value: column missing
  app_meta.flag: extra column is NOT NULL without default
The database at <path> does not have the structure this build expects. No service was started. Restore a backup taken with this build, or start the build that last migrated this database.
```

When the check passes with extras, it prints one info line: `schema ok, N extra(s) tolerated`. The detail follows the line.

### Newer database

A newer build may have migrated the database. This build does not read the unknown migrations. It reads the structure only.

- If the newer build only added a table, an index, or a nullable or defaulted column, this build starts.
- If it removed, renamed or retyped something this build expects, the gate fails.
- If it added a `NOT NULL` column without a default, the gate fails.

### Services stay independent of migrations

Migrating stays at the runtime level. Services never read schema versions. A service does not know which migrations ran.

A Nest database module for services, DBM-n, is built in the api-gateway. It does a one-time `SELECT 1` handshake when a service connects. It does not check the structure.

## Options rejected

- B, a fingerprint stored in the database: the runtime writes a hash and compares it with its own hash. The check is circular. It misses manual edits. Any extra gives a false alarm. It does not say what differs.
- C, a JSON description stored in the database and checked with Zod: it has the same circular flaw as B. It is redundant, since the descriptor already travels in the binary.
- `user_version` and `application_id` pragmas: `user_version` is a version counter. It repeats `schema_migrations` and says nothing about the shape. `application_id` marks a file type. A foreign file already fails on the missing `app_meta`.
- Guards by version, such as one that reads `runtime_version`: the human asked for the expected shape, not versions. `runtime_version` stays as history data in `schema_migrations`.

## Blind spots

The descriptor models tables, columns, types, nullability, primary keys and indexes. It does not model these:

- `CHECK` constraints.
- Triggers.
- Expected column defaults.
- Foreign keys.
- Collation.

A change only in one of these passes as valid. The gate gives no safety there. The descriptor grows only when a feature depends on one of them.

## Consequences

- [REQ-DB-06](../../requirements/05-persistence.md) gains a schema check between the migrations and DB ready.
- [REQ-DB-10](../../requirements/05-persistence.md) is proposed. It is not approved.
- `DbAdapter` gains `introspectSchema`. PostgreSQL implements it in POC-6.
- On PostgreSQL, type names such as `varchar`, `bigint` and `vector` may give a false failure. The adapter maps them per engine. An unknown type shows raw in the message.
- On SQLite in `DELETE` journal mode, a read inside an open transaction blocks writers. The gate uses `PRAGMA` without a transaction. It runs before any service spawns. `WAL` is the default.
- A restore of an older backup now fails at start when its structure differs. The error text says what to do.
- The slices are DBM-i to DBM-m. See the [backlog page](../../backlog/dbm-schema-gate.md).

## Not verified

- That Hibernate `validate` tolerates extra columns. This comes from memory, not from a read of the official docs.
- That Room checks an `identityHash`. This also comes from memory, not from the official docs.
- A PostgreSQL lock effect from reading `information_schema`.
- Verified on Node 26 SQLite: `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a default works on an empty table and fails on a populated one ("Cannot add a NOT NULL column with default value NULL"). The extra `NOT NULL` case therefore also appears after a table rebuild or on an empty table.
- That `is_identity` and `is_generated` count as a default in PostgreSQL.
- The behavior of the gate on engines other than SQLite.
