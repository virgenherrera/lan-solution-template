<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2b-dispatcher-service-registry.md
title: "POC-2b Dispatcher and service registry"
type: backlog
summary: "Backlog slice 2b of POC-2: Zod-validated dispatcher, closed service registry and the auth-ms registry design."
related[4]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2a-launcher-cwd-spike.md,docs/backlog/poc-2c-assembler-registry-build.md,docs/backlog/poc-1c-sea-build.md
status: current
updated: 2026-10-31
-->

# POC-2b: Dispatcher and service registry

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2a-launcher-cwd-spike.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-2c-assembler-registry-build.md)

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
| Status | Planned |
| Slice | 2b of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~250 authored lines (ASSUMPTION) |
| Depends on | none. POC-1c supplies the `--service <id>` entry that this slice replaces |
| Branch (decided, D1) | `minor/poc-02-supervisor`, one commit or commit group per slice, one draft PR for all of POC-2 |
| Result page | `docs/results/POC-02b-dispatcher-registry.md` |
| Requirements | REQ-RUNTIME-03, REQ-RUNTIME-04 |
| Acceptance criteria | AC-28 (start), AC-29 (unknown roles), AC-31 |

---

## Goal

[Back to navigation](#navigation)

Source: [umbrella](poc-2-single-sea-runtime-supervisor.md#goal), [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md).

- Today the generated entry of `compile-sea.ts` holds the role table as a template string. Move the contract into reviewed TypeScript: a closed service registry and a dispatcher that Zod validates.
- No argument starts the supervisor. `--service <id>` starts one registered service. Any other id is rejected.
- Show on paper, and in a scratch dry run, that a future `apps/auth-ms` needs only its bootstrap, its dependency and its Nx target.

| No-gos |
|---|
| No `auth-ms` in the repository ([REQ-RUNTIME-04](../requirements/09-desktop-tauri.md)). The dry run lives in a scratch copy and is never committed. |
| The selector grants no privilege ([REQ-RUNTIME-03](../requirements/09-desktop-tauri.md)). |
| No `fork()` or `cluster`. No `node` from PATH. |

---

## Requirements

[Back to navigation](#navigation)

- [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md): dispatcher, Zod, closed registry.
- [REQ-RUNTIME-04](../requirements/09-desktop-tauri.md): each Nest app keeps its bootstrap and Nx target. Pitch id with no task; assigned here.
- [REQ-REP-02](../requirements/03-file-structure.md): `shared-core` and any contract lib import no `@nestjs/*` and no `@angular/*`.

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-28](../requirements/11-nx-quality-testing.md): the packaged binary with no arguments starts `sea-runtime` standalone, and only `api-gateway` is enabled.
- [AC-29](../requirements/11-nx-quality-testing.md): unknown roles are rejected.
- [AC-31](../requirements/11-nx-quality-testing.md): registry design only.

Observable checks, run on the packaged binary in a clean directory:

- `./sea-runtime --service nope` exits 2 and prints the unknown id and the registered ids on stderr.
- `./sea-runtime --service` (no value) and `./sea-runtime --service a --service b` exit 2.
- `./sea-runtime --service sea-runtime` exits 2 (the supervisor is not a service id; a proposal, not verified against the SRS).
- `./sea-runtime` starts the supervisor and `GET /api/health` returns 200 within the existing behaviour.
- The scratch dry run lists `auth-ms` in the registry after only the three registration edits, and `git diff` of `apps/desktop` in that copy is empty.
- `pnpm run build && pnpm run test` exit 0.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Create the contract package (working name `libs/service-registry`; not verified, see the file table): the `ServiceDefinition` Zod schema (`id`, `entry`, `dependsOn`, `enabled`) and the id parser. It imports only `zod`. Source: [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md), [REQ-REP-02](../requirements/03-file-structure.md).
- [ ] Write the dispatcher over `process.argv`: parse with `node:util` `parseArgs`, validate with Zod, reject unknown, repeated or empty ids with exit 2. Source: [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md), [AC-29](../requirements/11-nx-quality-testing.md).
- [ ] Make no selector mean supervisor mode and keep `createApplicationContext(RuntimeModule)` as the supervisor bootstrap. Source: [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md), [AC-28](../requirements/11-nx-quality-testing.md).
- [ ] Change the supervisor to read its service list from the registry type instead of an ad hoc `services.json` shape. The asset name and fields stay as they are until 2c. Source: [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md).
- [ ] Document the registry design for a future `auth-ms`: the three registration points and what stays untouched (no sidecar, no `apps/desktop` edit). Run the dry run in a `mktemp -d` copy and quote the result. Source: [AC-31](../requirements/11-nx-quality-testing.md), [REQ-RUNTIME-04](../requirements/09-desktop-tauri.md).
- [ ] Record the supervisor and gateway bootstrap contract: `api-gateway` keeps `NestFactory.create()` plus `NodeAdapter`. Source: [REQ-RUNTIME-04](../requirements/09-desktop-tauri.md), [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md).
- [ ] Publish `docs/results/POC-02b-dispatcher-registry.md`. Source: [AC-29](../requirements/11-nx-quality-testing.md), [AC-31](../requirements/11-nx-quality-testing.md).

No unit or integration suite is added ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)). The checks above run on the real binary.

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `libs/service-registry/package.json`, `tsconfig.json` | `pnpm init`, `pnpm exec tsc --init`, `pnpm pkg set`, the same route as `libs/shared-core` in [POC-1b](../results/POC-01b-Result.md). An Nx library generator (`pnpm dlx nx g --help`) is not verified to exist in this workspace; check it first |
| `libs/service-registry/src/*.ts` | manual: no CLI writes schema or dispatcher bodies |
| `apps/sea-runtime/package.json` | `pnpm --filter sea-runtime add service-registry@workspace:*` |
| `apps/sea-runtime/src/supervisor/supervisor.service.ts` | manual edit of a CLI-generated file |
| `tools/scripts/compile-sea.ts` | manual edit: the generated entry calls the dispatcher. Reason: no CLI generates a SEA assembler |
| `docs/results/POC-02b-dispatcher-registry.md`, `docs/meta.toon` | manual; regeneration command |

---

## Risks

[Back to navigation](#navigation)

- The id list is closed at build time. A wrong list in the assembler (2c) breaks the role table. 2c owns that check.
- Changing the entry changes the CLI contract of the binary (`--service`). Only the supervisor calls it today, but the branch prefix is `minor/`.
- `sea-runtime` is not a registrable service in this proposal. If the SRS wants it addressable, the rule changes. Not verified against the SRS owner.
- Premise not verified: that a plain Node library package builds under the present `nx.json` without a plugin.

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| none | No open question touches this slice | none |
