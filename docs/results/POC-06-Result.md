<!-- toon-meta
fmt: TOON
doc: docs/results/POC-06-Result.md
title: "POC-06 Result"
type: backlog
summary: "Result of POC-6: PostgreSQL adapter with pgvector, migrations, parity check and a Docker APP smoke test. Branch built, health and dependency cleanup added, PR pending."
ids[0]:
related[8]: docs/backlog/poc-6-postgresql-adapter-parity.md,docs/architecture/adr/ADR-003-config-and-db-strategy.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/architecture/adr/ADR-005-live-schema-validation.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/results/POC-05-Result.md,docs/standards/README.md,docs/roadmap/PROPOSAL.md
status: current
updated: 2026-11-05
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
| Config in Nest DI | `883886e`, `14f5da4`, `c188813`, `9a55016`, `e56cb05` | `AppConfigModule` with nestjs-zod namespaces in shared-core; `@InjectConfig` per namespace (sea-runtime db config, api-gateway `DbConfig` and `ServerConfig`); nestjs-zod validation pipe and serializer interceptor registered globally in the gateway; `keep_classnames` in the shared bundler config (see below). |
| Health | `888d00f` | `GET /api/health` validates its query with a nestjs-zod DTO and answers in the `@nestjs/terminus` shape; e2e test; `smoke-sea` and `verify-platform` read `details.state.state`; ADR-002 and ADR-006 updated. |
| smoke-sea poll | `1c24d2f` | Bounded poll for the `tls: using leaf certificate` line in `tools/scripts/smoke-sea.ts`. It did not remove the flake (see Debt). |
| smoke-sea diagnostic | see git log | When the check "second start uses the TLS files" fails, the message now includes up to 3 `tls:` stderr lines of the second start. The check still requires `using leaf certificate`. |
| Dependencies | `d6fcded` | Dropped the `supports-color` pin and unused dependencies (see Debt). |

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

### Health, dependencies and startup failure

Checked on 2026-11-05 on the same setup as above.

| Item | Proof | Commit |
|---|---|---|
| `GET /api/health` shape and indicators. | The query is validated by a nestjs-zod DTO (`createZodDto` class). The answer has the `@nestjs/terminus` shape `{status, info, error, details}`. Indicators: `state` (always), `uptime` (on by default, `uptime=false` removes it), `memory` (dummy value 42 MB, `memory=true`), `db` (`SELECT 1` through `DatabaseService`, `db=true`). Truthy values: `true`, `1`, `yes`, `on`; any other value counts as false, like nest-base. | `888d00f` |
| Health e2e (REQ-TEST-04). | `apps/api-gateway/test/health/get-health.spec.ts`, 8 tests, Jest 30 + ts-jest + Supertest, real SQLite in a temporary directory. | `888d00f` |
| Health consumers. | `smoke-sea.ts` and `verify-platform.ts` read `details.state.state`. | `888d00f` |
| nestjs-zod 5.5.0 runs with @nestjs/common 12.3.2 despite the peer range. | The e2e test passes. | `888d00f` |
| Invalid `--web` is unchanged. | Same output as the base, exit 1. | `4b5dd0c` |
| `smoke-pg` with Docker. | exit 0. | `d6fcded` |
| Unreachable database fails fast. | With `abortOnError: false`: exit 1 and `startup failed: database handshake failed (pg): ...` in under 1 s. Three cases: closed port, missing `passwordFile`, nonexistent host. | `d6fcded` |
| A bad database credential fails fast. | Against PostgreSQL in Docker, a wrong password gives exit 1 and `startup failed: database handshake failed (pg): password authentication failed for user "postgres"` without hanging (`database.module.ts:21`). The control with the right password starts (`https listening 127.0.0.1:38443`). Run with `node apps/api-gateway/dist/main.js`, not the SEA binary. | see git log |
| Clean clone at `888d00f`. | `install --frozen-lockfile`, build and the `docs/meta.toon` check all exit 0. | `888d00f` |
| Dependency cleanup keeps one copy. | After removing the `supports-color@8.1.1` pin, a clean clone still has one copy of `@nestjs/config`, `@nestjs/common` and `@nestjs/core`. | `d6fcded` |

## Not verified

- Windows, Linux and macOS x64. The test is POSIX only (`docker exec`, signals) and ran on macOS arm64.
- PostgreSQL versions other than 17 and pgvector versions other than 0.8.7. One image digest only.
- The permission diagnosis for a non-superuser role is checked by hand against the adapter (`4656deb`, `4431022`). `smoke-pg` does not run it.
- Vector insert and similarity search through the port from inside the packaged app. The app schema has no vector table, so the packaged test runs only the `verifyVector` query. `insertVector` and `searchSimilar` were run against the container outside the SEA.
- A second embedded migration. "Pending migration" is simulated with the only one that exists.
- Concurrent migration runs on PostgreSQL. REQ-DB-05 asks to define locking and concurrency per engine. A search of `migrator.ts` and `pg/adapter.ts` finds retry on SQLite lock errors and no PostgreSQL advisory lock. Not tested.
- Running without Internet. The first run pulls two images. Once they are local the test needs no network, but this was not run offline.
- The cause of the `smoke-sea` flake "second start uses the TLS files" (see Debt). The bounded poll in `1c24d2f` did not remove it, and the investigation did not reproduce it.
- A bad database credential through the packaged SEA binary. It was checked with `node apps/api-gateway/dist/main.js` only (see Verified).
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
- Health: a typo such as `uptime=flase` counts as false and removes `uptime` with a 200. Accepted, same rule as nest-base.
- Pre-existing, not caused by this branch: `nx run-many -t build` without `--exclude=lan-solution-template` fails with `Recursive task invocation`. It fails the same way on `main`.

