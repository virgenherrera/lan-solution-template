<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-1-toolchain-workspace-skeleton.md
title: "POC-1 Toolchain viability and workspace skeleton"
type: backlog
summary: "Backlog item for toolchain viability and the workspace skeleton."
related[3]: docs/backlog/README.md,docs/backlog/poc-0-repo-bootstrap.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md
status: current
updated: 2026-10-30
-->

# POC-1: Toolchain viability and workspace skeleton

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-0-repo-bootstrap.md) | [Up](README.md) | [Next](poc-2-single-sea-runtime-supervisor.md)

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
| Appetite | 1 week, small batch |
| Depends on | POC-0 (not blocking) |
| Branch | `chore/poc-01-toolchain` |
| Requirements | 21 REQ ids |
| Acceptance criteria | AC-01, AC-02, AC-13, AC-19, AC-22, AC-23, AC-24, AC-32, AC-33, AC-34 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton).

- Verify that the pinned toolchain versions exist and work together.
- Create the pnpm/Nx workspace skeleton.

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

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)):

- [REQ-ECO-01](../requirements/11-nx-quality-testing.md)
- [REQ-ECO-02](../requirements/11-nx-quality-testing.md)
- [REQ-BUILD-02](../requirements/11-nx-quality-testing.md)
- [REQ-BUILD-03](../requirements/11-nx-quality-testing.md)
- [REQ-BUILD-04](../requirements/11-nx-quality-testing.md)
- [REQ-BUILD-05](../requirements/11-nx-quality-testing.md)
- [REQ-TEST-02](../requirements/11-nx-quality-testing.md)
- [REQ-REF-01](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-STACK-01](../requirements/02-technology-baseline.md)
- [REQ-SUPPLY-01](../requirements/02-technology-baseline.md)
- [REQ-SEC-CI-01](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-CI-02](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-CI-03](../requirements/11-nx-quality-testing.md)
- [REQ-BUILD-01](../requirements/11-nx-quality-testing.md)
- [REQ-REP-01](../requirements/03-file-structure.md)
- [REQ-REP-02](../requirements/03-file-structure.md)
- [REQ-REP-03](../requirements/03-file-structure.md)
- [REQ-TEST-03](../requirements/11-nx-quality-testing.md)
- [REQ-ECO-04](../requirements/11-nx-quality-testing.md)
- [REQ-ECO-05](../requirements/11-nx-quality-testing.md)
- [REQ-DEPS-01](../requirements/11-nx-quality-testing.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-01](../requirements/11-nx-quality-testing.md)
- [AC-02](../requirements/11-nx-quality-testing.md)
- [AC-13](../requirements/11-nx-quality-testing.md)
- [AC-19](../requirements/11-nx-quality-testing.md)
- [AC-22](../requirements/11-nx-quality-testing.md)
- [AC-23](../requirements/11-nx-quality-testing.md)
- [AC-24](../requirements/11-nx-quality-testing.md)
- [AC-32](../requirements/11-nx-quality-testing.md)
- [AC-33](../requirements/11-nx-quality-testing.md)
- [AC-34](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton). [AC-02](../requirements/11-nx-quality-testing.md) (host-checkable part) and [AC-33](../requirements/11-nx-quality-testing.md) (host OS only). The pitch also lists NFR-01..15 (not defined in `docs/requirements`, so not linked).

---

## Tasks

