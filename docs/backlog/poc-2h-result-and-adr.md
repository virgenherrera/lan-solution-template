<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2h-result-and-adr.md
title: "POC-2h POC-02 result and ADR-002"
type: backlog
summary: "Backlog slice 2h of POC-2: consolidated POC-02 result, ADR-002 and the closing of inherited items."
related[3]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2g-real-binary-smoke.md,docs/backlog/poc-3-config-sqlite-vector.md
status: current
updated: 2026-10-31
-->

# POC-2h: POC-02 result and ADR-002

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2g-real-binary-smoke.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-3-config-sqlite-vector.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Files and how they are written](#files-and-how-they-are-written)
- [Risks](#risks)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Done in the commit that adds the result page and ADR-002, see [result](../results/POC-02-Result.md) and [ADR-002](../architecture/adr/ADR-002-single-sea-portability.md) |
| Slice | 2h of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~200 authored lines, documentation only (ASSUMPTION) |
| Depends on | [2a](poc-2a-launcher-cwd-spike.md) to [2g](poc-2g-real-binary-smoke.md) |
| Branch (decided, D1) | `minor/poc-02-supervisor`, one commit or commit group per slice, one draft PR for all of POC-2 |
| Result page | `docs/results/POC-02-Result.md` |
| Decision record | `docs/architecture/adr/ADR-002-single-sea-portability.md`  |
| Acceptance criteria | AC-11, AC-29 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch deliverable](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor).

- Consolidate the slice result pages into `POC-02-Result`, in the shape of [POC-01-Result](../results/POC-01-Result.md): version table, OS matrix, manual edits by slice, deviations, open items.
- Write `ADR-002`, the single-SEA portability decision.
- Close the inherited items of the [umbrella](poc-2-single-sea-runtime-supervisor.md#inherited-from-poc-1): each gets a final status and, where open, the next owner.

---

## Requirements

[Back to navigation](#navigation)

- [REQ-REP-05](../requirements/03-file-structure.md): contracts, commands, security boundaries and per-platform compilation are documented. This page set is the documentation.
- [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md), [REQ-SEA-01](../requirements/10-node-sea-distribution.md): the single-SEA claim ADR-002 records.

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-11](../requirements/11-nx-quality-testing.md): the result cites the 2c and 2g evidence.
- [AC-29](../requirements/11-nx-quality-testing.md): the result cites the 2b, 2e and 2g evidence.

Observable:

- `POC-02-Result` lists every slice with its commit range, and the commands with exit codes.
- Each inherited item of the umbrella has a status in the result.
- The OS matrix labels each OS and architecture `verified`, `verified in Docker` or `not verified`. Windows reads `blocked-by-environment` ([REQ-TEST-09](../requirements/11-nx-quality-testing.md)).
- The measured OQ11 values replace the proposals in the result, and [OQ11](../roadmap/PROPOSAL.md#open-questions) is updated to match (only with the human's approval).
- `toon -d docs/meta.toon` and the metadata check exit 0.

---

## Tasks

[Back to navigation](#navigation)

- [x] Write `docs/results/POC-02-Result.md` from the slice pages 2a to 2g. Source: [REQ-REP-05](../requirements/03-file-structure.md), [AC-11](../requirements/11-nx-quality-testing.md), [AC-29](../requirements/11-nx-quality-testing.md).
- [x] Write `ADR-002`: one binary per platform, re-entry by role, no postject, the code-cache rule, and the limits found. Add it to the ADR index in the roadmap proposal. Source: [REQ-SEA-01](../requirements/10-node-sea-distribution.md), [REQ-SEA-02](../requirements/10-node-sea-distribution.md), [AC-11](../requirements/11-nx-quality-testing.md).
- [x] Review the requirement text (result: [Requirement text review](../results/POC-02-Result.md#requirement-text-review); no file edited) that still names `ServeStaticModule`, `--web-root` or the temp extraction (POC-1f risk) and record each hit. Do not edit requirement files without the human; the SRS owner decides. Source: [REQ-NET-02](../requirements/06-web-gateway-https-pwa.md), not verified against the SRS owner.
- [x] Update the backlog index, the roadmap slice table and statuses; mark the 2a to 2g epics as delivered with their branches. Source: [REQ-REP-05](../requirements/03-file-structure.md).
- [ ] (not done, not verified: file not read in this slice) Update `docs/requirements/traceability.md` rows for the REQ ids that POC-2 closed, only if the file records POC status. Source: not verified (read the file first).
- [ ] (partly done: the owners are proposed in the [result](../results/POC-02-Result.md#pending-items-inherited-and-new); the Inherited and Tasks lines of POC-3, POC-4, POC-5 and POC-8 are not edited) Hand the open items to POC-3, POC-4, POC-5 and POC-8 by editing their "Inherited" or "Tasks" lines; link the 2a answer from POC-3. Source: [REQ-CFG-05](../requirements/04-configuration.md) (root), pitch ids of those POCs.
- [x] Regenerate `docs/meta.toon` and run the metadata check. Source: [Metadata block v1](../standards/README.md#metadata-block-v1).

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `docs/results/POC-02-Result.md`, `docs/architecture/adr/ADR-002-*.md` | manual: no CLI writes these pages |
| `docs/roadmap/PROPOSAL.md`, `docs/backlog/*.md`, `docs/requirements/traceability.md` | manual edits |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

---

## Risks

[Back to navigation](#navigation)

- The result can overstate. Every claim carries `verified` or `not verified` and its command. Windows stays unverified.
- Editing requirement files and OQ rows changes shared contracts of the SRS set. Those edits wait for the human.
- ADR numbering: the ADR index says ADR-001 to ADR-007 are the per-POC results. ADR-002 matches the pitch.

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| [OQ11](../roadmap/PROPOSAL.md#open-questions) | measured values replace proposals | proposed; needs human approval to change |
