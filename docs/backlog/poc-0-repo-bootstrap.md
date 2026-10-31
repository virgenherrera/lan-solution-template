<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-0-repo-bootstrap.md
title: "POC-0 Repo bootstrap"
type: backlog
summary: "Backlog item for bootstrapping the repository with docs and main branch."
related[2]: docs/backlog/README.md,docs/backlog/poc-1-toolchain-workspace-skeleton.md
status: current
updated: 2026-10-30
-->

# POC-0: Repo bootstrap

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md) | [Next](poc-1-toolchain-workspace-skeleton.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Pitch items without a source id](#pitch-items-without-a-source-id)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Cycle 1 (planned) |
| Appetite | 1-2 days, small batch |
| Depends on | none |
| Branch | `chore/poc-00-repo-bootstrap` |
| Requirements | 1 REQ id |
| Acceptance criteria | none assigned |

---

## Goal

[Back to navigation](#navigation)

Pitch: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-0-repo-bootstrap).

- Put the repo on a `main` branch with the docs under `docs/`.
- Keep the docs under `docs/`. Write the result page.

| No-gos |
|---|
| No CI. |
| No code. |
| No push or `gh` without approval. |

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-0-repo-bootstrap)):

- [REQ-REP-05](../requirements/03-file-structure.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- none assigned

Pitch: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-0-repo-bootstrap). The pitch assigns no `AC-nn` ids.

Stated checks:

- `git rev-parse --verify main` exits 0.
- `git branch --list master` prints nothing.
- The docs are under `docs/`.
- [REQ-REP-05](../requirements/03-file-structure.md) requires documentation.
- NFR-DOC-01, D-05 and D-08 are listed in the [identifier glossary](../standards/identifier-glossary.md). Meanings are not verified there.

---

## Tasks

[Back to navigation](#navigation)

- [ ] T1: Start from a clean tree: `git status --short` prints nothing. Commit uncommitted docs edits first, with human approval ([AGENTS.md](../../AGENTS.md)). Create `chore/poc-00-repo-bootstrap` from `docs/split-srs` HEAD. Verify branch state. If `git branch --list master` prints a name, rename it with `git branch -m master main` (local only, no push). Check: `git rev-parse --verify main` exits 0 and `git branch --list master` prints nothing. Source: [Decision Log item 3](../roadmap/PROPOSAL.md#decision-log)
- [ ] T2: Verify the docs layout. The root SRS file stays as historical reference. Check: `test -f docs/requirements/README.md && test -f docs/roadmap/PROPOSAL.md` exits 0. Source: [Decision Log item 2](../roadmap/PROPOSAL.md#decision-log) and [AGENTS.md](../../AGENTS.md)
- [ ] T3: Write `docs/results/POC-00-Result.md` with each T1 and T2 command, its output, and pass or fail. This follows the POC-1 path convention `docs/results/POC-01-Result.md`. Check: `test -f docs/results/POC-00-Result.md` exits 0. Source: [REQ-REP-05](../requirements/03-file-structure.md)
- [ ] T4: Open the PR from the POC-0 branch to `main` only after explicit human approval. Check: the result page quotes the human approval. Source: [AGENTS.md](../../AGENTS.md)

---

## Pitch items without a source id

[Back to navigation](#navigation)

These pitch items carry no REQ or AC id. They are not tasks:

- Confirm origin `git@github.com:virgenherrera/lan-solution-template.git` ([pitch](../roadmap/PROPOSAL.md#poc-0-repo-bootstrap)). No REQ or AC id in the pitch. The pitch says it was checked with `git remote -v`: not verified here.
