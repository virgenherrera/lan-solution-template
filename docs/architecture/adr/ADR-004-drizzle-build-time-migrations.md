<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md
title: "ADR-004 Drizzle build-time migrations"
type: architecture
summary: "Records Drizzle as a build-time tool only: drizzle-kit generates SQL, the SEA carries the SQL, the in-house migrator applies it."
related[6]: docs/architecture/adr/ADR-003-config-and-db-strategy.md,docs/backlog/dbm-drizzle-migrations.md,docs/requirements/amendments-2026-11-02.md,docs/requirements/05-persistence.md,docs/requirements/02-technology-baseline.md,docs/architecture/adr/ADR-005-live-schema-validation.md
status: accepted
updated: 2026-11-02
-->

# ADR-004: Drizzle build-time migrations

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-003](ADR-003-config-and-db-strategy.md) | [DBM backlog](../../backlog/dbm-drizzle-migrations.md) | [ADR-005](ADR-005-live-schema-validation.md) | [Amendments 2026-11-02](../../requirements/amendments-2026-11-02.md)

## Status

Accepted, 2026-11-02, as the record of what DBM-c to DBM-g built. The packaged smoke run passes (13 checks) and an independent verification found no blockers. The human asked for the direction. The details below are agent proposals unless a line says otherwise. The SRS owner has not reviewed it: not verified.

## Context

[ADR-003](ADR-003-config-and-db-strategy.md) left Drizzle open. POC-3 built a migrator over the `DbAdapter` port. It has no schema source and no generated SQL.

The human asked for a way to declare tables as classes and build them to SQL files. The final build must not carry `drizzle-kit`. Only the produced migrations travel. SQLite comes first. PostgreSQL follows, both with vectors. A later engine may join, so the design uses the strategy pattern.

[REQ-DB-04](../../requirements/05-persistence.md) said `drizzle-kit` must not be installed. That text blocked this design. The [2026-11-02 amendment](../../requirements/amendments-2026-11-02.md) rewrites it.

## Decision

### Drizzle at build time only

- `drizzle-orm` `0.45.4` and `drizzle-kit` `0.31.11` are exact `devDependencies` ([REQ-STACK-07](../../requirements/02-technology-baseline.md)).
- The fallback is `1.0.0-rc.5` for both packages. It applies only if a spike step fails. It would be flagged as a risk, not as a stable release.
- `drizzle-kit generate` writes SQL files per engine under `libs/db-migrations/<engine>/migrations/`.
- The SEA carries the SQL files and a manifest. It carries no Drizzle code. The runtime never imports `drizzle-orm`. The smoke run must prove this.
- The in-house migrator from ADR-003 applies the SQL. Drizzle's own migrator is not used. Drizzle does not generate the history table.

### Layout

- `libs/db-migrations/contract/` holds the logical types and the table descriptor.
- `libs/db-migrations/sqlite/` holds `schema.ts`, `drizzle.config.ts` and `migrations/`.
- `libs/db-migrations/pg/` is created with the PostgreSQL adapter ([POC-6](../../backlog/poc-6-postgresql-adapter-parity.md)). It is not created now.
- The library is generated with `nx g @nx/js:library`, per the repository rules.

### Contract between engines

- The contract holds a logical row type, for example `AppMetaRow`, and a generic `ColumnsOf<Row>`.
- Each engine schema is a class that `implements ColumnsOf<AppMetaRow>`. It has one Drizzle column builder per property.
- The table is exported as `sqliteTable('app_meta', { ...new AppMetaColumns() })`. The spread is required. `drizzle-kit` reads only module exports, so it does not see a class.
- Limit 1: `implements` does not catch an extra column. A `NoExtra` type check closes that gap.
- Limit 2: the type check does not cover primary keys or indexes.
- Because of limit 2, a build script applies the migrations to a temporary database. It compares `PRAGMA table_info` and the index list with a declarative descriptor, `contract/tables.ts`. The descriptor states primary key, nullability, type and indexes.
- [ADR-005](ADR-005-live-schema-validation.md) proposes a shared comparator for this check, in `exact` mode. The decisions in this section do not change.

