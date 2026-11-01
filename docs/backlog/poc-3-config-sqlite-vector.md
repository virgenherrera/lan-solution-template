<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-3-config-sqlite-vector.md
title: "POC-3 Config and SQLite vector persistence inside the SEA"
type: backlog
summary: "Backlog item for config and SQLite vector persistence inside the SEA."
related[3]: docs/backlog/README.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-4-https-gateway-angular-pwa.md
status: current
updated: 2026-10-30
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
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Cycle 1 (planned) |
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

- [ ] Build the Zod 4 persisted, namespaced config as an immutable DI singleton. Secrets never go in CLI args. Source: [REQ-CFG-01](../requirements/04-configuration.md), [REQ-CFG-02](../requirements/04-configuration.md), [REQ-CFG-04](../requirements/04-configuration.md), [REQ-CFG-06](../requirements/04-configuration.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Keep the real `config.json` under the root that the paths library resolves once. Code uses paths relative to that root. This holds in the built SEA and in the dev server. POC-1 and the installer POCs pick the root folder per OS ([OQ1](../roadmap/PROPOSAL.md#open-questions), decided). Bootstrap before the DB exists: [OQ14](../roadmap/PROPOSAL.md#open-questions). Source: [REQ-CFG-05](../requirements/04-configuration.md), [OQ1](../roadmap/PROPOSAL.md#open-questions), [OQ14](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Build the paths library: one root resolved once, never the cwd as anchor. Precedence: `--root`, `APP_HOME`, marker next to the executable, dev anchor, OS default. In a SEA the anchor is the directory of `process.execPath`. Derive `installDir` (read-only) and the config, data, log and cert paths relative to the root. Source: [REQ-CFG-05](../requirements/04-configuration.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [ ] Test the paths library per launch shape. Shapes: dev server, built SEA started from another cwd, `--root`, `APP_HOME` and marker. The cwd per launcher is not verified. Source: [REQ-CFG-05](../requirements/04-configuration.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [ ] First start creates `config.json` under the root from `config.default.json` if it is missing. The install dir stays read-only. Dev layout: `./config/config.json` and `./data` under the repo. Source: [REQ-CFG-05](../requirements/04-configuration.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md), [decision 11](../roadmap/PROPOSAL.md#decision-log)
- [ ] Add a strategy port for DB adapters; SQLite + vector only. Source: [REQ-DB-01](../requirements/05-persistence.md), [REQ-DB-02](../requirements/05-persistence.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Drizzle tag order: install the current stable `drizzle-orm` tag first. Verify SQLite vector support. Bump to `1.0.0-rc.5` only if it fails. Record the result in `ADR-003`. SRS text fix is proposed in [OQ15](../roadmap/PROPOSAL.md#open-questions). Source: [AC-08](../requirements/11-nx-quality-testing.md), [OQ15](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Use SQLite via `node:sqlite` with sqlite-vector 1.1.2. Extract the native library from a SEA asset. Check its integrity per OS/arch. Source: [REQ-DB-09](../requirements/05-persistence.md), [AC-08](../requirements/11-nx-quality-testing.md), [AC-10](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Build the custom migrator: version, checksum, applied_at, tamper detection, locking, a transaction per engine. Source: [REQ-DB-04](../requirements/05-persistence.md), [REQ-DB-05](../requirements/05-persistence.md), [AC-08](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Startup order: config, adapter, connection, vector check, migrations, ready. Invalid config or incompatible DB fails fast before readiness. Source: [REQ-DB-06](../requirements/05-persistence.md), [AC-07](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Set `foreign_keys` on, evaluate WAL, set explicit durability, keep the DB outside the SEA. Source: [REQ-DB-07](../requirements/05-persistence.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Test an offline vector insert and a similarity query (no persistence mocks). Source: [REQ-DB-08](../requirements/05-persistence.md), [REQ-TEST-06](../requirements/11-nx-quality-testing.md), [AC-10](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))
- [ ] Publish `POC-03-Result` and `ADR-003` (which Drizzle tag was used and why) under `docs/`. Source: [AC-08](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea))

Ids with no pitch task (none invented): [REQ-CFG-03](../requirements/04-configuration.md), [REQ-DB-03](../requirements/05-persistence.md), [REQ-SEC-06](../requirements/07-security.md).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

| OQ | Topic | Status |
|---|---|---|
| [OQ1](../roadmap/PROPOSAL.md#open-questions) | config.json location vs REQ-CFG-05/REQ-SEA-05 | decided (human decision 11) |
| [OQ14](../roadmap/PROPOSAL.md#open-questions) | persisted config bootstrap | proposed |
| [OQ15](../roadmap/PROPOSAL.md#open-questions) | REQ-STACK-07 amendment | proposed |
