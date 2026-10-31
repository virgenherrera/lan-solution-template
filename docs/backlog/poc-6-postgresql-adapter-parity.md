<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-6-postgresql-adapter-parity.md
title: "POC-6 PostgreSQL adapter parity (BACKLOG)"
type: backlog
summary: "Backlog item for PostgreSQL adapter parity, parked in backlog."
related[3]: docs/backlog/README.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md,docs/backlog/poc-7-auth-roles.md
status: current
updated: 2026-10-30
-->

# POC-6: PostgreSQL adapter parity (BACKLOG)

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
| Status | BACKLOG |
| Appetite | none assigned (original estimate: 1 week, small batch) |
| Depends on | n/a |
| Branch | `minor/poc-06-postgres-pgvector (original)` |
| Requirements | 6 REQ ids |
| Acceptance criteria | AC-09 |

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog) and [PROPOSAL backlog entry](../roadmap/PROPOSAL.md#backlog).

PostgreSQL adapter parity behind the same port. Decision 8 deferred it. Gap: the SRS marks REQ-TEST-06 as MUST. REQ-TEST-06 and AC-09 stay unmet until this item runs.

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog)):

- [REQ-DB-01](../requirements/05-persistence.md)
- [REQ-DB-02](../requirements/05-persistence.md)
- [REQ-DB-03](../requirements/05-persistence.md)
- [REQ-DB-05](../requirements/05-persistence.md)
- [REQ-DB-08](../requirements/05-persistence.md)
- [REQ-TEST-06](../requirements/11-nx-quality-testing.md)

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-09](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog). [AC-09](../requirements/11-nx-quality-testing.md) and the PostgreSQL part of [REQ-TEST-06](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog)).

## Tasks

[Back to navigation](#navigation)

- [ ] Add the PostgreSQL adapter (`pg` + pgvector >=0.8.7) behind the same port. Source: [REQ-DB-01](../requirements/05-persistence.md), [REQ-DB-02](../requirements/05-persistence.md), [REQ-DB-03](../requirements/05-persistence.md), [AC-09](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog))
- [ ] Dialect-specific migrations through the same custom migrator contract. Source: [REQ-DB-05](../requirements/05-persistence.md), [AC-09](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog))
- [ ] Vector adapter without silent non-vector fallback on PostgreSQL. Source: [REQ-DB-08](../requirements/05-persistence.md), [AC-09](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog))
- [ ] Run the PostgreSQL part of the persistence APP. If pgvector is not installable, status is blocked-by-environment. Source: [REQ-TEST-06](../requirements/11-nx-quality-testing.md), [AC-09](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog))
- [ ] Apply the stable-first Drizzle rule. Test the stable tag for PostgreSQL vector support. Then fall back to `1.0.0-rc.5` (decision 10). Source: [AC-09](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-6-postgresql-adapter-parity-backlog))
