<!-- toon-meta
fmt: TOON
doc: docs/results/SPIKE-spa-serving.md
title: "SPIKE SPA serving in the SEA"
type: backlog
summary: "Spike: serving a static SPA from api-gateway inside the Node SEA, with the gateway unaware of SEA."
ids[0]:
related[3]: docs/results/POC-01c-Result.md,docs/standards/README.md,docs/requirements/10-node-sea-distribution.md
status: current
updated: 2026-10-31
-->

# SPIKE SPA serving in the SEA

Branch: a spike branch that was renamed to `minor/poc-01d-angular-link` before merge. Question: can `api-gateway` serve a static single-page app while staying SEA-agnostic, with the SEA supervisor handing it the files?

## Summary

- Mechanism 1 works: `ServeStaticModule.forRoot` from `@nestjs/serve-static` 12.1.1 runs under the `NodeAdapter` (its `NodeLoader` path). Caveat: `AppController` on `/` shadows the index, so the hello route was removed.
- Mechanism 2 works: the SEA embeds a 21-file tree as assets `web/<path>` plus a manifest of sha256 hashes. The supervisor extracts it to a versioned cache directory and checks every hash.
- Mechanism 3 works: the supervisor spawns `--service api-gateway --web-root <dir>`. `api-gateway` parses argv with Zod into a frozen config. Static serving mounts only when `webRoot` is present. No `process.env` and no `isSea` call exist in `api-gateway`.
- Observed end to end on the packaged binary, run with `env -i PATH=/usr/bin:/bin`: `/` returns `HTTP/1.1 200 OK` with the dummy `index.html`, and `/health` returns 200.
- Dev case (no `--web-root`, direct `node dist/main.js`): `/` returns 404 and `/health` returns 200.

## Versions

