<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-1e-hardening-desktop-skeleton.md
title: "POC-1e Hardening and desktop skeleton"
type: backlog
summary: "Backlog slice 1e of POC-1: Tauri desktop skeleton, security gate, test filter, OS matrix and consolidated result page."
related[3]: docs/backlog/README.md,docs/backlog/poc-1d-angular-link.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md
status: current
updated: 2026-10-31
-->

# POC-1e: Hardening and desktop skeleton

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-1d-angular-link.md) | [Up](README.md) | [Next](poc-2-single-sea-runtime-supervisor.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Inherited from 1d and the pnpm policy](#inherited-from-1d-and-the-pnpm-policy)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Cycle 1 (planned) |
| Slice | 1e of 1a to 1e; umbrella [POC-1](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton) |
| Appetite | ~1 day, ASSUMPTION |
| Depends on | POC-1d |
| Branch | `minor/poc-01e-hardening` |
| Result page | `docs/results/POC-01-Result.md` |
| Requirements | 13 REQ ids |
| Acceptance criteria | AC-01, AC-02, AC-13, AC-19, AC-22, AC-32, AC-33, AC-34 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton).

- Generate the `apps/desktop` skeleton with the Tauri CLI.
- Make the root sequence and the security gate fail closed.
- Record the OS matrix and publish the consolidated POC-1 result.

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

- [REQ-BUILD-02](../requirements/11-nx-quality-testing.md)
- [REQ-TEST-02](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-STACK-01](../requirements/02-technology-baseline.md)
- [REQ-SEC-CI-01](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-CI-02](../requirements/11-nx-quality-testing.md)
- [REQ-REP-01](../requirements/03-file-structure.md)
- [REQ-REP-02](../requirements/03-file-structure.md)
- [REQ-REP-03](../requirements/03-file-structure.md)
- [REQ-REP-05](../requirements/03-file-structure.md)
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
- [AC-32](../requirements/11-nx-quality-testing.md)
- [AC-33](../requirements/11-nx-quality-testing.md)
- [AC-34](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton). The pitch also lists NFR-01..15 (not defined in `docs/requirements`, so not linked). [AC-33](../requirements/11-nx-quality-testing.md) (host OS only). [AC-02](../requirements/11-nx-quality-testing.md) (host-checkable part).

---

## Tasks

[Back to navigation](#navigation)

- [ ] Create skeleton `apps/desktop` with `pnpm dlx @tauri-apps/cli init`. Check that it builds independently and does not import the other apps. Source: [REQ-REP-01](../requirements/03-file-structure.md), [REQ-REP-02](../requirements/03-file-structure.md), [REQ-REP-03](../requirements/03-file-structure.md), [AC-13](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Make `securityCheck` fail closed (high/critical advisories or registry failure). Source: [REQ-SEC-CI-01](../requirements/11-nx-quality-testing.md), [REQ-SEC-CI-02](../requirements/11-nx-quality-testing.md), [AC-02](../requirements/11-nx-quality-testing.md), [AC-32](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Add a test filter adapter stub; `pnpm test -- --filter @int` filters without altering the Nx graph. Source: [REQ-TEST-03](../requirements/11-nx-quality-testing.md), [REQ-ECO-04](../requirements/11-nx-quality-testing.md), [AC-19](../requirements/11-nx-quality-testing.md), [AC-34](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Verify the OS matrix on the host OS. Targets follow Tauri 2: [OQ4](../roadmap/PROPOSAL.md#open-questions), decision 15. (The Node pin LTS record is made in POC-1a.) Source: [REQ-STACK-01](../requirements/02-technology-baseline.md), [AC-33](../requirements/11-nx-quality-testing.md), [OQ4](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Verify the supported operating systems of Tauri 2 against the primary Tauri documentation. Read the Tauri 2 prerequisites page and the WebView2 minimums. Record the supported OS list in the POC-1 result and declare it in the OS matrix. We keep no OS list of our own. The unverified overview is in decision 15. Give each the label `verified` or `not verified` according to the host. The human's source is a search summary, so the claim stays `not verified` until this check. Source: [AC-33](../requirements/11-nx-quality-testing.md), [decision 15](../roadmap/PROPOSAL.md#decision-log), [OQ4](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Model the root sequence `install → securityCheck → build → test → package` in Nx. `test` aggregates `test:static` then `test:dynamic` per package. It runs no `package`. No aliases such as `build:sea`, `test:ut` or `pipeline:prebuild`. Add the `desktop` `package` step after the SEA `package` (order from POC-1d). Source: [REQ-BUILD-02](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Keep `@ut`, `@int` and `@app` as optional selection tags only. No tag changes the runner, the bootstrap or the environment. No unit or integration suite is added. Source: [REQ-TEST-02](../requirements/11-nx-quality-testing.md), [AC-22](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Write `docs/results/POC-01-Result.md` with the version table and OS/Node matrix (consolidating the POC-1a to POC-1d result pages and their manual-edit lists); add `ADR-001` if a substitution happens. Source: [AC-01](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Run and verify. Run `pnpm install --frozen-lockfile && pnpm securityCheck && pnpm build && pnpm test && pnpm package` from the root: expected, exit 0 and the steps run in that order. Run `pnpm securityCheck` with the registry unreachable (offline): expected, non-zero exit. Run `pnpm test -- --filter @int`: expected, exit 0 and the Nx graph is unchanged (compare the graph before and after). Expected in the result page: the Tauri 2 OS list, each entry labelled `verified` or `not verified`. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).

Ids with no pitch task (none invented): [REQ-REP-05](../requirements/03-file-structure.md), [REQ-ECO-05](../requirements/11-nx-quality-testing.md), [REQ-DEPS-01](../requirements/11-nx-quality-testing.md). They stay with the last slice because no task of the old single POC-1 epic cites them.

---

## Inherited from 1d and the pnpm policy

[Back to navigation](#navigation)

Sources: [POC-1d result](../results/POC-01d-Result.md), commit `124ebc6`.

- `pnpm audit --audit-level=high` reports 43 vulnerabilities (14 high) in the current tree. Observed. `securityCheck` must decide fail-closed handling and `ignoreCves`.
- The pnpm trust policy in `pnpm-workspace.yaml` (commit `124ebc6`) declares `allowBuilds: true` for `@parcel/watcher`, `esbuild`, `lmdb`, `msgpackr-extract` and `nx`. It declares `allowBuilds: false` for `@nestjs/core`. `minimumReleaseAgeExclude` and `auditConfig.ignoreCves` are empty.
- Type-check gap: the rspack builder does no type check, and the build has no `tsc --noEmit` step. Decide whether to add one.

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

| OQ | Topic | Status |
|---|---|---|
| [OQ4](../roadmap/PROPOSAL.md#open-questions) | OS targets follow Tauri 2 | decided (human decision 15) |
