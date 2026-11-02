<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-003-config-and-db-strategy.md
title: "ADR-003 Config singleton and database strategy"
type: architecture
summary: "Records the POC-3 decisions: one resolved root, a Zod config with defaults, a DbAdapter strategy port, sqlite-vector as a SEA asset and a custom migrator."
related[3]: docs/results/POC-03-Result.md,docs/backlog/poc-3-config-sqlite-vector.md,docs/architecture/adr/ADR-002-single-sea-portability.md
status: current
updated: 2026-11-02
-->

# ADR-003: Config singleton and database strategy

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [POC-3 result](../../results/POC-03-Result.md) | [ADR-002](ADR-002-single-sea-portability.md)

## Status

Accepted as the record of what POC-3 built. Recorded 2026-11-02. The Drizzle question is open.

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

The backlog asked to install the current stable `drizzle-orm` tag and verify SQLite vector support. This was not done. The adapter and the migrator use `node:sqlite` and plain SQL. No Drizzle package is installed. [REQ-STACK-07](../../requirements/02-technology-baseline.md) and [OQ15](../../roadmap/PROPOSAL.md#open-questions) stay open. Not verified: whether Drizzle's SQLite driver works with `sqlite-vector` through this port.

## Consequences

- A pgvector adapter implements `DbAdapter` and joins without a consumer change. Vector SQL differs per engine and stays inside each adapter.
- The SEA executable is the trust root for the vector binary (see the result page, verification section).
- The port runs one statement per call. The migrator splits SQL on `;`.