| Item | Version | Notes |
| --- | --- | --- |
| Node | 26.13.0 | Matches `engines.node` |
| pnpm | 12.16.1 | Root `packageManager` |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-node` | 12.3.2 | Catalog pins in the app manifests |
| `@nestjs/serve-static` | 12.1.1 | Added with `pnpm add -E`; published 2026-10-27, older than `minimumReleaseAge` 1440 minutes |
| `@nestjs/serve-static` peers | `@nestjs/core` and `@nestjs/platform-node` ^12; `express` ^5.0.1 and `fastify` ^5.2.1 optional for this path | Express and Fastify are not installed; the `NodeLoader` path was used |
| `zod` | 4.6.7 | Catalog pin |
| `nx` | 24.0.2 | Catalog pin |
| macOS | Darwin 27.2.0, arm64 | Only platform tested |

## Mechanism 1: serve-static with NodeAdapter

- `ServeStaticModule` checks the adapter. `getType() === 'node'` selects `NodeLoader`, which calls `useStaticAssets`. No Express or Fastify is needed.
- Probe with `AppController` present: `/` returned the hello text (12 bytes), not the index. `/index.html`, `/css/app.css` and `/health` were served correctly.
- Probe with `AppController` removed: `/` returned the index (175 bytes). Unknown paths such as `/nope` also returned the index with 200. This is the module's default `renderPath: '*'` fallback.
- Decision: the no-webRoot case mounts nothing, so `/` returns 404 there.

## Mechanism 2: SEA assets and extraction

- The SEA config `assets` map is a key to path object. Keys are relative names. `getAsset(key, 'utf8')` and `getRawAsset(key)` return the bytes. `getRawAsset` returns an `ArrayBuffer`.
- `mainFormat` defaults to `commonjs`. An ESM bundle needs `"mainFormat": "module"`. `compile-sea` already sets it.
- Build-time manifest: `compile-sea` hashes every file of `tools/spike/web-dummy`, writes `web-manifest.json` into the work directory, and embeds it with the files as `web/<path>`.
- Runtime: the manifest hash names the cache directory `<os tmpdir>/lan-web-tree/<16 hex>`. Files are written to a `.tmp-<pid>` staging directory, hash-checked, and renamed into place. A `.complete` marker makes later starts reuse the tree. Reuse re-hashes every file.
- Measured in the scratch clone with 21 files and a 2,000,000-byte binary asset: SEA size delta 2,002,752 bytes against the same SEA without assets. First extraction 7 ms. Reuse with hash check 3 ms.
- Surprise: outside `env -i`, `os.tmpdir()` uses `$TMPDIR`. Under `env -i` it falls back to `/tmp`. The path is still under the OS temp dir.
- Surprise: on macOS the SEA needs an ad-hoc signature (`codesign --sign -`). Without it the binary is killed at start. `compile-sea` already does this.
- Not tested: Node's `useVfs` and `vfsArchive` (added in v26.9.0, stability 1.0 early development). They expose the assets through `node:fs`. Not evaluated.
- Not tested: a large real SPA, Linux, Windows.

## Mechanism 3: supervisor handoff

- `api-gateway` `main.ts` parses `process.argv.slice(2)` with `node:util` `parseArgs` (strict false, so `--service` is ignored), then Zod. It builds `AppModule.register(config)`.
- `SupervisorService` extracts the tree once, then spawns `process.execPath --service api-gateway --web-root <dir>`. Other services receive `--service <id>` only.
- `server-config.ts` keeps `port` and `hostname`. `webRoot` is optional.

## Commands

```sh
NX_DAEMON=false pnpm nx build api-gateway --skip-nx-cache
pnpm --filter api-gateway add -E @nestjs/serve-static@12.1.1
NX_DAEMON=false pnpm nx package sea-runtime --skip-nx-cache
env -i PATH=/usr/bin:/bin artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/health
```

## Observed outputs

- `NX_DAEMON=false pnpm nx package sea-runtime --skip-nx-cache`: exit 0. Output size 147,945,856 bytes.
- Packaged binary, `env -i`: log line `web tree extracted to /tmp/lan-web-tree/2a21a9b3907aa687`; `GET /` returned `HTTP/1.1 200 OK` and the dummy title; `GET /health` returned 200; SIGTERM left no process and freed port 3000.
- Dev case `node dist/main.js --service api-gateway` under `env -i`: `GET /` 404, `GET /health` 200.

## What failed or needed a workaround

- `AppController` on `/` shadowed the static index. Workaround: remove it. This changes the hello route, which the spike required (dev `/` must be 404).
- The first ESM SEA build failed with `Failed to load the ES module` because `mainFormat` was `commonjs`. Workaround: `"mainFormat": "module"`.
- Only the NodeAdapter path was exercised. Express and Fastify were not installed.

## Recommendation

- Use `ServeStaticModule` with `NodeAdapter` and keep the mount conditional on `webRoot`.
- Keep the manifest-and-extract mechanism for the SEA. It needs no runtime dependencies. Evaluate `useVfs` separately before choosing it.
- Before POC-3, decide whether the `/` SPA fallback (`renderPath '*'`) should stay. It serves the index for unknown paths, which hides API 404s under the same origin.

## Outcome

Adopted by [decision 17](../roadmap/PROPOSAL.md#decision-log) in `docs/roadmap/PROPOSAL.md`. `api-gateway` stays SEA-agnostic. `sea-runtime` extracts the assets and passes `--web-root`. POC-4 owns the 404 rule for unknown paths. That replaces the Recommendation above, which asked for the decision before POC-3.

QC notes:

- SIGTERM leaves the extracted cache on disk.
- With `TMPDIR` unset, the cache falls back to `/tmp`.
- The second start reuses the directory unchanged.
- `/nope` returns 200 with the index.

Superseded in part by [POC-1f Web from memory](POC-01f-web-from-memory.md): the supervisor no longer extracts the tree or passes `--web-root`. It sends the files over IPC (`--web ipc`) and `api-gateway` serves them from memory without `@nestjs/serve-static`.
