<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02b-dispatcher-registry.md
title: "POC-2b Dispatcher and service registry"
type: backlog
summary: "Result of slice 2b: Zod dispatcher and closed service registry in libs/service-registry, unknown roles rejected, auth-ms registry dry run."
ids[0]:
related[3]: docs/backlog/poc-2b-dispatcher-service-registry.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/results/POC-01f-web-from-memory.md
status: current
updated: 2026-10-31
-->

# POC-2b Dispatcher and service registry

Branch: `minor/poc-02-supervisor`. Epic: [POC-2b](../backlog/poc-2b-dispatcher-service-registry.md). Question: can the role selector move from a template string in `compile-sea.ts` to reviewed TypeScript that Zod validates?

## Summary

- Yes. `libs/service-registry` holds the contract: `ServiceDefinition` (`id`, `entry`, `dependsOn`, `enabled`), the closed registry schema, the services asset schema and `dispatch()`. It imports only `zod` and `node:util`.
- Every literal (the `service` flag, exit code `2`, the `services.json` asset name) is a default of one Zod schema, `dispatcherConfigSchema`. The assembler and the supervisor read the value from the built library.
- The generated entry now lists only the registered services and calls `dispatch()`. No argument starts the supervisor. `--service <id>` starts one registered service. Anything else exits 2.
- The supervisor reads `services.json` through `servicesAssetSchema` and builds the child arguments with `serviceArgs(id)`. Asset name and fields are unchanged (2c owns the change).
- The assembler classifies a workspace dependency that has a built `main` and no `dist/main.js` or web output as a library, and requires `service-registry` among them.

## Observed outputs

Packaged binary, run from a clean `mktemp -d` directory, macOS arm64:

| Command | Exit | stderr (first line) |
| --- | --- | --- |
| `--service nope` | 2 | `unknown service "nope"; registered: api-gateway` |
| `--service` | 2 | `--service needs exactly one non-empty service id; registered: api-gateway` |
| `--service=` | 2 | same as above |
| `--service a --service b` | 2 | same as above |
| `--service sea-runtime` | 2 | `unknown service "sea-runtime"; registered: api-gateway` |
| no argument | runs | `GET /` 200, `GET /api/health` 200, `GET /api/nope` 404 |

- SIGTERM on the supervisor: log `received SIGTERM; stopping 1 service(s)`. `pgrep -fl sea-runtime-aarch64` finds no process afterwards.
- `pnpm run build`, `pnpm run test` and `pnpm exec nx run sea-runtime:package`: exit 0. `nx run-many -t build` and `-t test` with `--skip-nx-cache`: exit 0.
- `sea-runtime` is rejected as a service id because it is not in the registry. This is a proposal, not verified against the SRS.

## Registry design for a future auth-ms (AC-31)

A new service needs three registrations and nothing else:

1. Its bootstrap: `apps/auth-ms/src/main.ts`, built to `apps/auth-ms/dist/main.js`.
2. Its dependency: `pnpm --filter sea-runtime add auth-ms@workspace:*`.
3. Its Nx target: the `build` script in `apps/auth-ms/package.json`.

The assembler finds the service from the dependency and the built `dist/main.js`. The registry, the role table and `services.json` follow with no edit.

Dry run in a `mktemp -d` copy of the tree (tracked files, then `pnpm install --offline`). `apps/auth-ms` was a copy of the `api-gateway` source with the name changed. The copy was deleted afterwards and nothing of it is committed:

- `git status` of the copy: `M apps/sea-runtime/package.json`, `M pnpm-lock.yaml`, `?? apps/auth-ms/`.
- After build and package, `--service nope` printed `unknown service "nope"; registered: api-gateway, auth-ms`.
- `git status -s apps/desktop` in the copy: empty.

## Bootstrap contract

- The supervisor keeps `NestFactory.createApplicationContext(RuntimeModule)` in `apps/sea-runtime/src/main.ts`.
- `api-gateway` keeps `NestFactory.create()` with `NodeAdapter`. The dispatcher only decides which `dist/main.js` runs.
- The selector grants no privilege. It reads no `process.env`.

## Files and the command that wrote them

| File | Written by |
| --- | --- |
| `libs/service-registry/package.json` | `pnpm init`, then `pnpm pkg set` (name, main, types, scripts) |
| `libs/service-registry/tsconfig.json` | `pnpm exec tsc --init`, then one manual edit: `"types": ["node"]` for `node:util` |
| `libs/service-registry/package.json` dependencies | `pnpm --filter service-registry add zod@catalog:` and `add -D @types/node@24.19.2` |
| `apps/sea-runtime/package.json`, `pnpm-lock.yaml` | `pnpm --filter sea-runtime add service-registry@workspace:*` |
| `libs/service-registry/src/*.ts` | manual (no CLI writes schema or dispatcher bodies) |
| `apps/sea-runtime/src/supervisor/supervisor.service.ts` | manual edit of a CLI-generated file |
| `tools/scripts/compile-sea.ts` | manual edit (no CLI generates a SEA assembler) |
| `docs/results/POC-02b-dispatcher-registry.md` | manual |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

An Nx library generator was not used: `nx list` shows no installed plugin that offers one. The library follows the `libs/shared-core` route.

## Risks

- The binary contract changed: a selector with no value or a repeated one now exits 2 instead of failing in the old template. Only the supervisor calls it today.
- `pnpm add` also moved `zod` 4.6.6 to 4.6.7 for two transitive `@modelcontextprotocol` entries in `pnpm-lock.yaml`. Not requested; produced by the resolver.
- `compile-sea.ts` imports the built library with a dynamic `import()`, so `pnpm --filter sea-runtime build` must run first. The Nx `^build` dependency guarantees it.
- Only macOS arm64 was tested.
- `dependsOn` and `enabled` are validated but nothing consumes them yet (2c to 2e).
