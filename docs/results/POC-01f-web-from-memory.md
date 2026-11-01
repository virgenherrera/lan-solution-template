<!-- toon-meta
fmt: TOON
doc: docs/results/POC-01f-web-from-memory.md
title: "POC-1f Web from memory"
type: backlog
summary: "Result: the SEA serves the Angular web from memory over IPC, with no extraction to the temp directory."
ids[0]:
related[2]: docs/results/SPIKE-spa-serving.md,docs/standards/README.md
status: current
updated: 2026-10-31
-->

# POC-1f Web from memory

Branch: `minor/web-from-memory`. Question: can the packaged binary serve the Angular web without extracting it to `<tmpdir>/lan-web-tree`, while `api-gateway` stays SEA-agnostic?

## Summary

- Yes. The supervisor reads each embedded file with `getRawAsset`, checks its sha256 once, and sends all files to the `api-gateway` child in one IPC message. Nothing is written to disk.
- `api-gateway` has no `node:sea` import and reads no `process.env`. It takes `--web none|ipc` from argv (default `none`).
- The gateway serves the files from an immutable `Map` with its own middleware. `@nestjs/serve-static` is removed.
- Paths under `/api` never fall back to the index: `/api/nope` stays 404.

## Design

| Part | Behaviour |
| --- | --- |
| Supervisor | `hasWebBundle()` checks the `web-manifest.json` asset. `loadWebBundle()` Zod-validates it, reads `web/<path>` with `getRawAsset` and verifies each hash. The api-gateway child is spawned with `stdio: ['inherit','inherit','inherit','ipc']`, `serialization: 'advanced'` and args `--service api-gateway --web ipc`. No bundle means no `--web` flag and no IPC channel. |
| Gateway receive | With `--web ipc` it waits for exactly one `{ kind: 'web-bundle', files }` message, validated by Zod (`Uint8Array` bytes, relative path, no `..`, no leading `/`). It times out after 10 s, then calls `process.disconnect()`. A missing channel, an invalid message, a closed channel or a timeout stops the process before the port opens. |
| Gateway serve | `app.use` middleware on the `NodeAdapter`. GET and HEAD only. Exact file match first, then `index.html` for any other path outside `/api`. Other methods and `/api` paths go to the next handler. |
| Headers | Hashed names (`-XXXXXXXX.ext`, 8 upper-case alphanumerics) get `public, max-age=31536000, immutable`. `index.html` and unhashed files get `no-cache`. Content type comes from an extension table with an `application/octet-stream` fallback. |

## Observed outputs

Packaged binary on `127.0.0.1:3000`, started with no arguments:

| Request | Result |
| --- | --- |
| `GET /` | 200 `text/html; charset=utf-8`, `Cache-Control: no-cache` |
| `GET /main-IYRPS55C.js` | 200 `text/javascript; charset=utf-8`, 223950 bytes, `public, max-age=31536000, immutable` |
| `GET /api/health` | 200 `application/json` |
| `GET /api/nope` | 404 |
| `GET /some/spa/route` | 200 `text/html` (index) |
| `HEAD /` | 200 `text/html` |
| `POST /` | 404 |

- `pnpm run build`, `pnpm run test` and `PATH=/opt/homebrew/opt/rustup/bin:$PATH pnpm exec nx run sea-runtime:package`: exit 0.
- Listing of the OS temp directory before start and after SIGTERM: identical. No `pgrep -f artifacts/sea-runtime` match after SIGTERM.
- `rg -n lan-web-tree apps tools` and `rg -n node:sea apps/api-gateway/src`: no match.
- Dev path, `node apps/api-gateway/dist/main.js` with no flag: `GET /` 404, `GET /api/health` 200.
- `node apps/api-gateway/dist/main.js --web ipc` with no parent: exit 1 with `--web ipc needs an IPC channel from the parent process, but there is none`.

## Files and the command that wrote them

| File | Written by |
| --- | --- |
| `apps/api-gateway/package.json`, `pnpm-lock.yaml` | `pnpm --filter api-gateway remove @nestjs/serve-static` |
| `apps/api-gateway/src/web-bundle.ts` | manual (no CLI generates it) |
| `apps/api-gateway/src/web-handler.ts` | manual (no CLI generates it) |
| `apps/api-gateway/src/main.ts`, `app.module.ts`, `server-config.ts` | manual edit of CLI-generated files |
| `apps/sea-runtime/src/web/web-bundle.ts` | manual (no CLI generates it) |
| `apps/sea-runtime/src/supervisor/supervisor.service.ts` | manual edit |
| `apps/sea-runtime/src/web/web-tree.ts` | deleted with `git rm` |
| `tools/scripts/compile-sea.ts` | manual edit (comments only) |
| `docs/results/POC-01f-web-from-memory.md` | manual |
| `docs/results/SPIKE-spa-serving.md` | manual (supersede note) |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

## Risks

- Memory: the gateway holds a full copy of the bundle (the IPC serialization copies the bytes), and the supervisor holds views into the executable. Not measured for a large SPA.
- Any unknown path outside `/api` returns the index with 200, including a missing `.js` or `.css`. A mistyped asset URL shows the app shell, not 404. POC-4 owns the 404 rule.
- The hash pattern assumes Angular's `-XXXXXXXX` naming. Another builder gets `no-cache`, which is safe but slower.
- The 10 s receive timeout is a fixed constant. A slow start on weak hardware is not tested.
- Requirement text in `docs/requirements/06-web-gateway-https-pwa.md` and `11-nx-quality-testing.md` still names `ServeStaticModule`, `--web-root` and the temp extraction. It is not updated here. Not verified against the SRS owner.
- Only macOS arm64 was tested.

## Scratch

Created outside the repo: `/private/tmp/claude-501/-Users-hugovirgen-projects-nodejs-lan-solution-template/a23ed390-65df-4aa4-9adb-f62ab60d62e1/scratchpad/` (`probe.sh`, `dev.sh`, `logs/`, `tmp.before`, `tmp.after`, `main.name`).
