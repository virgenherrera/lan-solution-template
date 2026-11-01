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

Slice 1d of POC-1, delivered on branch `minor/poc-01d-angular-link`. This is the same branch and PR as the SPA spike and the decision 17 docs. The branch choice is a human decision; the backlog named the same branch. Backlog: [POC-1d](../backlog/poc-1d-angular-link.md). Previous slice: [POC-1c](POC-01c-Result.md).

## Summary

- `web-angular` was generated with the Angular CLI (`ng new`). It has Tailwind, light and dark themes selected by `data-theme`, and a splash removed by `provideAppInitializer`.
- Public and private routes are lazy. The private routes sit inside a shell and use a guard. The guard and the session signal are PLACEHOLDER code until POC-7.
- Dev: `/api` is proxied to `127.0.0.1:3000` (`api-gateway`) through `proxy.conf.json`.
- Packaged: `sea-runtime` embeds the `web-angular` browser output and passes `--web-root` to `api-gateway`. The binary serves the Angular index and its JS chunks over plain HTTP.
- `compile-sea.ts` classifies each workspace dependency of `sea-runtime`. This settles decision 17, open item 2. See [Classification rule](#classification-rule).
- Observed on macOS arm64 only. A headless Chromium check ran against the packaged binary. See [Browser check](#browser-check-playwright). Not verified: phone width, keyboard and focus, Lighthouse, other browsers, and the splash look. See [Not verified](#not-verified).

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

- Deviation: delivered on `minor/poc-01d-angular-link` together with the SPA spike and decision 17 in ONE PR (human decision).
- `@angular/core` runtime packages are pinned to `22.2.4`. Version `22.2.5` was not in the registry when checked. [REQ-STACK-05](../requirements/02-technology-baseline.md) says `>=22.2.5`. The CLI and the build use `22.2.5`. Decision needed: keep `22.2.4` or wait.
- Tailwind uses a manual `.postcssrc.json`, as the Tailwind guide describes. `ng add` was not used because it writes version ranges.
- `pnpm add -D web-angular --workspace` added peer suffixes (`jiti`, `sass`, `sass-embedded`) to the `vite` and `vitest` lockfile entries. About 54 lines removed and 9 added.
- `pnpm` peers check warns about unmet `@emnapi/core` and `@emnapi/runtime` through the Tailwind wasm dependencies of `web-angular`. Not investigated.
- The `package` target has no cache enabled. It runs on every call.
- `api-gateway` serves health at `/health`. The POC-2 pitch plans an `/api` health endpoint, citing [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md). REQ-NET-01's own text names no health path. The prefix is owned by POC-2.
- Unknown paths return the index with 200. POC-4 owns the 404 rule.
- The extracted web cache is under the OS temp directory (`lan-web-tree/<hash>`). It survives SIGTERM. Cleanup and the cache location move are POC-4 and POC-3 work.

## Audit fix

Commit `d68f349` fixes the `pnpm audit` findings on this branch. Before the fix, `pnpm audit` reported 43 advisories. After it, it reports 0 in every severity.

| Severity | Before | After |
|---|---|---|
| critical | 0 | 0 |
| high | 14 | 0 |
| moderate | 21 | 0 |
| low | 8 | 0 |
| total | 43 | 0 |

Mechanism:

- `pnpm audit --fix` wrote the overrides to `pnpm-workspace.yaml`. pnpm 12 updated `pnpm-lock.yaml` during install.
- The advisory ids in the comments (GHSA) were added by hand.
- A second pass was needed. A narrower `undici` override left high advisories open. `tmp` needed 0.2.7.

Overrides, copied from `pnpm-workspace.yaml`:

```yaml
overrides:
  minimatch@<11.0.1: 11.0.1 # GHSA-g3hv-75wg-m249 (moderate); remove once the parent ships a fix
  qs@>=6.7.0 <=6.16.0: 6.16.1 # GHSA-6pq8-jhm2-2vcw (moderate); remove once the parent ships a fix
  tmp@<0.2.7: 0.2.7 # GHSA-ph9p-34f9-6g65, GHSA-7c78-jf6q-g5cm (high), GHSA-52f5-9888-hmc6 (low); remove once the parent ships a fix
  undici@>=4.0.0 <6.29.1: 6.29.1 # GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm, GHSA-f269-vfmq-vjvj, GHSA-vrm6-8vpv-qv8q (high) and undici 6.x moderate/low ids; remove once the parent ships a fix
  undici@>=7.0.0 <7.30.1: 7.30.1 # GHSA-4w7w-5xrc-9h26, GHSA-xjj6-f33q-929c, GHSA-w293-vg96-wgc3 (high) and undici 7.x moderate/low ids; remove once the parent ships a fix
```

Rule: remove each override once the parent package ships a fix. `auditConfig.ignoreCves` stays empty. No advisory is ignored.

Verification:

- `pnpm install --frozen-lockfile` in the main tree: exit 0.
- Fresh clone of `d68f349`, then `pnpm install --frozen-lockfile`: exit 0, no `ERR_PNPM_IGNORED_BUILDS`.
- `NX_DAEMON=false pnpm build` and `NX_DAEMON=false pnpm package`: exit 0.
- `pnpm audit --audit-level=high`: exit 0.
- Packaged binary, run under `env -i PATH=/usr/bin:/bin`: `GET /` returns 200 with title `web-angular`. `GET /health` returns 200. SIGTERM left no process. Port 3000 is free.

Not verified:

- A peer-dependency warning printed by the install was not checked for being older than this change.

## Browser check (Playwright)

A throwaway script drove headless Chromium against the packaged binary. The script stayed outside the repo and is not committed. No image is added to the repo.

Setup:

- Playwright 1.64.1 and Chromium headless shell 156.0.8078.4 (browser cache 203 MB on disk).
- Binary `artifacts/sea-runtime/sea-runtime-aarch64-apple-darwin`, started with `env -i PATH=/usr/bin:/bin`, no arguments.
- Viewport 1280x800 only.

Observed:

- Console errors: 0. Page errors: 0. Failed requests: 0. Responses with 4xx or 5xx: 0.
- The splash is in the raw server HTML. It is gone from the DOM when the page is ready.
- Titles: `web-angular`. Headings: `Welcome` on `/`, `About` on `/about`, `Dashboard` on `/dashboard`, `Settings` on `/settings`.
- Guard: a direct load of `/dashboard` or `/settings` redirects to `/`.
- Enter on `/` (placeholder session) opens `/dashboard`. The nav links render `Dashboard` and `Settings`.
- Lazy chunks: the first load fetches 2 JS files. The session ends with 5 unique JS files.
- Theme: the toggle from light to dark sets `data-theme` to `dark`. The body background changes from `rgb(248, 250, 252)` to `rgb(11, 18, 32)`. The value persists across reload through `localStorage`.
- A full reload on a private route returns to `/`. The session flag is in memory only.
- Deep link `/about` loads directly and renders `About`.
- Read timing: the toggle label updates a few ms after a click. A read taken right after the click can show the old label. Not investigated.
- Screenshots: four, light and dark, for the welcome and dashboard pages. They are kept outside the repo. No visual review is recorded for them.

Not checked in this run: phone width, keyboard and focus, Lighthouse, Firefox and WebKit, Windows and Linux browsers. The dev server run is in the Dev server subsection below.

Next: turning this check into a repo app or E2E test belongs to a later testing slice under REQ-TEST. It is not part of 1d. The sibling repos use Playwright 1.61.0 in their catalog (observed earlier). This check used 1.64.1 from a scratch install, so the versions differ.

### Dev server

Same Playwright 1.64.1 and Chromium headless shell as above. Viewport 1280x800 only. The script was copied and its base URL set to `http://127.0.0.1:4200`.

Setup:

- Angular dev server: `pnpm run start --host 127.0.0.1 --port 4200` in `apps/web-angular` (script `ng serve`).
- api-gateway dev build on `127.0.0.1:3000`, started without `--web-root`. Its `/` returns 404.

Observed:

- Splash: present in the raw HTML and in the DOM at page commit (1 element). Gone when the `h1` was visible, 81 ms after the wait began.
- Headings: `Welcome` on `/`. `About` on nav click and on a deep link. `Dashboard` after Enter. `Settings` and `Dashboard` on nav clicks.
- Guard: a direct load of `/dashboard` or `/settings` redirects to `/`.
- Theme: light to dark sets `data-theme` to `dark`. The body background changes from `rgb(248, 250, 252)` to `rgb(11, 18, 32)`. A reload on `/dashboard` redirects to `/`. The dark value persists.
- Flow run errors: console errors 0, page errors 0, failed requests 0, responses with 4xx or 5xx 0.
- Proxy: from the page, `/api/health` and `/api/x` return 404 with `Content-Type: application/json` and the Nest body `{"message":"Cannot GET /api/health","error":"Not Found","statusCode":404}` (the `/api/x` body has the same shape). The body comes from api-gateway, so the proxy reaches it.
- `/health` on port 4200 is not proxied. It returns 200 `text/html`, the Angular index.
- Direct to api-gateway on port 3000: `/health` returns 200. `/api/x` returns 404 with the same Nest body shape.
- api-gateway exposes `/health` only. No `/api/health` route exists yet. REQ-NET-01 (`docs/requirements/06-web-gateway-https-pwa.md`) does not name a health path.
- Dev-only output, listed as seen:
  - Vite client console messages `[vite] connecting...` and `[vite] connected.` (debug level).
  - A Vite WebSocket to `/?token=...` opened. Its frames were not inspected.
  - `Angular is running in development mode.` (log level).
  - Two `Failed to load resource: 404` console errors. They come from the two deliberate 404 fetches in the probe, not from the app. The flow run had none.
  - The `ng serve` log has no warnings or errors. It shows one line, `Re-optimizing dependencies because lockfile has changed`, at start.
  - The flow run recorded errors only. Other console levels were captured only in the probe, on `/`.
- Toggle label lag: a read right after a click showed the old label (for example `Theme: light` with `data-theme` set to `dark`). The packaged run showed the same lag.

Differences from the packaged run:

- First load JS: packaged 2 files. Dev 8 requests: `main.js`, two `chunk-*.js`, and five Angular or vendor modules (`@angular_core.js`, `@angular_router.js`, `@angular_platform-browser.js`, `platform-browser-*.js`, `core-*.js`). The dev server serves modules unbundled.
- Whole flow: 11 unique JS files in dev, 5 packaged. Lazy chunk names differ between the runs. Names are not comparable.
- Splash at commit: 1 element in dev. The packaged check did not prove this point (count 0 at commit, too early to read).
- Time to `h1`: 81 ms in dev, 10 ms packaged. One run each. Not a timing benchmark.

Not verified in the dev run: hot reload after a file change, WebSocket frames, phone width, keyboard and focus.

## Not verified

- Phone width. The browser check ran at 1280x800 only.
- Keyboard and focus behaviour.
- Lighthouse.
- Firefox, WebKit, Windows and Linux browsers.
- The splash look. Its presence in the HTML and its removal from the DOM were checked, not its visual.
- The Tauri bundle part of REQ-BUILD-05. It is checked in POC-1e.
- Linux and Windows builds in this slice.
- The Angular dev server script name.
- Whether the `pnpm` peers warning affects the build.

## Open items

- Angular runtime `22.2.4` or `22.2.5` (see Deviations).
- `/health` path and its prefix (see Deviations).
- Cache location (POC-3) and cleanup and 404 rule (POC-4).
- `@emnapi` peers warning (not investigated).
