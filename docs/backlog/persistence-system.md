<!-- toon-meta
fmt: TOON
doc: docs/backlog/persistence-system.md
title: "Persistence system"
type: backlog
summary: "Backlog item for a strict engine-keyed config, lazy engine loading, a barrel split and engine-keyed migration assets."
ids[0]:
related[6]: docs/backlog/README.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/roadmap/PROPOSAL.md,docs/requirements/amendments-2026-10-30.md,docs/requirements/04-configuration.md,docs/requirements/05-persistence.md
status: current
updated: 2026-11-03
-->

# Persistence system

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](dbm-schema-gate.md) | [Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [How to run in dev](#how-to-run-in-dev)
- [Slices](#slices)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Done: T1 to T6 built on `minor/persistence-system`. Merged in PR #17 |
| Depends on | DBM schema gate ([ADR-005](../architecture/adr/ADR-005-live-schema-validation.md)) |
| Decision | [ADR-007](../architecture/adr/ADR-007-persistence-system.md) |
| Requirements | [REQ-CFG-04](../requirements/04-configuration.md), [REQ-CFG-05](../requirements/04-configuration.md) (amendment approved 2026-11-03), [REQ-DB-02](../requirements/05-persistence.md), [REQ-DB-03](../requirements/05-persistence.md), [REQ-TEST-01](../requirements/11-nx-quality-testing.md) |
| Acceptance criteria | AC-07, AC-08, AC-10 (same as POC-3). No specific AC |

Slice names T1 to T7 are an assumption. Proof is by real runs of the build, the static checks and the packaged binary.

---

## Goal

[Back to navigation](#navigation)

- The config is strict: one engine or nothing. A missing or invalid config stops the start (exit 1).
- Only the selected engine is loaded at runtime.
- The handshake to the database stays ([ADR-005](../architecture/adr/ADR-005-live-schema-validation.md), DBM-n).

| No-gos |
|---|
| No PostgreSQL engine, driver or config block. The union takes it later as one more variant. |
| No auto-creation of the config by the runtime. The installer assistant is TBD. |
| No `superRefine`, `.default` or `.prefault` in the config schema. |
| No change of REQ text without the human. |
| No unit or integration suites ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)). |

---

## How to run in dev

[Back to navigation](#navigation)

The base directory in dev is `process.cwd()` ([ADR-007](../architecture/adr/ADR-007-persistence-system.md#one-base-directory)).

- Once, copy `libs/shared-core/config.example.json` to `<repo root>/config/config.json`. The runtime never creates it. In VS Code, run the task "Dev: config from example".
- A missing file stops the service.
- Start the gateway with `pnpm dev:gateway` and the web app with `pnpm dev:web`, both from the repo root. In VS Code use the launch configurations "Dev: gateway (HTTPS)" and "Dev: web (ng serve)", or the compound "Dev: gateway + web".
- Run `pnpm dev:certs` once to create `certs/`: the gateway only validates the files and stops when they are missing or invalid. `dev:web` trusts `certs/ca.crt` through `NODE_EXTRA_CA_CERTS`.
- `config/`, `certs/`, `data/` and `logs/` are git-ignored.
- An app started with another cwd, such as `pnpm --filter`, has its own base directory there.

---

## Slices

[Back to navigation](#navigation)

One branch, one PR.

| Slice | Scope | Depends on | Evidence required |
|---|---|---|---|
| T1 | Config: strict discriminated union on `engine` in `libs/shared-core/src/config.ts`. No auto-create. `config.example.json` added | none | Static checks pass. A missing file, extra keys, both blocks, an unknown engine, an empty object and `null` each throw. A valid sqlite config loads |
| T2 | Engine registry: lazy `await import()` of the selected engine. Barrel split of `shared-core` (subpath `shared-core/sqlite`) | T1 | The `shared-core` root does not export engine code. The bundle is one file. Only the selected engine is evaluated |
| T3 | Nest wiring: `APP_PATHS`, `APP_CONFIG` and the database adapter, created by `createDbAdapter` (`libs/shared-core/src/db/factory.ts`), which `PersistenceService` in `sea-runtime` and the database module in `api-gateway` inject by class | T2 | `pnpm build` passes. Both apps start with a valid config and exit non-zero without one |
| T4 | Engine-keyed migration assets under `db-migrations/<engine>/`, sqlite only: `pack-migrations --engine`, `assets.ts`, migrations source, schema check, tables list | T2 | The parity check exits 0. The packed assets list the sqlite folder only |
| T5 | Docs: ADR-007, this page, the approved amendment, the README map | none | The [Checks](../standards/README.md#checks) commands exit 0 |
| T6 | Base directory: `process.cwd()` in dev, the executable directory in a built binary. Layout `config/config.json`, `data/`, `logs/`, `certs/` under it. The package smoke writes a valid config into its scratch base directory | T1 | Services and the migration script stop without `config/config.json`. With the file copied from `config.example.json` they start. The smoke passes |
| T7 | Integration: `pnpm build`, lint and static tests per app, `pnpm package` with the smoke, independent verification (contract change) | T1 to T6 | `pnpm package` exits 0. The verifier reports no blocker |

Design rules:

- The config schema alone decides the engine. Domain consumers depend on ports ([REQ-DB-02](../requirements/05-persistence.md)).
- The `import()` argument is a literal or a ternary of literals.
- Generate every project file with its official CLI through `pnpm dlx` or `nx`. List hand edits in the slice result.

---

## Open questions

[Back to navigation](#navigation)

| Topic | Status |
|---|---|
| One base directory and the dev config: [OQ23](../roadmap/PROPOSAL.md#open-questions) | decided (human), 2026-11-03 |
| Where the installer assistant defines the install path and creates `config/config.json`: [OQ24](../roadmap/PROPOSAL.md#open-questions) | open, TBD with the installer (POC-8) |
| Remove the shipped `config.default.json` ([REQ-CFG-05](../requirements/04-configuration.md)): [OQ25](../roadmap/PROPOSAL.md#open-questions) | decided (human), amendment approved 2026-11-03 |
| PostgreSQL variant of the config union | TBD, belongs to POC-6 |
| ADR-007 measurements on other Node and rspack versions and on Windows | not verified |
