<!-- toon-meta
fmt: TOON
doc: docs/results/POC-03-Result.md
title: "POC-03 Result"
type: backlog
summary: "Result of POC-3: paths library, Zod config singleton, DbAdapter strategy port, SQLite with sqlite-vector as a SEA asset, custom migrator and startup order."
ids[0]:
related[3]: docs/backlog/poc-3-config-sqlite-vector.md,docs/architecture/adr/ADR-003-config-and-db-strategy.md,docs/results/POC-02-Result.md
status: current
updated: 2026-11-02
-->

# POC-03 Result

Branch: `minor/poc-03-sqlite-vector`. Epic: [POC-3](../backlog/poc-3-config-sqlite-vector.md). Decisions: [ADR-003](../architecture/adr/ADR-003-config-and-db-strategy.md).

## Summary

- Question: do config and persistence work from inside the SEA, behind a port that a second engine can join?
- Answer: yes on macOS arm64. The packaged binary resolves a root, creates and validates `config.json`, opens SQLite, loads `sqlite-vector` from a SEA asset, runs the migrator and only then spawns services. The packaged smoke passes 11 checks.
- Not verified: Windows, Linux, and every platform other than darwin-arm64. The pins for six more platforms exist but no binary was loaded there.
- Not done: the Drizzle tag check. POC-3 uses `node:sqlite` directly. See [ADR-003](../architecture/adr/ADR-003-config-and-db-strategy.md) and [OQ15](../roadmap/PROPOSAL.md#open-questions).

## Slices

| Slice | Commit | Evidence |
|---|---|---|
| 3a paths | `a23ff84` | 15 asserts on a built library, run from two different cwd: flag, `--root=`, `APP_HOME`, marker, dev anchor, OS default, missing `--root` value. |
| 3b config | `ef887a5` | First start writes `config.json` from schema defaults or copies `config.default.json`. An existing file is kept. Invalid JSON and invalid values throw. The singleton is frozen and initializes once. |
| 3c port and SQLite | `cc55c26` | Real database: `foreign_keys` is 1, `journal_mode` is `wal`, `synchronous` is 2 (FULL). A foreign key violation is rejected. A failed transaction rolls back. Vector calls without a backend throw `VectorUnavailableError`. |
| 3e migrator | `be37fc9` | Initial migration applies, a second run applies nothing, a new pending one applies alone, an altered checksum throws and leaves data unchanged, a failing migration leaves no history row, two connections apply version 4 once. |
| 3d vector | `cac6efe` | Real `sqlite-vector` 1.1.2: `search [1,0,0]` returns ids 1, 3, 2 with distances 0, 0.0061, 1. A wrong sha256 throws `VectorUnavailableError`. Extracted file mode is 600, directory 700. |
| 3f startup | `a9b3fbf` | Packaged run logs `database sqlite ready, vector ok, migrations applied: 0` before `spawned service`. An invalid `config.json` exits 1 before any service spawns and leaves 0 processes. |

## Independent verification of 3d

One independent verifier read the commit and ran probes in a scratch directory. It found 0 blockers and 5 advisories.

- The binary hash is checked against the `pin.json` embedded in the same SEA, not against the versioned table at run time. Whoever can edit the SEA assets can also edit the code, so the trust root is the executable itself. Accepted.
- A stale `vector.dylib.<pid>.tmp` file makes the next start fail with `VectorUnavailableError` (denial of service, not a bypass).
- The parent directory of the extraction folder is not checked for symlinks.
- A time-of-check to time-of-use window exists between the hash check and `loadExtension`.
- `compile-sea.ts` was read, not exercised with a tampered tarball.

## Decisions taken without a human answer

- Marker file name `lan-root.marker` and the OS default roots are assumptions. The SRS does not fix them.
- `sqlite-vector` 1.1.2 is read from the SRS ([REQ-STACK-09](../requirements/02-technology-baseline.md)). The human wrote "sqliteVec"; this is read as a typo.
- Pragmas: `foreign_keys` on, WAL, `synchronous` FULL. All are Zod defaults, so the config file can change them ([REQ-DB-07](../requirements/05-persistence.md)).
- The migration list is empty. The history table exists after the first start. The first schema comes with the first feature that needs a table.

## Gaps

- `config.default.json` is not shipped in the SEA. The first start falls back to the schema defaults.
- The migrator splits SQL on `;`. It does not support `;` inside literals or triggers.
- The busy retry in the migrator matches the text `locked` or `busy`. Another engine needs its own rule.
- Persistence is booted inside the supervisor only. The gateway child does not use it yet.
- `win32-arm64` has no upstream binary. musl pins exist but `compile-sea` maps only gnu triples.
- No pgvector adapter. The port and the `db.engine` enum are the extension points.
