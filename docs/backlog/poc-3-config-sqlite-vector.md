<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-3-config-sqlite-vector.md
title: "POC-3 Config and SQLite vector persistence inside the SEA"
type: backlog
summary: "Backlog item for config and SQLite vector persistence inside the SEA."
related[4]: docs/backlog/README.md,docs/backlog/persistence-system.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-4-https-gateway-angular-pwa.md
status: current
updated: 2026-11-03
-->

# POC-3: Config and SQLite vector persistence inside the SEA

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2h-result-and-adr.md) | [Up](README.md) | [Next](poc-4-https-gateway-angular-pwa.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Slices](#slices)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Done and merged in PR #12 (branch `minor/poc-03-sqlite-vector`); config and paths later changed by [Persistence system](persistence-system.md); see [POC-03-Result](../results/POC-03-Result.md) |
| Appetite | 2 weeks, big batch |
| Depends on | POC-2 |
| Branch | `minor/poc-03-sqlite-vector` |
| Requirements | 18 REQ ids |
| Acceptance criteria | AC-07, AC-08, AC-10 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea).

- Make config and persistence work from inside the SEA.
- Parts: a Zod 4 config singleton, a DB adapter port, and a custom migrator.
- SQLite loads its native vector extension from a SEA asset.

| No-gos |
|---|
| No drizzle-kit. |
| No silent non-vector fallback. |
| No client-supplied extensions. |
| No secrets in CLI args. |
| No mocks of persistence. |

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea)):

- [REQ-CFG-01](../requirements/04-configuration.md)
- [REQ-CFG-02](../requirements/04-configuration.md)
- [REQ-CFG-03](../requirements/04-configuration.md)
- [REQ-CFG-04](../requirements/04-configuration.md)
- [REQ-CFG-05](../requirements/04-configuration.md)
- [REQ-CFG-06](../requirements/04-configuration.md)
- [REQ-DB-01](../requirements/05-persistence.md)
- [REQ-DB-02](../requirements/05-persistence.md)
- [REQ-DB-03](../requirements/05-persistence.md)
- [REQ-DB-04](../requirements/05-persistence.md)
- [REQ-DB-05](../requirements/05-persistence.md)
- [REQ-DB-06](../requirements/05-persistence.md)
- [REQ-DB-07](../requirements/05-persistence.md)
- [REQ-DB-08](../requirements/05-persistence.md)
- [REQ-DB-09](../requirements/05-persistence.md)
- [REQ-TEST-06](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-06](../requirements/07-security.md)

Cited elsewhere in the pitch:

- [REQ-SEA-05](../requirements/10-node-sea-distribution.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-07](../requirements/11-nx-quality-testing.md)
- [AC-08](../requirements/11-nx-quality-testing.md)
- [AC-10](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea). [AC-10](../requirements/11-nx-quality-testing.md) (persistence and vector part). [REQ-TEST-06](../requirements/11-nx-quality-testing.md) is the SQLite part. The POC records which Drizzle tag it used (stable or `1.0.0-rc.5`) and why.

---

## Tasks