### Dependencies

- Removed the `supports-color@8.1.1` pin, and 8 unused dependencies: `tsconfig-paths-webpack-plugin`, `webpack-node-externals`, `@angular/forms`, `@nestjs/mau`, `source-map-support`, `vite` (api-gateway), `@nestjs/testing`, `supertest` and `@types/supertest` (sea-runtime). `vitest` was removed from api-gateway.
- Added with exact versions in the catalog: `jest` 30.5.2, `ts-jest` 29.4.15, `@types/jest` 30.0.0, `@nestjs/terminus` 12.1.0.

### DI by class debt

- [td-nest-di-by-class](../backlog/td-nest-di-by-class.md): resolved and verified (commit `b70184d`). `CLOCK`, `RANDOM` and `SERVICE_ROUTES` are now the abstract classes `Clock`, `Random` and `ServiceRoutes`, with `SystemClock`, `SystemRandom` and `SeaServiceRoutes` injected with `useClass` (strategy pattern). `ServiceLifecycle` is unchanged. `persistence-system.md:88` no longer names `DATABASE_ADAPTER`. An independent verifier ran build, lint, test:static, test:dynamic (8 tests) and smoke-pg with exit 0 on the working tree. `smoke-sea` passed 30 checks in 2 of 3 runs; the first run hit the flake described in Debt.

### Config migration and keep_classnames

- `883886e`, `14f5da4`, `c188813`, `9a55016`: config moved to `AppConfigModule`, `@InjectConfig` and nestjs-zod. The gateway injects only the `db` namespace and keeps the strict config root.
- Cause of the SEA failure fixed in `e56cb05`: nestjs-zod resolves the reflector by the class name `Reflector`. The minified bundle renamed the class, so the SEA gateway failed at startup.
- Fix: `SwcJsMinimizerRspackPlugin` with `keep_classnames` (compress and mangle) in `tools/rspack/nest.config.ts`, also passed to the SEA bundle in `tools/scripts/compile-sea.ts`. The manual `Reflector` alias was removed.

### Advisories from the config migration

- nestjs-zod 5.5.0 declares the peer `@nestjs/common` `^10 || ^11`, while 12.3.2 is installed.
- The bundle depends on `keep_classnames`, and only `smoke-sea` detects a regression.
- Project decision (not a REQ): `keep_classnames` in `tools/rspack/nest.config.ts` is mandatory. Nest DI by class, nestjs-zod and `Reflector` resolve by class name, and the minifier would rename the classes. The cost, a few tens of KB, is accepted. No guard or regex runs over the bundle.
- `NetConfig` and `TlsConfig` are exported with no consumer, and the gateway still uses the aggregate `loadConfig` in `main` before Nest starts.
- `docs/backlog/persistence-system.md:88` mentions `APP_CONFIG` (a historical row).
- `smoke-sea` read `run.lines` right after ready, and the line `tls: using leaf certificate` (stderr) could arrive later (`libs/shared-core/src/tls/identity.ts:164`). A bounded poll was added in `1c24d2f` (`tools/scripts/smoke-sea.ts`), but the flake is not fixed. The check "second start uses the TLS files" failed twice more (missing `using leaf certificate`), both times on the first run after `pnpm run build` (one during the build of `888d00f`, one while verifying the DI refactor); both reruns passed. So late stderr is not the only cause. An investigation did not reproduce it: 13 of 13 runs passed, with 6 background CPU processes and one run right after `nx run sea-runtime:package`. Cause: not verified. Hypothesis, not verified: `libs/shared-core/src/tls/identity.ts:160-165` has two branches; if `needsReissue` decides to reissue (host name or network interfaces changed between the two starts), the log is `tls: leaf certificate ... does not match the current host names ...` and the check fails while the gateway works. `smoke-sea` now prints the real `tls:` lines when the check fails, to show the cause at the next failure.
- Change (O1): the automatic leaf SAN names are now loopback (`127.0.0.1`, `::1`), `localhost`, the host name and the LAN IPv4 addresses. Addresses from `os.networkInterfaces()` no longer add IPv6. A stable IPv6 goes in `tls.extraNames`. `needsReissue` is unchanged (strict). `smoke-sea` gained two checks: the leaf SAN holds every LAN IPv4 and no IPv6 other than `::1`, and a name added to `tls.extraNames` without `generate-certs` is reported on stderr as `missing name: lan.test`. Cause of the flake: still NOT verified. O1 covers only the IPv6 part of H1 (rotating temporary IPv6 addresses in the name set); a hostname or IPv4 change between the two starts is not covered. Leaf certificates issued before this change carry IPv6 SANs: the first start logs one `unexpected name` mismatch until `generate-certs` runs once.
- `nx run-many` without `--exclude=lan-solution-template` fails by recursion on `main` too.

## Recipe for the human

```sh
# Docker Desktop must be running.
pnpm exec nx run sea-runtime:smoke-pg --output-style=static
docker ps -aq --filter label=lan-smoke-pg   # must print nothing
```
