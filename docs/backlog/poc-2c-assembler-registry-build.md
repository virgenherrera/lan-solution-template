<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2c-assembler-registry-build.md
title: "POC-2c Assembler driven by the registry"
type: backlog
summary: "Backlog slice 2c of POC-2: assembler bundles dispatcher and services from the registry and invalidates on change."
related[3]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2b-dispatcher-service-registry.md,docs/backlog/poc-2d-supervisor-readiness-logs.md
status: current
updated: 2026-10-31
-->

# POC-2c: Assembler driven by the registry

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2b-dispatcher-service-registry.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-2d-supervisor-readiness-logs.md)

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
| Status | Done in commit `0f7a834` on `minor/poc-02-supervisor`, see [result](../results/POC-02c-assembler-registry.md) |
| Slice | 2c of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~250 authored lines (ASSUMPTION) |
| Depends on | [2b](poc-2b-dispatcher-service-registry.md) |
| Branch (decided, D1) | `minor/poc-02-supervisor`, one commit or commit group per slice, one draft PR for all of POC-2 |
| Result page | `docs/results/POC-02c-assembler-registry.md` |
| Requirements | REQ-SEA-01, REQ-SEA-02, REQ-SEA-03, REQ-BUILD-04 |
| Acceptance criteria | AC-11 (partial) |

---

## Goal

[Back to navigation](#navigation)

Source: [umbrella](poc-2-single-sea-runtime-supervisor.md#goal), [REQ-SEA-01](../requirements/10-node-sea-distribution.md), [REQ-BUILD-04](../requirements/11-nx-quality-testing.md).

- `tools/scripts/compile-sea.ts` takes the registered services from the workspace dependencies of `sea-runtime`, validates them against the registry contract from 2b, and bundles the dispatcher with them into one executable bundle. Native `node --build-sea`, no postject.
- The build is invalidated when a registered service is added or changed. This clause of [REQ-BUILD-04](../requirements/11-nx-quality-testing.md) moved here from POC-1c.
- The SEA flags follow [REQ-SEA-03](../requirements/10-node-sea-distribution.md), and the amd64 code-cache warning from POC-1c gets a cause.

| No-gos |
|---|
| No postject ([REQ-SEA-02](../requirements/10-node-sea-distribution.md)). |
| No second executable. |
| No SPA work. The web bundle path from POC-1f stays as it is. |

---

## Requirements

[Back to navigation](#navigation)

- [REQ-SEA-01](../requirements/10-node-sea-distribution.md): single JavaScript dispatcher bundle, no external `node_modules`.
- [REQ-SEA-02](../requirements/10-node-sea-distribution.md): `node --build-sea`, no postject.
- [REQ-SEA-03](../requirements/10-node-sea-distribution.md): `useVfs: false`, `useSnapshot: false`, `useCodeCache` only for compatible native builds, `execArgvExtension: "none"` for release.
- [REQ-BUILD-04](../requirements/11-nx-quality-testing.md): declared entrypoints exist, one executable bundle, invalidation on service change.

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-11](../requirements/11-nx-quality-testing.md) (partial): the host needs neither `node_modules` nor a Node install, and there is a single physical SEA.

Observable checks:

- `pnpm exec nx run sea-runtime:package` exits 0. Then copy only the binary to an empty `mktemp -d` directory and run it with `PATH` stripped of every `node`. `GET /api/health` returns 200.
- `ls artifacts` shows one executable per target. No `node` binary and no `.js` file ships next to it.
- Add a registered service in a scratch copy: the dispatcher bundle sha256 and the embedded `services.json` change. Edit one service source file: the bundle sha256 changes. Remove the edit: it returns.
- Remove a declared entrypoint in the scratch copy: the assembler exits non-zero before `node --build-sea` runs.
- In the amd64 Docker run, the `Code cache data rejected` line either disappears or the cause is written down with the command that shows it.
- `pnpm run build && pnpm run test` exit 0.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Read the registered services from the `sea-runtime` workspace dependencies and validate each one against the 2b registry schema. A service whose entrypoint is missing fails the build. Source: [REQ-SEA-01](../requirements/10-node-sea-distribution.md), [REQ-BUILD-04](../requirements/11-nx-quality-testing.md).
- [ ] Generate the entry from the registry and bundle dispatcher, supervisor and services as one bundle with the existing rspack route. Source: [REQ-SEA-01](../requirements/10-node-sea-distribution.md).
- [ ] Keep `node --build-sea` and prove with the build log that no postject is invoked. Source: [REQ-SEA-02](../requirements/10-node-sea-distribution.md).
- [ ] Declare the invalidation: the `package` target inputs include the service projects, the registry package and the assembler. Prove it with the sha256 checks above. Note that `package` is never cached today, so the observable proof is the bundle hash, not a cache miss. Source: [REQ-BUILD-04](../requirements/11-nx-quality-testing.md).
- [ ] Audit the SEA configuration against [REQ-SEA-03](../requirements/10-node-sea-distribution.md). Disable the code cache when the target architecture differs from the host, and document the cross-build rule. Investigate the amd64 `Code cache data rejected` warning from POC-1c. Source: [REQ-SEA-03](../requirements/10-node-sea-distribution.md).
- [ ] Verify AC-11: run the binary from an empty directory with no Node on `PATH`, on macOS and in the Debian bookworm images used in POC-1c. Source: [AC-11](../requirements/11-nx-quality-testing.md), [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md).
- [ ] Record that the SEA binary is not reproducible and `package` is not cached, with the measured size. Reproducibility itself is not claimed. Source: not verified (no REQ in the pitch).
- [ ] Publish `docs/results/POC-02c-assembler-registry.md`. Source: [REQ-BUILD-04](../requirements/11-nx-quality-testing.md), [AC-11](../requirements/11-nx-quality-testing.md).

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `tools/scripts/compile-sea.ts` | manual edit. Reason: no CLI generates a SEA assembler |
| `apps/sea-runtime/package.json` | `pnpm pkg set` for `nx.targets.package.inputs`; Nx targets have no generator. Reason: the same one given in [POC-1c](../results/POC-01c-Result.md) |
| `nx.json` | manual only if a named input is needed. Reason: no CLI edits `namedInputs` |
| `docs/results/POC-02c-assembler-registry.md`, `docs/meta.toon` | manual; regeneration command |

---

## Risks

[Back to navigation](#navigation)

- Bundling Nest dependencies into one bundle is a pitch rabbit hole. rspack worked for one service in 1c; more services may expose a dynamic `require` that rspack cannot resolve. If so, the circuit breaker applies.
- `node:sea` asset limits (R-04) are not measured. Record the largest asset and the binary size.
- The code-cache warning cause is unknown (POC-1c, not verified). It may be an emulation artefact of Docker on arm64.
- Invalidation proof is a hash check, because `package` is not cached. Nx cache behaviour for the `build` target is not exercised here.

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| none | No open question touches this slice | none |
