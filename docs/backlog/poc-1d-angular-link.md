<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-1d-angular-link.md
title: "POC-1d Angular and link"
type: backlog
summary: "Backlog slice 1d of POC-1: web-angular generated with the Angular CLI and served by api-gateway over plain HTTP."
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
| Status | Delivered on branch `minor/poc-01d-angular-link` (human decision). Result: [POC-1d](../results/POC-01d-Result.md) |
| Slice | 1d of 1a to 1e; umbrella [POC-1](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton) |
| Appetite | ~1 day, ASSUMPTION |
| Depends on | POC-1c |
| Branch | `minor/poc-01d-angular-link`; delivered on that branch |
| Result page | `docs/results/POC-01d-Result.md` |
| Requirements | 5 REQ ids |
| Acceptance criteria | AC-13 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton).

- Generate `apps/web-angular` and link `api-gateway` to the Angular build.
- The `web-angular` build is served over plain HTTP. TLS and PWA stay in POC-4.
- The `web-angular` app works in the Angular dev server and from the SEA binary.

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

- [x] Create skeleton `apps/web-angular` with `pnpm dlx @angular/cli new`. Check that it builds independently and does not import the other apps. Source: [REQ-REP-01](../requirements/03-file-structure.md), [REQ-REP-02](../requirements/03-file-structure.md), [REQ-REP-03](../requirements/03-file-structure.md), [AC-13](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [x] Link `api-gateway` to the Angular build over plain HTTP (no TLS, no PWA). `sea-runtime` embeds the `web-angular` browser output as SEA assets, in place of the spike dummy `tools/spike/web-dummy`. The supervisor extracts the tree and spawns `api-gateway` with `--web-root`. `api-gateway` mounts static serving only when `webRoot` is present (decision 17, [spike](../results/SPIKE-spa-serving.md)). `web-angular` is a workspace dependency of `sea-runtime` and is classified as the web bundle, not a service (see [result](../results/POC-01d-Result.md#classification-rule)). POC-4 owns the hardening of this serving. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)), [decision 17](../roadmap/PROPOSAL.md#decision-log).
- [x] Model the Nx order. First, `build` of `web-angular`, `sea-runtime` and `api-gateway`. Then the SEA `package`. Today the `package` target lives on `sea-runtime` and depends on its `build`, which depends on the builds of its workspace dependencies (`^build`). `web-angular` is a workspace dependency of `sea-runtime`, so it builds first. It is a web bundle, not a service. (The `desktop` `package` step is added in POC-1e.) Source: [REQ-BUILD-03](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [x] Record the post-`package` check. Changing Angular invalidates the SEA and the Tauri bundle. A backend-only change does not force an Angular rebuild when Nx can reuse it. (The SEA part is checked here, observed in the [result page](../results/POC-01d-Result.md#nx-cache-experiment-req-build-05-sea-part). The Tauri bundle part stays with POC-1e.) Source: [REQ-BUILD-05](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [x] Write `docs/results/POC-01d-Result.md` with the dev and SEA observations, the Nx order evidence and the list of manual edits (files not produced by a CLI). Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [x] Run and verify. Dev: run the Angular dev server (generated script, name not verified) and open its URL: expected, the `web-angular` page renders. SEA: run the `package` target, start the binary and run `curl -i http://localhost:<port>/`: expected, `HTTP/1.1 200` with the `web-angular` index body; `curl -i` on the health path still returns 200. Order: print the Nx graph or the target `dependsOn` (command not verified): expected, the three builds before `package`. Change one Angular file and run `package` again: expected, the SEA is rebuilt. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
  - Evidence: the SEA binary was started and checked with `curl` (`/` and `/health` return 200). A headless Chromium check ran against the packaged binary with no console or page errors. See the [browser check](../results/POC-01d-Result.md#browser-check-playwright). The dev server ran in headless Chromium with the same script (see the dev subsection of the browser check). The Nx cache experiment ran. Not run: the Tauri bundle part, which stays with POC-1e. See the [result page](../results/POC-01d-Result.md#not-verified).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Decision Log item 17.

No open questions remain in this slice. Decision 17, open item 2, is settled by the [classification rule](../results/POC-01d-Result.md#classification-rule).
