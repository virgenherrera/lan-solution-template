<!-- toon-meta
fmt: TOON
doc: docs/requirements/05-persistence.md
title: Persistence
type: requirement
summary: Defines persistence requirements for SQLite and PostgreSQL adapters and migrations.
ids[10]: REQ-DB-01,REQ-DB-02,REQ-DB-03,REQ-DB-04,REQ-DB-05,REQ-DB-06,REQ-DB-07,REQ-DB-08,REQ-DB-09,REQ-DB-10
related[6]: docs/requirements/README.md,docs/requirements/04-configuration.md,docs/requirements/06-web-gateway-https-pwa.md,docs/requirements/amendments-2026-11-02.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/architecture/adr/ADR-005-live-schema-validation.md
status: current
updated: 2026-11-02
-->

# Persistence (SRS §5)

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](04-configuration.md) | [Up](README.md) | [Next](06-web-gateway-https-pwa.md)

Database adapters and startup order. Next: [web gateway, HTTPS and PWA](06-web-gateway-https-pwa.md).

## Navigation

- [At a glance](#at-a-glance)
- [5. Persistence, vectors and migrations](#5-persistence-vectors-and-migrations)

## At a glance

[Back to navigation](#navigation)

| Topic | Point |
|---|---|
| Adapters | SQLite (default) and PostgreSQL |
| Vectors | `sqlite-vector` and `pgvector` |
| Schemas | Own schemas and migrations per engine |
| Migrator | In-house, in the supervisor at startup; `drizzle-kit` runs at build time only |
| Order | config → adapter → connection → vector → migrations → schema check → DB ready → gateway ready |
| Decision | [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md) (accepted); [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md) (proposed) |

## 5. Persistence, vectors and migrations

[Back to navigation](#navigation)

**REQ-DB-01.** The gateway **MUST** provide two adapters through the Strategy Pattern:
- **Default:** SQLite (`node:sqlite` + `drizzle-orm/node-sqlite`) with native `sqlite-vector`.
- **Alternative:** PostgreSQL (`pg` + Drizzle) with `pgvector`.

**REQ-DB-02.** The selection **MUST** come from the validated configuration singleton. Domain consumers **MUST** depend on ports/contracts and **MUST NOT** import the chosen adapter directly.

**REQ-DB-03.** Each engine **MUST** maintain its own SQL schemas and migrations. Do not assume that `sqliteTable` and `pgTable` are interchangeable. Vector operations **MUST** offer a shared contract, with dialect-specific SQL where appropriate.

**REQ-DB-04.** `drizzle-kit` **MUST** run only at build time and **MUST** be a `devDependency`. It generates SQL migrations for each engine. The SEA **MUST** contain only the generated SQL files. The SEA **MUST NOT** contain `drizzle-kit` or `drizzle-orm` code. The in-house migrator applies the SQL. It **MUST** run in the supervisor, before any service starts and before readiness is published.

**REQ-DB-05.** The in-house migrator **MUST** do four things. It reads the persistent history (`version`, `checksum`, `applied_at`, `runtime_version`, `duration_ms`). It applies only pending migrations in order. It detects changes to migrations already applied. It fails explicitly on inconsistencies. The history lives in one table, `schema_migrations`. Each migration and its history row **MUST** share one transaction. It **MUST** define locking/concurrency and transactionality for each engine. Migrations **MUST NOT** be considered applied before they are confirmed.

**REQ-DB-06.** The startup dependency order **MUST** be: `validated config → resolve adapter → open connection/handshake → load/verify vector capability → verify/apply migrations → verify schema structure → publish DB ready → publish gateway ready`. The supervisor **MUST** run the structure check once, when it initializes persistence, and **MUST NOT** repeat it on a timer. See [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md).

**REQ-DB-07.** SQLite **SHOULD** enable `foreign_keys`, evaluate `WAL` and set an explicit durability policy. It **MUST** store `.db`, WAL and SHM outside the SEA.

**REQ-DB-08.** The vector adapter **MUST** demonstrate insertion and similarity query without Internet on SQLite and PostgreSQL. It **MUST NOT** silently fall back to non-vector searches when the extension is missing. On PostgreSQL, the permissions needed to install `pgvector` **MUST** be detected and diagnosed.

**REQ-DB-09.** The SQLite native library **MUST** exist as a real file before `loadExtension()`. If it is packaged as a SEA asset, it **MUST** meet three conditions. Extract it to a controlled location. Validate its integrity. Load only the variant matching the OS/architecture. It **MUST NOT** run arbitrary extensions supplied by clients.

**REQ-DB-10 (approved 2026-11-02).** The supervisor **MUST** compare the live database schema with the table descriptor that ships in the binary. It **MUST** fail startup when an expected table, column or index is missing, when a type, nullability or primary key differs, or when an extra column is `NOT NULL` without a default and is not a primary key. It **MUST** tolerate the other extras: tables, indexes, and nullable or defaulted columns. The check is structural. It **MUST NOT** depend on a schema version. Status: a proposal from the 2026-11-02 amendment. The human has not approved it. See [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md).

```mermaid
flowchart TD
    Config["Validated config: db.engine"] --> Select{Engine}
    Select -->|sqlite| SQLite["node:sqlite + Drizzle"]
    Select -->|postgres| PG[pg + Drizzle]
    SQLite --> SV[native sqlite-vector]
    PG --> PV[pgvector extension]
    SV --> SM[SQLite migrations]
    PV --> PM[PostgreSQL migrations]
    SM --> SC[Schema structure check]
    PM --> SC
    SC --> Ready[DB READY]
    Ready --> Contracts["Repositories / shared contracts"]
```
