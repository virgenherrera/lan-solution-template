<!-- toon-meta
fmt: TOON
doc: docs/results/DBM-Schema-Gate-Result.md
title: "DBM Schema Gate Result"
type: backlog
summary: "Result of the schema gate: the runtime reads the live schema once after the migrations and exits 1 before any service starts if the structure is not what the build expects."
ids[0]:
related[4]: docs/backlog/dbm-schema-gate.md,docs/architecture/adr/ADR-005-live-schema-validation.md,docs/results/DBM-Result.md,docs/requirements/amendments-2026-11-02.md
status: current
updated: 2026-11-03
-->

# DBM Schema Gate Result

Branch: `minor/dbm-schema-gate`, off `minor/dbm-drizzle-migrations`. Epic: [DBM schema gate](../backlog/dbm-schema-gate.md). Decisions: [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md).

## Summary

- Question: can the runtime refuse to start when the database structure is not what this build expects, without using versions?
- Answer: yes on macOS arm64. After the migrations the supervisor reads the live schema through the `DbAdapter` port and compares it with a Zod descriptor shipped in the binary.
- A missing element or a changed type, nullability or primary key stops the start with exit 1. An extra `NOT NULL` column without a default also stops it.
- Extra tables, indexes and nullable or defaulted columns are tolerated and logged.
- The check runs once. There is no timer and no version comparison.
- The packaged smoke run passes 14 checks. An independent verification found no blockers.
- Not verified: Windows, Linux and PostgreSQL.

## Slices

| Slice | Commit | Evidence |
|---|---|---|
| DBM-i docs | `af47d39` | REQ-DB-06 amended. REQ-DB-10 added as a proposal. ADR-005 and the backlog page added. `docs/meta.toon` in sync. |
| DBM-j descriptor | `7e21e35` | Zod descriptor and a pure comparator with `exact` and `required` modes. The `db-parity` output is identical to the baseline in 9 cases. Six invalid descriptors are rejected. |
| DBM-k port | `b270c47` | `DbAdapter.introspectSchema()` and its SQLite implementation. The `db-parity` output stays identical in 8 cases. |
| DBM-l gate | `43ba0a9`, `cc35b9e` | The packaged binary starts on 5 databases and exits 1 without spawning on 6. The failure message prints once, in full. An unreadable database names its file. |
| DBM-m dev | `02a8a94` | `nest start` runs the same path from files. A healthy database starts and spawns nothing. A mutated one exits 1 with the same message. |

## The eleven databases

| Case | Result |
|---|---|
| Healthy | starts |
| Extra nullable column | starts |
| Extra table | starts |
| Extra index | starts |
| Extra `NOT NULL` column with a default | starts |
| Missing column | exit 1 |
| Different column type | exit 1 |
| Column made nullable | exit 1 |
| Primary key removed | exit 1 |
| Table missing | exit 1 |
| Extra `NOT NULL` column without a default | exit 1 |

The shipped `app_meta` descriptor has no index, so a missing index cannot be tested with it. The DBM-j run of the comparator on hand-built live schemas covers that case.

## Independent verification

One verifier read `6ce1b2d..HEAD` and ran probes on a clean copy. It found 0 blockers and 6 advisories.

- The 9 `db-parity` cases are identical between the baseline and the candidate.
- Five extra cases behaved as expected: an extra table with a `NOT NULL` column, an empty database whose history says the migration ran, a file that is not SQLite, a newer database with an additive migration, and one that drops an expected column.
- No periodic probe and no comparison by `runtime_version`, `user_version` or `application_id` exists in the gate.

| Advisory | Handling |
|---|---|
| The failure message printed twice, and `main.ts` changed every SEA startup failure | Fixed in `cc35b9e`. The message prints once. The change to every startup failure is intended: one prefixed message instead of a dump of the bundle. |
| The backlog page said 7 and 4 for the eleven databases | Fixed. It says 6 and 5. |
| The backlog page said "No code yet" | Fixed. |
| ADR-005 said `ADD COLUMN NOT NULL` without a default needs a rebuild | Fixed. It works on an empty table and fails on a populated one. |
| A database that is not SQLite did not name the file | Fixed in `cc35b9e`. |
| ADR-005 was still proposed | Set to accepted. |

## Decisions without a human answer

- Slice names `DBM-i` to `DBM-m` are assumptions.
- REQ-DB-10 was approved by the human on 2026-11-02.
- DBM-n: the api-gateway has a Nest database module. It opens one connection per service, does a one-time `SELECT 1` handshake while Nest builds the module, and closes it on shutdown. A failed handshake ends the start with exit 1. The supervisor passes its resolved root to services through `APP_HOME`. The module has no vector backend yet; the first service that needs vectors wires it. The `database` component of the status indicator is not built (a failed handshake aborts the start, so it would never show down). Superseded 2026-11-03: `APP_HOME` is removed. The base directory is `process.cwd()` in dev and the executable directory when packaged ([ADR-007](../architecture/adr/ADR-007-persistence-system.md#one-base-directory)).

## Gaps

- A healthy database always logs one tolerated extra table, `_sqliteai_vector`, created by the vector extension.
- CHECK constraints, triggers, defaults, foreign keys and collation are not modeled by the descriptor. A change only in those passes as valid.
- A `vector` column has no SQLite mapping yet. The first vector table defines it.
- PostgreSQL needs its own `introspectSchema` over `information_schema`. It is not implemented.
- In dev the process exits by itself after the startup and does not close the database.
