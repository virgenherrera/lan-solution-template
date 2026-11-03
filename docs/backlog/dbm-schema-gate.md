<!-- toon-meta
fmt: TOON
doc: docs/backlog/dbm-schema-gate.md
title: "DBM schema gate"
type: backlog
summary: "Backlog item for a startup gate that compares the live database structure with the descriptor in the binary."
related[5]: docs/backlog/README.md,docs/backlog/dbm-drizzle-migrations.md,docs/architecture/adr/ADR-005-live-schema-validation.md,docs/requirements/amendments-2026-11-02.md,docs/requirements/05-persistence.md
status: current
updated: 2026-11-02
-->

# DBM: schema gate

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](dbm-drizzle-migrations.md) | [Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Slices](#slices)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Done for DBM-i to DBM-n. See [DBM-Schema-Gate-Result](../results/DBM-Schema-Gate-Result.md) |
| Depends on | DBM ([DBM-Result](../results/DBM-Result.md)) |
| Branch | `minor/dbm-schema-gate`, off `minor/dbm-drizzle-migrations` |
| Delivery | One branch, one PR |
| Decision | [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md) (accepted) |
| Requirements | REQ-DB-06 (amended), REQ-DB-10 (proposed, not approved) |
| Acceptance criteria | AC-07, AC-08, AC-10 (same as POC-3); a gate-specific AC is not defined |

This extends DBM on a human request of 2026-11-02. The slice names are an assumption.

---

## Goal

[Back to navigation](#navigation)

- Read the live schema with the engine: `PRAGMA` on SQLite, `information_schema` on PostgreSQL.
- Compare it with the descriptor that ships in the binary.
- Exit with code 1 before any service spawns when the structure is not what the build expects.
- Run the check once, in the persistence boot. No periodic probe.

| No-gos |
|---|
| No version-based check. No `user_version`, `application_id` or `runtime_version` guard. |
| No fingerprint or JSON description stored in the database. |
| No schema version read by a service. Services stay independent of migrations. |
| No unit or integration suites ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)). |

---

## Requirements

[Back to navigation](#navigation)

- [REQ-DB-06](../requirements/05-persistence.md) (amended)
- [REQ-DB-10](../requirements/05-persistence.md) (proposed, not approved)
- [REQ-TEST-01](../requirements/11-nx-quality-testing.md)

Proof is by real runs of the build and the packaged binary.

---

## Slices

[Back to navigation](#navigation)

One branch, one PR. Slice names DBM-i to DBM-n are an assumption. DBM-n is done: the api-gateway has a Nest database module.

| Slice | Scope | Depends on | Evidence required |
|---|---|---|---|
| DBM-i | Docs: amend REQ-DB-06, propose REQ-DB-10, ADR-005, this page, traceability, amendments | none | The metadata check from [Checks](../standards/README.md#checks) exits 0 |
| DBM-j | Contract: `descriptor.ts` (Zod) and `compare.ts` (`exact` and `required`) in `libs/db-migrations/contract/`. `tables.ts` types come from `z.infer`. The parity check uses `compareSchema` in `exact` mode | DBM-i | Parity exits 0. With a column removed from a copied migrations directory, it exits 1 with the same text as before |
| DBM-k | Port: `LiveSchema` and `DbAdapter.introspectSchema`. `SqliteAdapter` implements it and reports defaults. The parity check drops its own introspector | DBM-j | Parity stdout and exit code are identical to the base run |
| DBM-l | Gate: `verifySchema$` in the boot pipeline, between the migrations and the `app_meta` write, using `required` mode | DBM-k | The packaged binary runs against 11 databases. The 10 cases from the earlier prototype and one rebuilt table with an extra `NOT NULL` column. 6 exit 1 with the message and no spawn. 5 exit 0 with a spawn |
| DBM-m | Dev: an `AssetSource` with a `sea` and an `fs` implementation. `nest start` runs the same persistence path | DBM-l | `nest start` against a mutated database exits 1 with the same message. A valid database starts |
| DBM-n | Done: a Nest database module with a one-time `SELECT 1` handshake for services. Optional `database` component in the service status indicator | DBM-l, the merge of `docs/service-status-indicator`, and a service that opens the database | A service against an unreachable database reports failed |

Design rules for all slices:

- The gate runs once. It never runs on a timer.
- The comparator is one pure function shared by the build and the runtime.
- Migrating stays at the runtime level. Services never read schema versions.
- Generate every project file with its official CLI through `pnpm dlx` or `nx`. Hand edits are listed in the slice result.

---

## Open questions

[Back to navigation](#navigation)

| Topic | Status |
|---|---|
| [REQ-DB-10](../requirements/05-persistence.md) text | proposed, not approved by the human |
| Slice names DBM-i to DBM-n | assumption, not answered by the human |
| Do services open their own database connection, or only the supervisor? | Answered by the human: services get a database module (DBM-n) |
| Does a `database` status component belong in DBM-l or in the `docs/service-status-indicator` branch? | open |
| PostgreSQL type mapping for the gate | not verified, belongs to POC-6 |