[Back to navigation](#navigation)

- [ ] Verify that every pinned version exists and works with the others. Record the version-verification table (NFR-15, NFR-VER-01 (identifier glossary, meaning not verified; see [glossary](../standards/identifier-glossary.md))). Source: [AC-01](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Create a pnpm workspace with a catalog: empty `savePrefix`, exact versions, committed `pnpm-lock.yaml`. Pin Nx after discovery. Source: [AC-01](../requirements/11-nx-quality-testing.md), [AC-24](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Set `minimumReleaseAge` 1440, `allowBuilds` and `strictDepBuilds` true; verify the pnpm 12 semantics. Source: [REQ-SUPPLY-01](../requirements/02-technology-baseline.md), [REQ-SEC-CI-03](../requirements/11-nx-quality-testing.md), [AC-24](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Use Nx locally, no Nx Cloud. Source: [REQ-BUILD-01](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Create skeletons `apps/web-angular`, `apps/gateway-nest`, `apps/runtime-nest`, `apps/desktop`, `libs/shared-core`. Check that they build independently and do not import each other. Source: [REQ-REP-01](../requirements/03-file-structure.md), [REQ-REP-02](../requirements/03-file-structure.md), [REQ-REP-03](../requirements/03-file-structure.md), [AC-13](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Add root ECO scripts (`build`, `test`, `package`) with explicit no-ops. Source: [REQ-ECO-01](../requirements/11-nx-quality-testing.md), [REQ-ECO-02](../requirements/11-nx-quality-testing.md), [AC-23](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Make `securityCheck` fail closed (high/critical advisories or registry failure). Source: [REQ-SEC-CI-01](../requirements/11-nx-quality-testing.md), [REQ-SEC-CI-02](../requirements/11-nx-quality-testing.md), [AC-02](../requirements/11-nx-quality-testing.md), [AC-32](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Add a test filter adapter stub; `pnpm test -- --filter @int` filters without altering the Nx graph. Source: [REQ-TEST-03](../requirements/11-nx-quality-testing.md), [REQ-ECO-04](../requirements/11-nx-quality-testing.md), [AC-19](../requirements/11-nx-quality-testing.md), [AC-34](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Verify the OS matrix on the host OS. Record whether the Node pin `>=26.13.0 <27` is an LTS line (proposed: [OQ3](../roadmap/PROPOSAL.md#open-questions)). Decision 4 says Node follows the pin. Targets follow Tauri 2: [OQ4](../roadmap/PROPOSAL.md#open-questions), decision 15. Source: [REQ-STACK-01](../requirements/02-technology-baseline.md), [AC-33](../requirements/11-nx-quality-testing.md), [OQ3](../roadmap/PROPOSAL.md#open-questions), [OQ4](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Verify the supported operating systems of Tauri 2 against the primary Tauri documentation. Read the Tauri 2 prerequisites page and the WebView2 minimums. Record the supported OS list in the POC-1 result and declare it in the OS matrix. We keep no OS list of our own. The unverified overview is in decision 15. Give each the label `verified` or `not verified` according to the host. The human's source is a search summary, so the claim stays `not verified` until this check. Source: [decision 15](../roadmap/PROPOSAL.md#decision-log), [OQ4](../roadmap/PROPOSAL.md#open-questions), [AC-33](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Model the root sequence `install → securityCheck → build → test → package` in Nx. `test` aggregates `test:static` then `test:dynamic` per package. It runs no `package`. No aliases such as `build:sea`, `test:ut` or `pipeline:prebuild`. Source: [REQ-BUILD-02](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Model the Nx order. First, `build` of `web-angular`, `runtime-nest` and `gateway-nest`. Then the SEA assembler `package`. Then the `desktop` `package`. The SEA `package` waits for all builds. Source: [REQ-BUILD-03](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Declare the assembler `package` target. It invokes `tools/scripts/compile-sea.ts`. The target is invalidated when a registered service changes. The script itself is written in POC-2. Source: [REQ-BUILD-04](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Record the post-`package` check. Changing Angular invalidates the SEA and the Tauri bundle. A backend-only change does not force an Angular rebuild when Nx can reuse it. Source: [REQ-BUILD-05](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Keep `@ut`, `@int` and `@app` as optional selection tags only. No tag changes the runner, the bootstrap or the environment. No unit or integration suite is added. Source: [REQ-TEST-02](../requirements/11-nx-quality-testing.md), [AC-22](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Study the six reference points of `nest-base` and `fullstack-base` before generating architecture or scripts. Reference them without porting `test:unit` nor integration suites. Source: [REQ-REF-01](../requirements/11-nx-quality-testing.md), [AC-22](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Write `docs/results/POC-01-Result.md` with the version table and OS/Node matrix; add `ADR-001` if a substitution happens. Source: [AC-01](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

| OQ | Topic | Status |
|---|---|---|
| [OQ3](../roadmap/PROPOSAL.md#open-questions) | Node line vs pin | proposed |
| [OQ4](../roadmap/PROPOSAL.md#open-questions) | OS targets follow Tauri 2 | decided (human decision 15) |
