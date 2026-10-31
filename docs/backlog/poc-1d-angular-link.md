<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-1d-angular-link.md
title: "POC-1d Angular and link"
type: backlog
summary: "Backlog slice 1d of POC-1: web-angular generated with the Angular CLI and served by gateway-nest over plain HTTP."
related[3]: docs/backlog/README.md,docs/backlog/poc-1c-sea-build.md,docs/backlog/poc-1e-hardening-desktop-skeleton.md
status: current
updated: 2026-10-31
-->

# POC-1d: Angular and link

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-1c-sea-build.md) | [Up](README.md) | [Next](poc-1e-hardening-desktop-skeleton.md)

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
| Slice | 1d of 1a to 1e; umbrella [POC-1](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton) |
| Appetite | ~1 day, ASSUMPTION |
| Depends on | POC-1c |
| Branch | `minor/poc-01d-angular-link` |
| Result page | `docs/results/POC-01d-Result.md` |
| Requirements | 5 REQ ids |
| Acceptance criteria | AC-13 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton).

- Generate `apps/web-angular` and link `gateway-nest` to the Angular build.
- A dummy page is served over plain HTTP. TLS and PWA stay in POC-4.
- The dummy app works in the Angular dev server and from the SEA binary.

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

- [REQ-BUILD-03](../requirements/11-nx-quality-testing.md)
- [REQ-BUILD-05](../requirements/11-nx-quality-testing.md)

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

- [ ] Create skeleton `apps/web-angular` with `pnpm dlx @angular/cli new`. Check that it builds independently and does not import the other apps. Source: [REQ-REP-01](../requirements/03-file-structure.md), [REQ-REP-02](../requirements/03-file-structure.md), [REQ-REP-03](../requirements/03-file-structure.md), [AC-13](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Link `gateway-nest` to the Angular build: it serves a dummy page over plain HTTP (no TLS, no PWA). POC-4 owns the hardening of this serving. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [ ] Model the Nx order. First, `build` of `web-angular`, `runtime-nest` and `gateway-nest`. Then the SEA assembler `package`. The SEA `package` waits for all builds. (The `desktop` `package` step is added in POC-1e.) Source: [REQ-BUILD-03](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Record the post-`package` check. Changing Angular invalidates the SEA and the Tauri bundle. A backend-only change does not force an Angular rebuild when Nx can reuse it. (The SEA part is checked here; the Tauri bundle part is checked in POC-1e.) Source: [REQ-BUILD-05](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [ ] Write `docs/results/POC-01d-Result.md` with the dev and SEA observations, the Nx order evidence and the list of manual edits (files not produced by a CLI). Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [ ] Run and verify. Dev: run the Angular dev server (generated script, name not verified) and open its URL: expected, the dummy page renders. SEA: run the `package` target, start the binary and run `curl -i http://localhost:<port>/`: expected, `HTTP/1.1 200` with the dummy page body; `curl -i` on the health path still returns 200. Order: print the Nx graph or the target `dependsOn` (command not verified): expected, the three builds before `package`. Change one Angular file and run `package` again: expected, the SEA is rebuilt. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

None cited by the tasks of this slice.