### Statement separator and checksum

- `drizzle-kit` writes `--> statement-breakpoint` between statements when a file has more than one.
- The migrator splits on that marker when present, else on `;`.
- The checksum covers the full file text.
- The pack step rejects a multi-statement file that has no marker. Splitting on `;` would break literals and triggers, a gap recorded in the [POC-3 result](../../results/POC-03-Result.md).

### Drift

- An Nx target runs `drizzle-kit generate`, then `git diff --exit-code` on `migrations/`. A schema change without a committed migration fails the target.
- `drizzle-kit check` is not enough. It validates the history only.

### Tables

`app_meta` is the first table. It has `key` (text, primary key) and `value` (text, not null). The supervisor writes it at start, by upsert, from the build manifest. Versions are `name@exactVersion`, never ranges.

| Key | Value | Write rule |
|---|---|---|
| `runtime_version` | runtime version | upsert |
| `gateway_version` | gateway version | upsert |
| `web_version` | web bundle version | upsert |
| `first_installed_runtime_version` | first runtime version seen | insert if absent |
| `vector_lib_version` | `sqlite-vector@1.1.2` | upsert |
| `drizzle_version` | `drizzle-kit@0.31.11` (value format is an assumption) | upsert |
| `last_started_at` | ISO timestamp | upsert |

`app_meta` does not store the engine, the service list, the build commit or a schema version.

`schema_migrations` stays the only history table. It gains two columns, `runtime_version` and `duration_ms`. The migrator creates and upgrades it. The row and its migration share one transaction. There is no `__drizzle_migrations` table.

### Run order

Migrations run in the supervisor, in `apps/sea-runtime`, before any service spawns. A failure exits with code 1. [ADR-005](ADR-005-live-schema-validation.md) proposes one more step after the migrations: a one-time check of the live schema structure. This ADR does not decide it. The boot pipeline and the migrator event stream use RxJS 7.8.2, already a dependency of `sea-runtime`. Operators replace imperative loops.

## Evidence

Verified in spike 2026-11-02. The spike was a scratch project outside the repository. It is not committed.

- `drizzle-kit generate` with `0.31.11` produced SQL offline.
- Output used `--> statement-breakpoint` between statements.
- A second `generate` with no schema change produced no new file.
- `drizzle-kit check` validated history only.
- `generate --custom` produced an empty migration file for hand-written DDL.
- A class that `implements` the contract compiled, and the spread export was visible to `drizzle-kit`.
- A missing column or a nullable column failed the type-level equality check.

Verified by registry metadata on 2026-11-02:

- `drizzle-orm` `latest` is `0.45.4` and `rc` is `1.0.0-rc.5`.
- `drizzle-kit` `latest` is `0.31.11` and `rc` is `1.0.0-rc.5`.
- `drizzle-kit` `1.0.0-rc.5` needs `drizzle-orm` `>=1.0.0-rc.5`. `0.31.11` declares no peers.
- `drizzle-orm` `0.45.4` has no `node:sqlite` driver. This does not matter, since the runtime never imports it.

Not verified:

- That `0.31.x` and `1.0.0-rc.x` cannot mix.
- That `generate` output stays stable across Node and OS versions.
- The behavior of `vector` columns in PostgreSQL schemas. That work belongs to POC-6.

## Consequences

- REQ-DB-04, REQ-DB-05 and REQ-STACK-07 change. See the [amendment](../../requirements/amendments-2026-11-02.md).
- A schema change needs a generated migration in the same commit.
- `drizzle-kit` is a build tool only. Supply-chain scope grows by two exact dev packages.
- PostgreSQL adds `pg/` with its own class and descriptor. Engines do not share table definitions ([REQ-DB-03](../../requirements/05-persistence.md)).
- [ADR-005](ADR-005-live-schema-validation.md) proposes a startup check of the live schema structure. It is not part of this decision.
- A downgrade guard that reads `runtime_version` is proposed. The human has not approved it. It is not part of this decision.
- The old line "the migrator splits SQL on `;`" in ADR-003 is superseded for generated files. The marker rule above applies.
