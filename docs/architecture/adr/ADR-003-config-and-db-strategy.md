<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-003-config-and-db-strategy.md
title: "ADR-003 Config singleton and database strategy"
type: architecture
summary: "Records POC-3: config singleton, DbAdapter strategy port, sqlite-vector SEA asset, custom migrator. Root and defaults rules superseded by ADR-007."
related[5]: docs/results/POC-03-Result.md,docs/backlog/poc-3-config-sqlite-vector.md,docs/architecture/adr/ADR-002-single-sea-portability.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/architecture/adr/ADR-007-persistence-system.md
status: current
updated: 2026-11-09
-->

# ADR-003: Config singleton and database strategy

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [POC-3 result](../../results/POC-03-Result.md) | [ADR-002](ADR-002-single-sea-portability.md) | [ADR-004](ADR-004-drizzle-build-time-migrations.md)

## Status

Accepted as the record of what POC-3 built. Recorded 2026-11-02. POC-3 left the Drizzle question open. [ADR-004](ADR-004-drizzle-build-time-migrations.md) answers it (accepted).

Update 2026-11-03: [ADR-007](ADR-007-persistence-system.md) supersedes three decisions below. The root chain becomes one base directory (cwd in dev, executable directory when packaged). The config has no defaults, is never created by the runtime, and a missing or invalid file stops the start. The adapter registry becomes a lazy `import()` of the selected engine.

## Context

[REQ-CFG-01](../../requirements/04-configuration.md) asks for a persisted, namespaced, immutable config. [REQ-DB-01](../../requirements/05-persistence.md) and [REQ-DB-02](../../requirements/05-persistence.md) ask for a strategy port with an engine chosen by config. The human asked to wire it with Zod and the strategy pattern because pgvector comes next.

## Decision

- One root, resolved once, never from the cwd. Precedence: `--root`, `APP_HOME`, marker beside the executable, dev anchor, OS default. Derived: `installDir`, `configDir`, `dataDir`, `logDir`, `certDir`.
- Config is a Zod 4 schema. Every key has its default in the schema (human decision D2). The result is deep-frozen and initialized once per process.
- `DbAdapter` is the only database surface for consumers. `db.engine` selects the adapter from a registry. A new engine adds one registry entry and one enum value.
- The vector API is part of the port (`verifyVector`, `insertVector`, `searchSimilar`). A missing vector capability throws `VectorUnavailableError`. There is no silent non-vector mode ([REQ-DB-08](../../requirements/05-persistence.md)).
- `sqlite-vector` 1.1.2 is pinned per platform (tarball sha512, binary sha256) in `tools/vector/sqlite-vector-1.1.2.json`. `compile-sea` embeds the target binary. At run time it is extracted to a private directory, hashed, then loaded ([REQ-DB-09](../../requirements/05-persistence.md)).
- The migrator uses only the port. History: `schema_migrations` with version, name, checksum and `applied_at`. Each migration and its history row share one transaction.
- Startup order in the supervisor: root, config, adapter, connect, vector check, migrations, then services ([REQ-DB-06](../../requirements/05-persistence.md)).

## Drizzle

