<!-- toon-meta
fmt: TOON
doc: docs/results/DBM-Result.md
title: "DBM Result"
type: backlog
summary: "Result of DBM: Drizzle generates SQL at build time, only the SQL travels in the SEA, and the supervisor applies it with an RxJS pipeline."
ids[0]:
related[4]: docs/backlog/dbm-drizzle-migrations.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/results/POC-03-Result.md,docs/requirements/amendments-2026-11-02.md
status: current
updated: 2026-11-02
-->

# DBM Result

Branch: `minor/dbm-drizzle-migrations`, off `minor/poc-03-sqlite-vector`. Epic: [DBM](../backlog/dbm-drizzle-migrations.md). Decisions: [ADR-004](../architecture/adr/ADR-004-drizzle-build-time-migrations.md).

## Summary

- Question: can Drizzle describe the tables per engine while the final build carries only generated SQL?
- Answer: yes on macOS arm64. `drizzle-kit` runs at build time. The executable holds the SQL, a manifest and build info as SEA assets. It holds no Drizzle code.
- The supervisor applies the migrations before any service spawns. A failure ends startup with exit 1.
- The packaged smoke run passes 13 checks. An independent verification found no blockers.
- Not verified: Windows, Linux, and every platform other than darwin-arm64.

## Slices

| Slice | Commit | Evidence |
|---|---|---|
| DBM-a spike | none (scratch) | `drizzle-kit` 0.31.11 with `drizzle-orm` 0.45.4 generates offline. The SQL has `--> statement-breakpoint`. Regenerating without changes says "nothing to migrate". The SQL applies on `node:sqlite`. |
| DBM-b docs | `14ad2ff` | REQ-DB-04, REQ-DB-05 and REQ-STACK-07 amended. OQ15 closed. ADR-004 added. `docs/meta.toon` regenerated and in sync. |
| DBM-c library | `9890751` | `libs/db-migrations` builds. Its `dist` holds only `contract/`. Four bad schema variants fail `tsc`: missing column, nullable, wrong type, extra column. |
| DBM-d migrator | `f529359` | Events `checked`, `applied`, `skipped`. A second connection waits about 300 ms and applies nothing twice. An old four-column history table gains the new columns and keeps its rows. |
| DBM-e pack | `c3e3acf` | `manifest.json`, `build-info.json` and the SQL are SEA assets. Drift check exits 0 in the repo and 1 after a schema change. The smoke finds no Drizzle code. |
| DBM-g parity | `a9e8eb2` | Parity exits 0 for SQLite. Seven negative cases exit 1 with a readable diff. One of them is an engine without an introspector. |
| DBM-f boot | `81f4728` | First start applies migration 1 and writes seven `app_meta` keys. A second start reports "already applied", keeps `first_installed_runtime_version` and refreshes `last_started_at`. |

## Independent verification

One verifier read `ee02cd2..HEAD` and ran probes on a clean copy. It found 0 blockers and 5 advisories.

- `install --frozen-lockfile --offline`, drift, parity and `nx run sea-runtime:package` with the smoke passed on the clean copy.
- A tampered embedded `sha256` fails before the database is touched.
- Verdict per spec: S1 to S10 met, S9 partly. The partial mark was pending text, fixed in this unit.
- Not verified by the verifier: exit 1 after a failed migration, and a full-binary restart. The restart was verified afterwards by the parent.

| Advisory | Handling |
|---|---|
| Backlog page listed a dev path the code does not have | Fixed. The page now says dev does not run persistence. |
| Task checkboxes and ADR status pending | Fixed in this unit. |
| Historical POC-3 text said "stable first, rc fallback" | Fixed with a resolved note in the proposal. |
| `pack-migrations` counts `;` inside a string literal in a single-statement file | Open. Not reproduced. A file with markers is unaffected. |
| `drift` uses `git diff`, so it needs a git repository | Open. Accepted: CI runs in a repository. |

## Decisions without a human answer

- Slice names `DBM-a` to `DBM-h` and `app_meta` as the first table are assumptions.
- `nx g @nx/js:library` was not available because `@nx/js` is not installed. The library follows the plain pnpm layout of its siblings.
- `Migration.version` is the journal id plus 1, because the migrator requires versions from 1.
- `web_version` is `web-angular@0.0.0`, because that package has version 0.0.0. The others are 0.0.1.
- A downgrade guard based on `runtime_version` is proposed and not approved.

## Gaps

- Dev (`nest start`) does not run persistence yet.
- A `vector` column has no SQLite mapping in the parity check. The first vector table defines it.
- `drizzle-kit` 0.31.11 pulls deprecated `@esbuild-kit/*` packages. They are devDependencies only.
- PostgreSQL is not implemented. The contract, the class pattern and the introspector registry are the extension points.
