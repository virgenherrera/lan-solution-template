<!-- toon-meta
fmt: TOON
doc: docs/results/POC-06-Result.md
title: "POC-06 Result"
type: backlog
summary: "Result of POC-6: PostgreSQL adapter with pgvector, migrations, parity check and a Docker APP smoke test. Branch built, PR pending."
ids[0]:
related[8]: docs/backlog/poc-6-postgresql-adapter-parity.md,docs/architecture/adr/ADR-003-config-and-db-strategy.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/architecture/adr/ADR-005-live-schema-validation.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/results/POC-05-Result.md,docs/standards/README.md,docs/roadmap/PROPOSAL.md
status: current
updated: 2026-11-04
-->

# POC-06 Result

Branch: `minor/poc-06-postgresql-parity`. Epic: [POC-6](../backlog/poc-6-postgresql-adapter-parity.md). Decisions: [ADR-003](../architecture/adr/ADR-003-config-and-db-strategy.md) (adapter, `pg` config block, no vector fallback) and [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md) (live schema per engine). No new ADR: every decision of this slice already sits in those two and in decision 10 of the [proposal](../roadmap/PROPOSAL.md#adr-index). Pull request: pending.

## Summary

- Question: can the same packaged app run on PostgreSQL with pgvector behind the same port, with its own migrations, and be tested from the real app context?
- Answer: yes on one setup. The packaged SEA ran against `pgvector/pgvector:pg17` (pgvector 0.8.7) in Docker on macOS arm64. See [Not verified](#not-verified) for what that does not cover.
- Drizzle, stable-first rule (decision 10): the stable pair `drizzle-orm` 0.45.4 and `drizzle-kit` 0.31.11 with `pg` 8.23.1 works. `1.0.0-rc.5` also works in the spike but is not adopted (reasons in the table below).
- Human request, 2026-11-04: "poc6 (usa docker para pg)".

## Slices

Commits after `main` (`git log --oneline main..HEAD`):

| Unit | Commit | What it built |
|---|---|---|
| T1 engine gaps | `6db41ae` | Per-engine extension points in `db-parity`, `LiveColumnType`, `IGNORED_TABLE`, drizzle config. SQLite behavior unchanged. |
| T2 spike | none (kept outside the repository) | Drizzle stable against `1.0.0-rc.5` on pgvector. |
| T3 adapter | `4656deb` | `PgAdapter`, the `pg` variant of `db.engine`, the factory entry. |
| T4 migrations | `25fba61` | `db-migrations/pg/`, `pack-migrations` for `pg`, `db-parity --engine pg`. |
| T5 vector | `4431022` | `db-parity` prints the inner errors when it cannot connect. The vector checks were already in `4656deb`. |
| T6 APP test | `84e2fb3` | `tools/scripts/smoke-pg.ts` and the Nx target `sea-runtime:smoke-pg`. |

## Drizzle stable-first (decision 10)

| Combination | Result in the spike (pgvector/pgvector:pg17) |
|---|---|
| `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `pg` 8.23.1 | Works: generate, migrate, `vector(3)` insert, `cosineDistance` query. No `bytea` in `pg-core` (a `customType` is needed). `sql` has no `CREATE EXTENSION`. **Adopted.** |
| Same, with `postgres` 4.0.0 | Works with the same results. Not chosen: REQ-DB-01 names `pg`. |
| `1.0.0-rc.5` (orm and kit), `pg` 8.23.1 | Works only with `drizzle({ client: pool })`. `drizzle(pool)` is ignored and connects to `::1:5432`. Different migration layout (`<ts>_<name>/migration.sql` and `snapshot.json`). **Not adopted**: the stable tag passed, so the rule does not ask for the fall-back. |

The spike used the image digest `sha256:7d0a41464797aeb9862dfdc0bbf1526b82cfd324cdd8036df19e3545f4a9ccb8`. Its scratch files were deleted, so the table is the record.

## Verified

Everything ran on macOS 27.2 arm64, Node v26.13.0, Docker 29.9.2 (Docker Desktop), 2026-11-04.

| Item | Proof | Commit |
|---|---|---|
| AC-09: PostgreSQL supports the same contractual operations (connect, query, transaction, vector insert and search, schema introspection) with its own migrations. | Adapter exercised on `pgvector/pgvector:pg17`: connect, query, `bytea`, rollback, cosine search ordered ids 1, 3, 2, introspection. `db-parity --engine pg`: parity ok, exit 0. | `4656deb`, `25fba61`, `4431022` |
| Parity check detects drift on PostgreSQL like on SQLite. | Extra column: `app_meta.extra: unexpected column`, exit 1. Missing column: `app_meta.value: column missing`, exit 1. | `25fba61` |
| REQ-TEST-06: the packaged SEA, with `db.engine` `pg` and `data/pg.pass`, covers the initial migration. | `nx run sea-runtime:smoke-pg` exit 0, check `first start`: `schema_migrations` holds `1\|0000_create_app_meta`, the vector extension is installed. | `84e2fb3` |
| REQ-TEST-06: restart without re-running. | Check `restart`: the log has `already applied`, no `applied in`, `applied_at` unchanged. | `84e2fb3` |
| REQ-TEST-06: pending migration. | Check `pending migration`: the history row and `app_meta` are removed, the next start applies migration 1 again, the history holds one row. Simulated: the only embedded migration is made pending again, because no second migration exists. | `84e2fb3` |
| REQ-TEST-06: altered checksum. | Check `altered checksum`: exit 1, the log has `migration 1 (0000_create_app_meta) changed after it was applied`, no service spawned. | `84e2fb3` |
| REQ-TEST-06: initialization failure. | Check `live column dropped`: `schema check FAILED`, exit 1, no service spawned. Check `postgres:17-alpine`: exit 1, `pgvector extension is not installed`, no ready line, `app_meta` not created. | `84e2fb3` |
| REQ-TEST-06 and REQ-DB-08: genuine vector query, no silent fallback. | The start logs `database pg ready, vector ok` only after the adapter ran `SELECT '[1,0,0]'::vector <=> '[0,1,0]'::vector`. The test repeats it in the container: cosine distance 1. Without the extension the start stops. | `4431022`, `84e2fb3` |
| REQ-TEST-06: fixtures isolate each run and clean up. | Containers carry the label `lan-smoke-pg=<run id>` and a random port and password. They are removed on normal end, on a failed check and on SIGINT or SIGTERM (exit 130). `docker ps -aq --filter label=lan-smoke-pg` is empty after the run, after a Docker-less run and after a killed run. | `84e2fb3` |
| No mocks. | The test starts the real packaged binary and real PostgreSQL containers. | `84e2fb3` |
| With no reachable Docker daemon the test fails, never skips. | `DOCKER_HOST=unix:///nonexistent.sock node tools/scripts/smoke-pg.ts`: `FAIL @app docker: daemon reachable: the Docker daemon is not reachable ... Start Docker Desktop ... this test never skips`, exit 1, no container. | `84e2fb3` |
| SQLite is unchanged. | `nx run sea-runtime:package` (which runs `smoke-sea`: 30 checks passed) exit 0. `db-parity` for SQLite is identical to the baseline in stdout, stderr and exit. | `6db41ae`, `84e2fb3` |
| Docs metadata is in sync. | Regeneration of `docs/meta.toon` in a temporary directory and `cmp -s` exit 0 (see the closing commit). | docs commit |

## Not verified

- Windows, Linux and macOS x64. The test is POSIX only (`docker exec`, signals) and ran on macOS arm64.
- PostgreSQL versions other than 17 and pgvector versions other than 0.8.7. One image digest only.
- The permission diagnosis for a non-superuser role is checked by hand against the adapter (`4656deb`, `4431022`). `smoke-pg` does not run it.
- Vector insert and similarity search through the port from inside the packaged app. The app schema has no vector table, so the packaged test runs only the `verifyVector` query. `insertVector` and `searchSimilar` were run against the container outside the SEA.
- A second embedded migration. "Pending migration" is simulated with the only one that exists.
- Concurrent migration runs on PostgreSQL. REQ-DB-05 asks to define locking and concurrency per engine. A search of `migrator.ts` and `pg/adapter.ts` finds retry on SQLite lock errors and no PostgreSQL advisory lock. Not tested.
- Running without Internet. The first run pulls two images. Once they are local the test needs no network, but this was not run offline.
- Any CI run. POC-9 is on hold, so `smoke-pg` is not part of a pipeline. It is a manual target because it needs Docker.

## Debt

- A PostgreSQL advisory lock around the migrator, and a test with two processes (REQ-DB-05).
- A vector table in the app schema, so the packaged test can insert and search through the port.
- Decide in POC-9 whether `smoke-pg` runs in CI (needs Docker on the runner).
- Re-evaluate `1.0.0-rc.5` when it becomes the stable tag.

### Advisories from the independent verification

The independent verifier returned PASS with advisories. No blocker. Each item below is debt, not a fix of this slice.

- `PgAdapter.connect` does not validate `passwordFile` itself. The config schema regex is the only guard, so a path such as `join(dataDir, '../outside/secret')` or a symlink is followed. This is the same trust model as the SQLite file.
- The adapter calls `.trim()` on the password. A password with leading or trailing whitespace loses it.
- `db-parity` writes the `pg.pass` file in its work directory without mode `0600`.
- `smoke-pg` leaves containers behind when the process gets SIGKILL (label `lan-smoke-pg`; no handler can run). The synchronous `docker run` also delays the signal handler by up to 300 s.
- `db-parity --pg-port 99999` prints the raw `ERR_SOCKET_BAD_PORT`. The option is not validated as a port number.
- `numberPlaceholders` does not skip a `?` inside double-quoted identifiers, comments or dollar-quoted strings, so it would number them as placeholders. The current SQL does not use these.
- No committed APP test runs `insertVector` or `searchSimilar` against PostgreSQL (gap in REQ-TEST-06 coverage; see "Not verified" and the vector table debt above). The verifier marked S6 as partial for this reason.
- Some commit subjects on this branch write `PostgreSQL` with capitals. [AGENTS.md](../../AGENTS.md) asks for lowercase subjects. History is not rewritten.
- Pre-existing, not caused by this branch: `nx run-many -t build` without `--exclude=lan-solution-template` fails with `Recursive task invocation`. It fails the same way on `main`.

## Recipe for the human

```sh
# Docker Desktop must be running.
pnpm exec nx run sea-runtime:smoke-pg --output-style=static
docker ps -aq --filter label=lan-smoke-pg   # must print nothing
```