POC-3 did not install Drizzle. The adapter and the migrator use `node:sqlite` and plain SQL. [REQ-STACK-07](../../requirements/02-technology-baseline.md) and [OQ15](../../roadmap/PROPOSAL.md#open-questions) stayed open when POC-3 closed.

[ADR-004](ADR-004-drizzle-build-time-migrations.md) records the later decision. `drizzle-kit` runs only at build time and generates SQL. The SEA carries only that SQL. The migrator described above applies it. The runtime never imports Drizzle.

## Consequences

- The PostgreSQL adapter (`pg` driver, pgvector) implements `DbAdapter` and joined without a consumer change. Vector SQL differs per engine and stays inside each adapter.
- `db.engine: "pg"` takes one `pg` block: `host`, `port`, `database`, `user` and `passwordFile`. `passwordFile` is a plain file name inside the data directory, so the secret never lives in `config.json`. The block is validated like the rest of the config.
- The PostgreSQL adapter never falls back to a non-vector search. `verifyVector` checks `pg_available_extensions` and `pg_extension`, runs `CREATE EXTENSION vector` when the extension is available but not installed, and reports the role, the database and whether the extension is trusted when the server refuses (REQ-DB-08).
- The adapter keeps one connection. The port uses `?` placeholders, and the adapter rewrites them to `$1`, `$2`, and so on outside quoted literals.
- The SEA executable is the trust root for the vector binary (see the result page, verification section).
- The port runs one statement per call. The migrator splits SQL on `;`.

## Implementation status

Audit of 2026-11-09 against `main` at `cfec959`. The decision text above is kept as the record. This table says what the code does today.

| Decision | Decision status | Implementation | Check | Evidence | Gap |
|---|---|---|---|---|---|
| One root resolved once; precedence --root APP_HOME marker dev anchor OS default | Accepted as the record of what POC-3 built | Not implemented | confirmed | `libs/shared-core/src/paths.ts:21` | Superseded by ADR-007 per ADR-003 update; code is resolveBase sea ? dirname(execPath) : resolve(cwd) |
| Derived dirs installDir configDir dataDir logDir certDir | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/paths.ts:13`, `libs/shared-core/src/paths.ts:17`, `libs/shared-core/src/paths.ts:27` | none |
| Config Zod 4 schema deep-frozen initialized once | Accepted as the record of what POC-3 built | Outdated | adjudicated | `libs/shared-core/src/config.ts:55`, `libs/shared-core/src/config.ts:68`, `libs/shared-core/src/config.ts:85` | Per-key schema defaults no longer exist (ADR-007 supersedes); file must exist |
| DbAdapter is only DB surface; db.engine selects from registry | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/db/port.ts:44`, `libs/shared-core/src/db/factory.ts:19`, `libs/shared-core/src/db/factory.ts:33` | none |
| Vector API in port; VectorUnavailableError no silent non-vector mode | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/db/port.ts:44`, `libs/shared-core/src/db/port.ts:49`, `libs/shared-core/src/db/port.ts:50` | none |
| sqlite-vector 1.1.2 pinned per platform and embedded | Accepted as the record of what POC-3 built | Implemented | single source | `tools/vector/sqlite-vector-1.1.2.json:3`, `tools/scripts/compile-sea.ts:370`, `tools/scripts/compile-sea.ts:402` | none |
| Vector binary extracted to private dir hashed then loaded | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/db/sqlite/vector.ts:53`, `libs/shared-core/src/db/sqlite/vector.ts:59`, `libs/shared-core/src/db/sqlite/vector.ts:64` | ADR says sha512 tarball and sha256 binary; runtime checks sha256 of binary |
| Migrator uses only port; schema_migrations history one transaction each | Accepted as the record of what POC-3 built | Implemented | confirmed | `libs/shared-core/src/db/migrator.ts:38`, `libs/shared-core/src/db/migrator.ts:145`, `libs/shared-core/src/db/migrator.ts:155` | none |
| Startup order root config adapter connect vector migrations services | Accepted as the record of what POC-3 built | Implemented | single source | `apps/sea-runtime/src/services/persistence.service.ts:23`, `apps/sea-runtime/src/services/persistence.service.ts:59`, `apps/sea-runtime/src/services/persistence.service.ts:70` | Order now also includes schema check and app_meta |
| Drizzle not installed in POC-3 (superseded by ADR-004) | Accepted as the record of what POC-3 built | Not implemented | confirmed | `pnpm-workspace.yaml:38` | Drizzle is now a catalog dependency; ADR-004 supersedes |
| PostgreSQL adapter implements DbAdapter | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/db/pg/adapter.ts:175`, `libs/shared-core/src/db/factory.ts:27` | none |
| pg block host port database user passwordFile in data dir | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/config.ts:30`, `libs/shared-core/src/config.ts:36`, `libs/shared-core/src/db/pg/adapter.ts:78` | none |
| PG verifyVector checks extensions creates extension reports role | Accepted as the record of what POC-3 built | Implemented | confirmed | `libs/shared-core/src/db/pg/adapter.ts:89`, `libs/shared-core/src/db/pg/adapter.ts:103`, `libs/shared-core/src/db/pg/adapter.ts:113` | none |
| One connection; ? placeholders rewritten to $n outside literals | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/db/pg/adapter.ts:43` | none |
| Port runs one statement per call; migrator splits SQL on ; | Accepted as the record of what POC-3 built | Implemented | single source | `libs/shared-core/src/db/migrator.ts:72`, `libs/shared-core/src/db/migrator.ts:75` | none |
