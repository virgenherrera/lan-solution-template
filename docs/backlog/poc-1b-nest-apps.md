<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-1b-nest-apps.md
title: "POC-1b Nest apps"
type: backlog
summary: "Backlog slice 1b of POC-1: api-gateway and sea-runtime generated with the Nest CLI, plus shared-core."
related[3]: docs/backlog/README.md,docs/backlog/poc-1a-monorepo-init.md,docs/backlog/poc-1c-sea-build.md
status: current
updated: 2026-10-31
-->

# POC-1b: Nest apps

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-1a-monorepo-init.md) | [Up](README.md) | [Next](poc-1c-sea-build.md)

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
| Slice | 1b of 1a to 1e; umbrella [POC-1](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton) |
| Appetite | ~1 day, ASSUMPTION |
| Depends on | POC-1a |
| Branch | `minor/poc-01b-nest` |
| Result page | `docs/results/POC-01b-Result.md` |
| Requirements | 3 REQ ids |
| Acceptance criteria | AC-13 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton).

- Generate `apps/api-gateway`, `apps/sea-runtime` and `libs/shared-core`.
- Both Nest apps run in dev and build independently; they do not import each other.
- `api-gateway` serves a dummy health endpoint. The server uses NodeAdapter, not Express or Fastify (see [requirements](../requirements/02-technology-baseline.md)).

Generation rule: every project file is produced by its official CLI through `pnpm dlx` (`nx`, `@nestjs/cli`, `@angular/cli`, `@tauri-apps/cli`), never hand-written. A manual edit is allowed only where no CLI exists, and the result page lists it. If a CLI is unknown, run `--help` first (flags and generated target names in this page are not verified).

| No-gos |
|---|
| No Nx Cloud. |
| No drizzle-kit. |
| No `bumpDependencies` or `test:doctor`. |
| No unit or integration suites. |
| No `^` or `~` ranges. |

---

## Requirements

[Back to navigation](#navigation)

Subset of the POC-1 lists. Each id appears here because a task of this slice cites it.

Cited elsewhere in the pitch:

- [REQ-REP-01](../requirements/03-file-structure.md)
- [REQ-REP-02](../requirements/03-file-structure.md)
- [REQ-REP-03](../requirements/03-file-structure.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-13](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton). The pitch also lists NFR-01..15 (not defined in `docs/requirements`, so not linked).

---

## Tasks

[Back to navigation](#navigation)

- [x] Create skeletons `apps/api-gateway`, `apps/sea-runtime` (both with `pnpm dlx @nestjs/cli new`) and `libs/shared-core`. Add a dummy health endpoint on `api-gateway`. Check that they run in dev, build independently and do not import each other. Source: [REQ-REP-01](../requirements/03-file-structure.md), [REQ-REP-02](../requirements/03-file-structure.md), [REQ-REP-03](../requirements/03-file-structure.md), [AC-13](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [x] Write `docs/results/POC-01b-Result.md` with the generation commands, the observed dev and build results and the list of manual edits (files not produced by a CLI). Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [x] Run and verify. Run each Nest app in dev with its generated start script (script name not verified). Run `curl -i http://localhost:<port>/<health path>` against `api-gateway`: expected, `HTTP/1.1 200`. Run `pnpm nx build api-gateway` and `pnpm nx build sea-runtime` (target names not verified): both exit 0 on their own. Run `rg -n "api-gateway|sea-runtime" apps/api-gateway/src apps/sea-runtime/src libs`: expected, no import of one app by the other. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

None cited by the tasks of this slice.
