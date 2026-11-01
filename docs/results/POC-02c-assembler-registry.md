<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02c-assembler-registry.md
title: "POC-2c Assembler driven by the registry"
type: backlog
summary: "Result of slice 2c: assembler validates services against the registry, SEA flags come from Zod defaults, invalidation proved by hash."
ids[0]:
related[3]: docs/backlog/poc-2c-assembler-registry-build.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/results/POC-02b-dispatcher-registry.md
status: current
updated: 2026-10-31
-->

# POC-2c Assembler driven by the registry

Branch: `minor/poc-02-supervisor`. Epic: [POC-2c](../backlog/poc-2c-assembler-registry-build.md). Question: can the assembler build the one executable from the registered services, fail early on a bad registry, and rebuild when a service changes?

## Summary

- Yes for the native macOS arm64 build. The Docker amd64 checks are not verified (see [Code cache warning](#code-cache-warning)).
- `tools/scripts/compile-sea.ts` loads the built `service-registry` library first. It builds the registry from the `sea-runtime` workspace dependencies, validates it with `serviceRegistrySchema` (unique ids, known dependencies) and checks that every declared entrypoint exists. This runs before bundling and before `node --build-sea`.
- The `services.json` asset is validated with `servicesAssetSchema` before it is written. Its shape is unchanged.
- The SEA baseline is a Zod default in `libs/service-registry/src/assembler-config.ts` (`ASSEMBLER_CONFIG`): `mainFormat: "module"`, `useVfs: false`, `useSnapshot: false`, `execArgvExtension: "none"`, and the service entry path `dist/main.js`. The flag types are literals, so a different value fails the parse.
- `useCodeCache` is `useCodeCache(hostTriple, targetTriple)`: on only when both triples are equal (REQ-SEA-03).
- The only literal left in the script is the registry library name, because the library cannot say where it lives.
- No postject. The build log of `nx run sea-runtime:package` has 0 lines that match `postject`; the script calls `node --build-sea` only.

## Cross build rule

- Native build: `node tools/scripts/compile-sea.ts sea-runtime`. Code cache on.
- Cross build: `--target <triple> --executable <node binary of the target>`. The code cache is off, `executable` is written to the SEA config and the macOS ad-hoc signature runs only for a macOS target built on macOS.
- A target that differs from the host with no `--executable` exits 1. `--executable` on a native build exits 1.
- Observed in a scratch copy: `--target x86_64-unknown-linux-gnu` with no `--executable` exits 1; with the host Node as `--executable` the log shows `code cache off` and `sea-config.json` has `"useCodeCache": false`. That run used a macOS Node as the base, so its output is not a Linux binary. A real cross build with a target Node is not verified.

## Observed outputs

macOS arm64, Node 26.13.0.

| Check | Result |
| --- | --- |
| `pnpm run build` | exit 0 |
| `pnpm run test` | exit 0 |
| `pnpm exec nx run-many -t build --skip-nx-cache --exclude=lan-solution-template` | exit 0, 6 tasks |
| `pnpm exec nx run-many -t build --skip-nx-cache` (no exclude) | exit 1: the root project `lan-solution-template` has no `build` script. Same result on the base commit, so not caused by 2c. The root `build` script uses the exclude |
| `pnpm exec nx run sea-runtime:package --skip-nx-cache` | exit 0 |
| `ls artifacts/sea-runtime` | one file: `sea-runtime-aarch64-apple-darwin`. No `node` binary, no `.js` file |
| Binary copied alone to an empty `mktemp -d`, `PATH=/usr/bin:/bin:/usr/sbin:/sbin` (no `node`) | `GET /` 200, `GET /api/health` 200, `GET /api/nope` 404 |
| SIGTERM on the supervisor | 0 processes left (`pgrep -f` on the copied path) |
| Selectors, passed as an argument array | `--service nope` 2, `--service` 2, `--service=` 2, `--service sea-runtime` 2, `--service a --service b` 2 |

## Invalidation proof (REQ-BUILD-04)

Scratch copy of the tree in `mktemp -d` (tracked and untracked files, then `pnpm install --offline`), `package` run with `--skip-nx-cache` each time. `package` is never cached today, so the proof is the bundle hash, not a cache miss.

| Step | `sea-app.mjs` sha256 (first 16) | `services.json` ids |
| --- | --- | --- |
| Baseline | `a56186d3b190d94d` | `api-gateway` |
| Rebuild, no change | `a56186d3b190d94d` | `api-gateway` |
| `status: 'ok'` changed to `'okk'` in `health.controller.ts` | `0b64b2993176c588` | `api-gateway` |
| Edit reverted | `a56186d3b190d94d` | `api-gateway` |
| `auth-ms` added (copy of `api-gateway`, renamed, `pnpm --filter sea-runtime add auth-ms@workspace:*`) | `c01e74b964fd20f0` | `api-gateway`, `auth-ms` |

- An appended comment line did not change the hash, because the minifier drops it. A comment is not a change of the bundle.
- With `apps/auth-ms/dist/main.js` removed, `node tools/scripts/compile-sea.ts sea-runtime` exits 1 with `auth-ms: neither a service (missing .../dist/main.js), a web bundle ... nor a library ... run the auth-ms build target first`. The log has no `build-sea` line.
- Declared Nx invalidation: the `package` target `inputs` are `default`, `^default` (the service projects and the registry library, through the workspace dependencies), `{workspaceRoot}/tools/scripts/compile-sea.ts` and `{workspaceRoot}/tools/rspack/**/*`. `nx show project sea-runtime --json` lists them. The scratch copy was deleted.

## Code cache warning

- Cause: not verified. The `Warning: Code cache data rejected.` line was seen only on amd64 under emulation in [POC-1c](POC-01c-Result.md). This slice did not run Docker, so the amd64 run was not repeated.
- Working hypothesis, not verified: V8 rejects a code cache whose version, flag or CPU feature hash differs from the run host, and emulation changes the reported CPU features.
- Command that shows it, to run in the POC-1c image set: build the binary in `node:26.13.0-bookworm` with `--platform linux/amd64`, copy it to `debian:bookworm-slim` with the same `--platform`, then run `sea-runtime --service nope` and read stderr. Run it once more with `"useCodeCache": false` in the SEA config; if the line disappears, the code cache is the source.

## SEA size and reproducibility

- Binary: 148224928 bytes (macOS arm64, with web bundle). Largest embedded asset: `web/main-IYRPS55C.js`, 223950 bytes. `node:sea` asset limits (R-04) are not tested.
- Two packages of the same tree gave the same bundle hash and different binary hashes (`1c930d19f8c14f7a`, `9c5967bb56a8561e`). The binary is not reproducible. `package` is not cached. Reproducibility is not claimed.

## Not verified

- AC-11 in the Debian bookworm images (amd64 and arm64): Docker was not used.
- Linux and Windows targets, and a real cross build.
- Bundling more than one real Nest service: the second service was a renamed copy of `api-gateway`.

## Files and the command that wrote them

| File | Written by |
| --- | --- |
| `apps/sea-runtime/package.json` | `pnpm pkg set --json nx.targets.package.inputs=[...]` run in `apps/sea-runtime` |
| `libs/service-registry/src/assembler-config.ts` | manual (no CLI writes schema bodies) |
| `libs/service-registry/src/index.ts` | manual, one export line |
| `tools/scripts/compile-sea.ts` | manual edit (no CLI generates a SEA assembler) |
| `docs/results/POC-02c-assembler-registry.md` | manual |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

No dependency was added; `pnpm-lock.yaml` is unchanged.

## Risks

- `compile-sea.ts` now needs the built `service-registry` before it starts. The Nx `^build` dependency covers it; a direct run needs `pnpm --filter service-registry build` first.
- The CLI gained `--target` and `--executable`. Nothing else calls it with arguments.
- `dependsOn` and `enabled` are still validated but not consumed (2e).
