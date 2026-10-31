<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-1c-sea-build.md
title: "POC-1c SEA build"
type: backlog
summary: "Backlog slice 1c of POC-1: the dummy Nest app packaged as a Node SEA with a minimal native build script."
related[3]: docs/backlog/README.md,docs/backlog/poc-1b-nest-apps.md,docs/backlog/poc-1d-angular-link.md
status: current
updated: 2026-10-31
-->

# POC-1c: SEA build

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-1b-nest-apps.md) | [Up](README.md) | [Next](poc-1d-angular-link.md)

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
| Status | Delivered on branch `minor/poc-01b-nest` (PR 3, draft) |
| Slice | 1c of 1a to 1e; umbrella [POC-1](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton) |
| Appetite | ~2 days, ASSUMPTION |
| Depends on | POC-1b |
| Branch | `minor/poc-01b-nest` (human decision: POC-1c delivered on the POC-1b branch and PR, not `minor/poc-01c-sea-build`) |
| Result page | `docs/results/POC-01c-Result.md` |
| Requirements | 1 REQ id |
| Acceptance criteria | none cited by the tasks of this slice |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton).

- Package the dummy Nest app from POC-1b as a SEA and run it from the binary.
- One Node version builds and runs every app (the pin from POC-1a).
- Write the minimal native `node --build-sea` script here, no postject. POC-2 extends it.

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

- [REQ-BUILD-04](../requirements/11-nx-quality-testing.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

None of the tasks of this slice cites an AC id. The pitch ACs are covered by the other slices.

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton). The pitch also lists NFR-01..15 (not defined in `docs/requirements`, so not linked).

---

## Tasks

[Back to navigation](#navigation)

- [x] Write the minimal `tools/scripts/compile-sea.ts` with native `node --build-sea`, no postject. It bundles the services that are workspace dependencies of `sea-runtime` (today `api-gateway`) and the supervisor entry into one ESM file, then writes one executable. Observed: `artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin`. The SEA requirements are in [10-node-sea-distribution](../requirements/10-node-sea-distribution.md); no REQ id is added to this slice because the old single POC-1 epic cites none here. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [x] Declare the `package` target on the project `sea-runtime`, not on a separate `sea-build` project. It runs `tools/scripts/compile-sea.ts sea-runtime`. Its `build` depends on the `build` of its workspace dependencies (`^build`). Observed: `pnpm nx package sea-runtime` ran `api-gateway:build`, `sea-runtime:build` and `sea-runtime:package`, exit 0. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [x] Add the minimal supervisor. `sea-runtime` reads the SEA asset `services.json`, validates it with Zod, and spawns `process.execPath --service <id>` for each service. It stops the children on SIGINT or SIGTERM. Observed: the child answered `/health`; SIGTERM stopped the supervisor and its child. SIGINT not exercised on macOS; exercised on Linux in Docker ([POC-01c Result](../results/POC-01c-Result.md#linux-in-docker)). Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [ ] Invalidate the build when a registered service is added or changed. Not built in this slice; the clause moves to [POC-2](poc-2-single-sea-runtime-supervisor.md). Source: [REQ-BUILD-04](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton))
- [x] Write `docs/results/POC-01c-Result.md` with the build command, the binary size, the observed run and the list of manual edits (files not produced by a CLI). Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [x] Run and verify. Run `pnpm nx package sea-runtime`. Expected: exit 0 and one binary `artifacts/sea-runtime/sea-runtime-<target-triple>`. Observed on macOS arm64: exit 0, one file of 147863776 bytes. Start the binary with no arguments and run `curl -i http://127.0.0.1:3000/health`: observed `HTTP/1.1 200 OK` from the `api-gateway` child, not from `node`. Run the binary with a PATH that has no `node`: observed, it starts. Linux binaries built and run in Docker (arm64 and amd64, see [POC-01c Result](../results/POC-01c-Result.md#linux-in-docker)). Windows binary not built. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [x] Check the artifact naming against the Tauri sidecar documentation (`<name>-<target-triple>`). The result page quotes the naming. The Tauri consumer side is not verified. Source: [Decision 16](../roadmap/PROPOSAL.md#decision-log), this slice only. Source: this slice only, no REQ or AC id added ([pitch](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)).
- [ ] Decide the Linux binary run-time need for `libatomic.so.1` on the host (see [POC-01c Result](../results/POC-01c-Result.md#linux-in-docker)). Decide whether to document it as an installer prerequisite or avoid the dependency. Not decided in this slice.

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

None cited by the tasks of this slice.
