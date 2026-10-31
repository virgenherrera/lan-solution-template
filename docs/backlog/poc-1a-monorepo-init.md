<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-1a-monorepo-init.md
title: "POC-1a Monorepo init"
type: backlog
summary: "Backlog slice 1a of POC-1: pinned versions, pnpm workspace, Nx local, root scripts and the Node engine pin."
related[2]: docs/backlog/README.md,docs/backlog/poc-1b-nest-apps.md
status: current
updated: 2026-10-31
-->

# POC-1a: Monorepo init

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](README.md) | [Up](README.md) | [Next](poc-1b-nest-apps.md)

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
| Slice | 1a of 1a to 1e; umbrella [POC-1](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton) |
| Appetite | ~1 day, ASSUMPTION |
| Depends on | none |
| Branch | `minor/poc-01a-monorepo` |
| Result page | `docs/results/POC-01a-Result.md` |
| Requirements | 7 REQ ids |
| Acceptance criteria | AC-01, AC-22, AC-23, AC-24 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton).

- Verify that the pinned toolchain versions exist and work together.
- Create the pnpm/Nx workspace root with root no-op scripts.
- Pin one Node engine for the whole repository.

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

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)):

- [REQ-ECO-01](../requirements/11-nx-quality-testing.md)
- [REQ-ECO-02](../requirements/11-nx-quality-testing.md)
- [REQ-REF-01](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-STACK-01](../requirements/02-technology-baseline.md)
- [REQ-SUPPLY-01](../requirements/02-technology-baseline.md)
- [REQ-SEC-CI-03](../requirements/11-nx-quality-testing.md)
- [REQ-BUILD-01](../requirements/11-nx-quality-testing.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-01](../requirements/11-nx-quality-testing.md)
- [AC-22](../requirements/11-nx-quality-testing.md)
- [AC-23](../requirements/11-nx-quality-testing.md)
- [AC-24](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton). The pitch also lists NFR-01..15 (not defined in `docs/requirements`, so not linked).

---

## Tasks

[Back to navigation](#navigation)

- [ ] Verify that every pinned version exists and works with the others. Record the version-verification table (NFR-15, NFR-VER-01 (identifier glossary, meaning not verified; see [glossary](../standards/identifier-glossary.md))). Source: [AC-01](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Create a pnpm workspace with a catalog: empty `savePrefix`, exact versions, committed `pnpm-lock.yaml`. Pin Nx after discovery. Source: [AC-01](../requirements/11-nx-quality-testing.md), [AC-24](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Set `minimumReleaseAge` 1440, `allowBuilds` and `strictDepBuilds` true; verify the pnpm 12 semantics. Source: [REQ-SUPPLY-01](../requirements/02-technology-baseline.md), [REQ-SEC-CI-03](../requirements/11-nx-quality-testing.md), [AC-24](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Use Nx locally, no Nx Cloud. Source: [REQ-BUILD-01](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Add root ECO scripts (`build`, `test`, `package`) with explicit no-ops. Source: [REQ-ECO-01](../requirements/11-nx-quality-testing.md), [REQ-ECO-02](../requirements/11-nx-quality-testing.md), [AC-23](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Set one single `engines.node` pin for the whole repository (one Node version builds and runs every app). Reconcile it with the SRS pin `>=26.13.0 <27`. Record whether that pin is an LTS line (proposed: [OQ3](../roadmap/PROPOSAL.md#open-questions)). Decision 4 says Node follows the pin. Source: [REQ-STACK-01](../requirements/02-technology-baseline.md), [OQ3](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Study the six reference points of `nest-base` and `fullstack-base` before generating architecture or scripts. Reference them without porting `test:unit` nor integration suites. Source: [REQ-REF-01](../requirements/11-nx-quality-testing.md), [AC-22](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Write `docs/results/POC-01a-Result.md` with the version-verification table, the Node pin LTS record and the list of manual edits (files not produced by a CLI). POC-1e consolidates it into `docs/results/POC-01-Result.md`. Source: [AC-01](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Run and verify. From the repository root run `pnpm install --frozen-lockfile`, then `pnpm build`, `pnpm test` and `pnpm package`. Expected: every command exits 0 and each root script prints its explicit no-op message. Run `node --version`: expected, a version inside the `engines.node` range. Run `pnpm exec nx --version`: expected, an exact version equal to the one in the catalog. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

| OQ | Topic | Status |
|---|---|---|
| [OQ3](../roadmap/PROPOSAL.md#open-questions) | Node line vs pin | proposed |