[Back to navigation](#navigation)

- [x] Build the Zod 4 persisted, namespaced config as an immutable DI singleton. Secrets never go in CLI args. Source: [REQ-CFG-01](../requirements/04-configuration.md), [REQ-CFG-02](../requirements/04-configuration.md), [REQ-CFG-04](../requirements/04-configuration.md), [REQ-CFG-06](../requirements/04-configuration.md)
- [x] Keep the real `config.json` under one base directory. Code uses paths relative to it, in the built SEA and in dev. Bootstrap before the DB exists: [OQ14](../roadmap/PROPOSAL.md#open-questions). Source: [REQ-CFG-05](../requirements/04-configuration.md), [OQ1](../roadmap/PROPOSAL.md#open-questions), [OQ14](../roadmap/PROPOSAL.md#open-questions)
- [x] Build the paths library: one base directory resolved once. The slice first built a precedence chain (`--root`, `APP_HOME`, marker, dev anchor, OS default). [ADR-007](../architecture/adr/ADR-007-persistence-system.md) replaced it: `process.cwd()` in dev, the directory of `process.execPath` in a SEA. The config, data, log and cert paths derive from it. Source: [REQ-CFG-05](../requirements/04-configuration.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [x] Test the paths library per launch shape (dev server, built SEA started from another cwd). The cwd per launcher is verified for launchd and systemd system units: `/` without `WorkingDirectory` ([POC-2a result](../results/POC-02a-launcher-cwd.md)). Source: [REQ-CFG-05](../requirements/04-configuration.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [x] Config file: first built to be created on first start. Replaced by [ADR-007](../architecture/adr/ADR-007-persistence-system.md): a missing or invalid `config/config.json` stops the start, nothing creates it, and `libs/shared-core/config.example.json` documents it. The install dir stays read-only. Source: [REQ-CFG-05](../requirements/04-configuration.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [x] Add a strategy port for DB adapters; SQLite + vector only. Source: [REQ-DB-01](../requirements/05-persistence.md), [REQ-DB-02](../requirements/05-persistence.md)
- [x] Drizzle tag order: install the current stable `drizzle-orm` tag first. Verify SQLite vector support. Bump to `1.0.0-rc.5` only if it fails. Record the result in `ADR-004`. SRS text fix is proposed in [OQ15](../roadmap/PROPOSAL.md#open-questions). Source: [AC-08](../requirements/11-nx-quality-testing.md), [OQ15](../roadmap/PROPOSAL.md#open-questions)
- [x] Use SQLite via `node:sqlite` with sqlite-vector 1.1.2. Extract the native library from a SEA asset. Check its integrity per OS/arch. Source: [REQ-DB-09](../requirements/05-persistence.md), [AC-08](../requirements/11-nx-quality-testing.md), [AC-10](../requirements/11-nx-quality-testing.md)
- [x] Build the custom migrator: version, checksum, applied_at, tamper detection, locking, a transaction per engine. Source: [REQ-DB-04](../requirements/05-persistence.md), [REQ-DB-05](../requirements/05-persistence.md), [AC-08](../requirements/11-nx-quality-testing.md)
- [x] Startup order: config, adapter, connection, vector check, migrations, ready. Invalid config or incompatible DB fails fast before readiness. Source: [REQ-DB-06](../requirements/05-persistence.md), [AC-07](../requirements/11-nx-quality-testing.md)
- [x] Set `foreign_keys` on, evaluate WAL, set explicit durability, keep the DB outside the SEA. Source: [REQ-DB-07](../requirements/05-persistence.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md)
- [x] Test an offline vector insert and a similarity query (no persistence mocks). Source: [REQ-DB-08](../requirements/05-persistence.md), [REQ-TEST-06](../requirements/11-nx-quality-testing.md), [AC-10](../requirements/11-nx-quality-testing.md)
- [x] Publish `POC-03-Result` and `ADR-003` (config and database strategy) and `ADR-004` (which Drizzle tag was used and why) under `docs/`. Source: [AC-08](../requirements/11-nx-quality-testing.md)

Ids with no pitch task (none invented): [REQ-CFG-03](../requirements/04-configuration.md), [REQ-DB-03](../requirements/05-persistence.md), [REQ-SEC-06](../requirements/07-security.md).

---

## Slices

[Back to navigation](#navigation)

One branch, one PR (same delivery as POC-2). Seven slices, each with its own commit and result page under `docs/results/`.

| Slice | Scope | Pitch tasks | Depends on |
|---|---|---|---|
| 3a | Paths library in `libs/shared-core`: one base directory, tests per launch shape | paths lib, paths tests | none |
| 3b | Zod 4 config singleton and `config.json` under the base directory | config singleton, `config.json`, first start | 3a |
| 3c | `DbAdapter` strategy port and SQLite adapter on `node:sqlite`; the adapter is chosen by a config discriminator | strategy port | 3b |
| 3d | `sqlite-vector` native library extracted from a SEA asset, integrity check, offline vector insert and similarity query | SQLite with vector, offline vector test | 3c |
| 3e | Custom migrator: version, checksum, `applied_at`, tamper detection, locking, one transaction per engine | migrator | 3c |
| 3f | Startup order in `sea-runtime`, pragmas (`foreign_keys`, WAL decision, durability), packaged-binary smoke | startup order, pragmas | 3d, 3e |
| 3g | `POC-03-Result` and `ADR-003` (strategy port, vector library) and `ADR-004` (Drizzle tag) | result and ADR | 3f |

Design rules for all slices:

- Config is a strict Zod 4 schema with no defaults. Validation runs once at startup and the result is frozen.
- The database is reached only through the `DbAdapter` port. Consumers never import `node:sqlite`.
- `sqliteAdapter` is the only adapter. The port names vector operations (`insertVector`, `searchSimilar`) so a `pgvector` adapter can join later ([POC-6](poc-6-postgresql-adapter-parity.md)).
- `db.engine` selects the adapter. An unknown engine stops the start before readiness.
- The vector library name is `sqlite-vector` 1.1.2, as in REQ-STACK-09. `sqlite-vec` is a different project and is not used.

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

| OQ | Topic | Status |
|---|---|---|
| [OQ1](../roadmap/PROPOSAL.md#open-questions) | config.json location vs REQ-CFG-05/REQ-SEA-05 | decided (human decision 11) |
| [OQ14](../roadmap/PROPOSAL.md#open-questions) | persisted config bootstrap | proposed |
| [OQ15](../roadmap/PROPOSAL.md#open-questions) | REQ-STACK-07 amendment | proposed |
