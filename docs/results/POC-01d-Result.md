<!-- toon-meta
fmt: TOON
doc: docs/results/POC-01d-Result.md
title: "POC-1d Result"
type: backlog
summary: "Result of POC-1d: web-angular generated with the Angular CLI and linked to sea-runtime, so the SEA serves its build over plain HTTP through api-gateway."
related[2]: docs/backlog/poc-1d-angular-link.md,docs/results/POC-01c-Result.md
status: current
updated: 2026-10-31
-->

# POC-1d Result

Slice 1d of POC-1, delivered on branch `chore/spike-spa-serving`. This is the same branch and PR as the SPA spike and the decision 17 docs. The branch choice is a human decision; the backlog named `minor/poc-01d-angular-link`. Backlog: [POC-1d](../backlog/poc-1d-angular-link.md). Previous slice: [POC-1c](POC-01c-Result.md).

## Summary

- `web-angular` was generated with the Angular CLI (`ng new`). It has Tailwind, light and dark themes selected by `data-theme`, and a splash removed by `provideAppInitializer`.
- Public and private routes are lazy. The private routes sit inside a shell and use a guard. The guard and the session signal are PLACEHOLDER code until POC-7.
- Dev: `/api` is proxied to `127.0.0.1:3000` (`api-gateway`) through `proxy.conf.json`.
- Packaged: `sea-runtime` embeds the `web-angular` browser output and passes `--web-root` to `api-gateway`. The binary serves the Angular index and its JS chunks over plain HTTP.
- `compile-sea.ts` classifies each workspace dependency of `sea-runtime`. This settles decision 17, open item 2. See [Classification rule](#classification-rule).
- Observed on macOS arm64 only. Not verified: rendering in a real browser, Lighthouse, and the splash visual. See [Not verified](#not-verified).

## Commits

| Commit | Subject |
|---|---|
| `31ad9ec` | chore: generate and pin web-angular |
| `042db56` | feat: add Tailwind theming and splash to web-angular |
| `3b97cf1` | feat: add routes, layout, guard and screens to web-angular |
| `1878f44` | feat(sea-runtime): register web-angular and classify build outputs |
| `4bc1758` | chore(sea-runtime): remove spike web dummy tree |
| `124ebc6` | chore: declare pnpm supply-chain trust policy in workspace |

## How to run

Dev. Run the Angular dev server on `127.0.0.1:4200`. The script name is not verified.

Observed:

- `curl` on `http://127.0.0.1:4200/` returned `HTTP/1.1 200 OK` with title `web-angular`.
- `/api/x` on port 4200 reached `api-gateway`. The gateway answered with a Nest 404 JSON body. The proxy has no path rewrite.
- `/dashboard` on port 4200 returned 200 with the index (SPA fallback).

Packaged:

```sh
pnpm nx package sea-runtime
env -i PATH=/usr/bin:/bin artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/health
```

Observed:

- `which node` with `PATH=/usr/bin:/bin` returned nothing (exit 1).
- `/` returned 200 with the `web-angular` index.
- `/main-IYRPS55C.js` and a lazy chunk returned 200 with `text/javascript`.
- `/dashboard` returned 200 with the index. Unknown paths fall back to the index. POC-4 owns the 404 rule.
- `/health` returned 200.
- Processes: a supervisor with no arguments and a child `--service api-gateway --web-root <dir>`. Both run the executable, not `node`.
- SIGTERM to the supervisor stopped the child. `pgrep` found nothing. Port 3000 was free.

## Build order (Nx)

Observed order of the run:

1. `web-angular:build`
2. `api-gateway:build`
3. `sea-runtime:build`
4. `sea-runtime:package`

`web-angular` is a workspace dependency of `sea-runtime`, so `^build` covers it. The backlog task said this link was still open. The state at `1878f44` is the link.

## Classification rule

`tools/scripts/compile-sea.ts` reads the workspace dependencies of `sea-runtime` and classifies each one:

- A folder with `dist/main.js` is a service.
- A folder with Angular browser output that contains `index.html` is the web bundle.
- At most one web bundle is allowed. Zero is allowed: no assets and no `--web-root`.
- Any other output is an error. The error names the project.

The web bundle path is `apps/web-angular/dist/web-angular/browser`. It has 8 files and 252200 bytes.

## Nx cache experiment (REQ-BUILD-05, SEA part)

| Run | `web-angular:build` | `package` |
|---|---|---|
| Unchanged inputs, re-run | local cache hit | executed |
| One string changed in `about.html` | cache miss, executed | executed. SHA-256 changed |
| `about.html` reverted with `git checkout` | local cache hit | executed |

The `package` target has no cache enabled, so it always runs. The Angular build cache behaved as expected. No Nx input change was needed for this check.

Binary hash is weak evidence. With unchanged inputs, three `package` runs gave three different SHA-256 values (prefixes `84ce2f21`, `4ebedcbf`, `5d720d08`). The binary is not reproducible. A changed hash shows the file changed, but not that the content is the expected build.

Chunk names are content hashes. They change when the code changes. Do not treat them as stable names. Examples from the run:

- `main-IYRPS55C.js`
- lazy chunks: `chunk-BY6KNIC_.js` (welcome), `chunk-DamK4b1j.js` (dashboard), `chunk-CtDyav3c.js` (settings), `chunk-CIaLv8Py.js` (about)

## Sizes

| Item | Bytes |
|---|---|
| Binary `artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin` | 148126432 |
| Web bundle (8 files) | 252200 |
| Spike dummy tree removed | 66182 |
| Net change in the asset total | +186018 |

The sizes come from one run each. They are not a baseline for other platforms.

## Manual edits (no CLI generated them)

| # | File | Edit | Reason |
|---|---|---|---|
| 1 | `apps/web-angular/package.json` | `test` script is a no-op (`echo`, exit 0), same wording as `api-gateway` | No unit or integration suites |
| 2 | `apps/web-angular/tsconfig.spec.json` | Deleted | Leftover; no test target |
| 3 | `pnpm-workspace.yaml` | `allowBuilds` entries for `@parcel/watcher`, `lmdb` and `msgpackr-extract` | pnpm build-script trust decisions |
| 4 | `apps/web-angular/.postcssrc.json` | New. Tailwind PostCSS plugin | Tailwind guide; `ng add` would write version ranges |
| 5 | `apps/web-angular/src/styles.css` | Theme variables and `@theme inline` | Tailwind theming |
| 6 | `apps/web-angular/src/index.html` | Title, inline theme script, splash CSS and markup | Splash and theme before first paint |
| 7 | `apps/web-angular/src/app/app.config.ts` | `provideAppInitializer` removes the splash | Splash removal |
| 8 | `apps/web-angular/src/app/core/theme-service.ts` | Body | Light and dark themes |
| 9 | `apps/web-angular/src/app/core/session.ts` | Body. PLACEHOLDER session signal | Auth is POC-7 |
| 10 | `apps/web-angular/src/app/core/auth-guard.ts` | Body. PLACEHOLDER guard | Auth is POC-7 |
| 11 | `apps/web-angular/src/app/app.ts`, `app.html` | Bodies | Generated stubs |
| 12 | `apps/web-angular/src/app/app.routes.ts` | Lazy routes, shell children, guard | Routing |
| 13 | `apps/web-angular/src/app/layout/shell/shell.ts`, `shell.html` | Header nav and theme toggle | Layout |
| 14 | `apps/web-angular/src/app/pages/` | Welcome, about, dashboard and settings templates | Screens |
| 15 | `apps/web-angular/angular.json` | Serve options `proxyConfig` | Dev proxy |
| 16 | `apps/web-angular/proxy.conf.json` | New. `/api` to `http://127.0.0.1:3000`, no path rewrite | Dev proxy |
| 17 | `tools/scripts/compile-sea.ts` | Classification of service and web bundle. Spike `webDir` replaced by the real browser output | Decision 17 |
| 18 | `tools/spike/web-dummy` | Deleted (`4bc1758`) | Replaced by `web-angular` |
| 19 | `pnpm-workspace.yaml` | `allowBuilds` for `esbuild`, `nx` and `@nestjs/core`, with the trust policy (`124ebc6`) | Trust policy |
| 20 | `apps/web-angular/README.md` | Deleted (`git rm`) | CLI-generated file without a toon-meta block breaks the documented metadata chain; same as the Nest apps |

Manual edits 1 to 16 come from the generated-app report. Edits 17 to 19 come from the link report and the policy commit. Edit 20 is a coordinator decision: the Nest apps' generated READMEs were removed for the same reason.

## Deviations

- Branch: `chore/spike-spa-serving`, not `minor/poc-01d-angular-link`. Human decision: one PR with the spike and the decision 17 docs.
- `@angular/core` runtime packages are pinned to `22.2.4`. Version `22.2.5` was not in the registry when checked. [REQ-STACK-05](../requirements/02-technology-baseline.md) says `>=22.2.5`. The CLI and the build use `22.2.5`. Decision needed: keep `22.2.4` or wait.
- Tailwind uses a manual `.postcssrc.json`, as the Tailwind guide describes. `ng add` was not used because it writes version ranges.
- `pnpm add -D web-angular --workspace` added peer suffixes (`jiti`, `sass`, `sass-embedded`) to the `vite` and `vitest` lockfile entries. About 54 lines removed and 9 added.
- `pnpm` peers check warns about unmet `@emnapi/core` and `@emnapi/runtime` through the Tailwind wasm dependencies of `web-angular`. Not investigated.
- The `package` target has no cache enabled. It runs on every call.
- `api-gateway` serves health at `/health`. [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md) names an `/api` health path. Not verified whether the prefix is POC-2 or POC-4 scope.
- Unknown paths return the index with 200. POC-4 owns the 404 rule.
- The extracted web cache is under the OS temp directory (`lan-web-tree/<hash>`). It survives SIGTERM. Cleanup and the cache location move are POC-4 and POC-3 work.

## Not verified

- Rendering in a real browser. Only `curl` checks ran.
- Lighthouse and the splash visual.
- The Tauri bundle part of REQ-BUILD-05. It is checked in POC-1e.
- Linux and Windows builds in this slice.
- The Angular dev server script name.
- Whether the `pnpm` peers warning affects the build.

## Open items

- Angular runtime `22.2.4` or `22.2.5` (see Deviations).
- `/health` path and its prefix (see Deviations).
- Cache location (POC-3) and cleanup and 404 rule (POC-4).
- `@emnapi` peers warning (not investigated).
