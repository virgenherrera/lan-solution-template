<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-9-ci-cd-releases.md
title: "POC-9 GitHub Actions CI/CD and releases (HOLD)"
type: backlog
summary: "Backlog item for GitHub Actions CI/CD and releases, on hold."
related[2]: docs/backlog/README.md,docs/backlog/poc-8-msi-matrix-versioning.md
status: current
updated: 2026-10-30
-->

# POC-9: GitHub Actions CI/CD and releases (HOLD)

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-8-msi-matrix-versioning.md) | [Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Pitch items without a source id](#pitch-items-without-a-source-id)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | On hold (decision 9) |
| Appetite | 2 weeks, big batch |
| Depends on | POC-8 |
| Branch | `chore/poc-09-ci-cd` |
| Requirements | 16 REQ ids |
| Acceptance criteria | AC-26, AC-27, AC-35, AC-36, AC-02, AC-32 |

---

## Goal

[Back to navigation](#navigation)

Status: HOLD (decision 9). Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold).

CI/CD in scope only after the local commands are stable. The release flow works with branch protection. It allows no amend and no force-push. It serializes releases. It makes reruns idempotent. Appetite: 2 weeks, big batch. Branch: HOLD `chore/poc-09-ci-cd`. The HOLD covers only CI/CD and releases. They are the release workflow, tags, binary publish and release bot. This is a human decision (OQ6). The human can change it. Local work, branches and commits continue. Every push, PR and `gh` action needs explicit human approval.

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold)):

- [REQ-CI-01](../requirements/11-nx-quality-testing.md)
- [REQ-CI-02](../requirements/11-nx-quality-testing.md)
- [REQ-CI-03](../requirements/11-nx-quality-testing.md)
- [REQ-CI-04](../requirements/11-nx-quality-testing.md)
- [REQ-CI-05](../requirements/11-nx-quality-testing.md)
- [REQ-CI-06](../requirements/11-nx-quality-testing.md)
- [REQ-CI-07](../requirements/11-nx-quality-testing.md)
- [REQ-CI-08](../requirements/11-nx-quality-testing.md)
- [REQ-CI-09](../requirements/11-nx-quality-testing.md)
- [REQ-CI-10](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-CI-01](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-CI-02](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-CI-03](../requirements/11-nx-quality-testing.md)
- [REQ-SEC-CI-04](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-ECO-07](../requirements/11-nx-quality-testing.md)
- [REQ-DEPS-02](../requirements/11-nx-quality-testing.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-26](../requirements/11-nx-quality-testing.md)
- [AC-27](../requirements/11-nx-quality-testing.md)
- [AC-35](../requirements/11-nx-quality-testing.md)
- [AC-36](../requirements/11-nx-quality-testing.md)
- [AC-02](../requirements/11-nx-quality-testing.md)
- [AC-32](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold).

---

## Tasks

[Back to navigation](#navigation)

- [ ] `ci-cd.yml` calls only root scripts. Source: [REQ-CI-07](../requirements/11-nx-quality-testing.md), [REQ-ECO-07](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] PR CI on native Windows, Linux and macOS runners: install, securityCheck, build, test, package, smoke. `securityCheck` fails before the first build. Source: [REQ-CI-01](../requirements/11-nx-quality-testing.md), [REQ-CI-09](../requirements/11-nx-quality-testing.md), [AC-26](../requirements/11-nx-quality-testing.md), [AC-35](../requirements/11-nx-quality-testing.md), [AC-02](../requirements/11-nx-quality-testing.md), [AC-32](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] CD starts from a versioned SHA and creates a new release commit or release PR. It never amends. Bot commit vs release PR: proposed in [OQ9](../roadmap/PROPOSAL.md#open-questions). Source: [REQ-CI-04](../requirements/11-nx-quality-testing.md), [AC-26](../requirements/11-nx-quality-testing.md), [AC-36](../requirements/11-nx-quality-testing.md), [OQ9](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] Tag `vX.Y.Z` and publish SHA-256 hashed installers with OS/arch names. The smoke test runs before upload. Source: [REQ-CI-05](../requirements/11-nx-quality-testing.md), [REQ-CI-10](../requirements/11-nx-quality-testing.md), [AC-27](../requirements/11-nx-quality-testing.md), [AC-36](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] Serialize releases per target branch; make reruns idempotent. Source: [REQ-CI-06](../requirements/11-nx-quality-testing.md), [AC-27](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] Minimal permissions; `contents:write` only for release jobs. Source: [REQ-CI-03](../requirements/11-nx-quality-testing.md), [REQ-SEC-CI-04](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] If a mandatory platform cannot run, the release is blocked, not green. Ship PR CI only and publish findings. Source: [REQ-CI-02](../requirements/11-nx-quality-testing.md), [REQ-CI-06](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] Rust audit tooling in CI (tool and threshold proposed in [OQ13](../roadmap/PROPOSAL.md#open-questions)); no `continue-on-error` on audit. Source: [REQ-SEC-CI-02](../requirements/11-nx-quality-testing.md), [AC-32](../requirements/11-nx-quality-testing.md), [OQ13](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))
- [ ] Publish `POC-09-Result` and `ADR-007` (release flow) under `docs/`. Source: [AC-26](../requirements/11-nx-quality-testing.md), [AC-27](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold))

Ids with no pitch task (none invented): [REQ-CI-08](../requirements/11-nx-quality-testing.md), [REQ-SEC-CI-01](../requirements/11-nx-quality-testing.md), [REQ-SEC-CI-03](../requirements/11-nx-quality-testing.md).

---

## Pitch items without a source id

[Back to navigation](#navigation)

Pitch items with no REQ or AC id. Not tasks:

- Sign only if credentials exist; never declare an unsigned artifact signed (R-08, [pitch](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold)).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

- [OQ6](../roadmap/PROPOSAL.md#open-questions): scope of POC-9 HOLD. Status: decided (human).
- [OQ9](../roadmap/PROPOSAL.md#open-questions): bot commit vs release PR. Status: proposed.
- [OQ13](../roadmap/PROPOSAL.md#open-questions): Rust audit tool. Status: proposed.
