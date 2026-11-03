<!-- toon-meta
fmt: TOON
doc: docs/results/SPIKE-third-party-licenses.md
title: "SPIKE third-party license notices"
type: backlog
summary: "Spike: which third-party licenses ship in the SEA and Tauri artifacts, what they require, and how to bundle notices."
ids[0]:
related[5]: docs/backlog/third-party-licenses.md,docs/results/SPIKE-spa-serving.md,docs/requirements/10-node-sea-distribution.md,docs/roadmap/PROPOSAL.md,docs/standards/README.md
status: current
updated: 2026-11-03
-->

# SPIKE third-party license notices

Superseded 2026-11-03: the recommendation to generate and embed `THIRD-PARTY-NOTICES.txt` is not built. The template ships documentation only. See [Third-party license notices](../backlog/third-party-licenses.md).

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md)

Branch: `chore/third-party-licenses`. Question: should the repo bundle the licenses of its dependencies with what it ships, and how? This page is engineering research. It is not legal advice. Ask a lawyer before you rely on it.

## Navigation

- [Summary](#summary)
- [Q1: is `"license": "PostgreSQL"` valid](#q1-is-license-postgresql-valid)
- [Q2: what ships to users](#q2-what-ships-to-users)
- [Q3: the measured license set](#q3-the-measured-license-set)
- [Q4: what the licenses require](#q4-what-the-licenses-require)
- [Q5: options to produce the notices](#q5-options-to-produce-the-notices)
- [Q6: recommendation](#q6-recommendation)
- [Not verified](#not-verified)

---

## Summary

[Back to navigation](#navigation)

- `"license": "PostgreSQL"` is a valid SPDX identifier. npm documents SPDX identifiers for this field. The `LICENSE` text matches the SPDX template; only the permitted replaceable parts differ.
- The measured production set is 118 package versions (110 names): MIT 106, ISC 5, BSD-3-Clause 3, Apache-2.0 2, 0BSD 2. No missing, `UNKNOWN`, copyleft or source-available license.
- Every license in the set asks for the notice to travel with binary copies, except 0BSD. So yes: ship the notices.
- The Angular build already writes `3rdpartylicenses.txt`. `compile-sea` embeds only `browser/`, so that file is dropped today.
- Recommendation: one generated `THIRD-PARTY-NOTICES.txt` embedded as a SEA asset, plus a copy next to the artifact. See [Q6](#q6-recommendation).

---

## Q1: is `"license": "PostgreSQL"` valid

[Back to navigation](#navigation)

Yes. Evidence:

- SPDX license-list-data (`licenseListVersion` `12.2.1`, release `2026-10-28T00:00:00Z`, commit `8791eda`) lists `PostgreSQL`: `name` "PostgreSQL License", `isOsiApproved` `true`, `isDeprecatedLicenseId` `false`. Command: `curl -sfL https://raw.githubusercontent.com/spdx/license-list-data/main/json/details/PostgreSQL.json | jq '{licenseId,name,isOsiApproved,isDeprecatedLicenseId}'`. Page: https://spdx.org/licenses/PostgreSQL.html.
- npm documents the field: "add a current SPDX license identifier for the license you're using", and "Ideally, you should pick one that is OSI approved" (https://docs.npmjs.com/cli/v11/configuring-npm/package-json#license). `PostgreSQL` is OSI approved.
- `pnpm install --frozen-lockfile` in this repo printed no warning, error or license line (`| grep -i -E 'warn|licen|deprec'` matched nothing). `npm` here fails earlier with `EBADDEVENGINES` (the root `devEngines` pins pnpm), so no npm result exists. pnpm validation of the field: not verified beyond that run.
- The eight `package.json` files all use `"license": "PostgreSQL"` (root, 4 apps, 3 libs).

`LICENSE` against the canonical text (`licenseText` from the SPDX JSON, word-level `diff` after splitting on whitespace). Every difference:

| Canonical | Repo `LICENSE` | Verdict |
| --- | --- | --- |
| Header lines "PostgreSQL Database Management System (formerly known as Postgres, then as Postgres95)" | absent | Optional in the SPDX template (`<<beginOptional>>`) |
| none | title line "PostgreSQL License" | Added title; the SPDX HTML page marks omittable text and variants as matching |
| "Portions Copyright (c) 1996-2010, The PostgreSQL Global Development Group" and "Portions Copyright (c) 1994, The Regents of the University of California" | "Copyright (c) 2026, Hugo Virgen" | The `copyright` field is a template variable (`match=".{0,5000}"`) |
| "THE UNIVERSITY OF CALIFORNIA" (4 places) | "HUGO VIRGEN" (4 places) | Template variables `copyrightHolderLiability`, `copyrightHolderAdvised`, `copyrightHolderDisclaims`, `copyrightHolderAsIs` (`match=".+"`) |

Nothing else differs. The three operative paragraphs are word for word the canonical text. Whether the SPDX matching rules (https://spdx.dev/licenses/matching-guidelines/ was not fetched) call the title line a match: not verified. The SPDX page says text with permitted variants matches.

Does the license need the notice "in all copies", binary included? The permission paragraph says (same text in the repo `LICENSE` and the canonical text):

> "Permission to use, copy, modify, and distribute this software and its documentation for any purpose, without fee, and without a written agreement is hereby granted, provided that the above copyright notice and this paragraph and the following two paragraphs appear in all copies."

"All copies" does not limit itself to source. Whether a binary distribution counts as a copy: legal question, not verified. The safe reading is yes. This applies to this project's own license too: the shipped artifacts should carry `LICENSE`.

---

## Q2: what ships to users

[Back to navigation](#navigation)

### (a) `artifacts/sea-runtime/*`

Observed inputs: `tools/scripts/compile-sea.ts`, `tools/rspack/nest.config.ts`, the package manifests.

| Component | Evidence | License | What it brings |
| --- | --- | --- | --- |
| Node.js runtime (SEA base binary, v26.13.0) | The SEA copies a Node executable | The Node `LICENSE` at tag `v26.13.0` is 2,923 lines. It lists 43 bundled third-party components (`grep -c '^- '`), for example Acorn, c-ares, ICU, libuv | Node's own license text plus its bundled-components list. Source: https://raw.githubusercontent.com/nodejs/node/v26.13.0/LICENSE |
| rspack bundle `sea-app.mjs` | `externals` only treats Node builtins as external (`nest.config.ts`); `webpack-node-externals` is a root devDependency but `compile-sea.ts` does not use it. Every npm package reachable from the entry is therefore inside the bundle | see [Q3](#q3-the-measured-license-set) | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-node`, `rxjs`, `zod`, `reflect-metadata` and their transitive packages |
| Embedded web bundle (`web/<path>` assets) | `compile-sea.ts` embeds `<web>/browser/**` | see [Q3](#q3-the-measured-license-set) | Angular packages, `rxjs`, `tslib`, `zod` (see Q3) |
| `sqlite-vector` 1.1.2 native extension | `tools/vector/sqlite-vector-1.1.2.json`; embedded as asset `sqlite-vector/<file>` | Apache-2.0 | See below |
| SQLite (`node:sqlite`) | Built into the Node binary | Public domain | SQLite states "SQLite is in the Public Domain" (https://sqlite.org/copyright.html). No notice obligation stated there |

Not bundled (observed): `drizzle-orm` and `drizzle-kit` are `devDependencies` of `libs/db-migrations`; the shipped code does not import them (`rg drizzle` over `apps/sea-runtime/src`, `libs/shared-core/src`, `libs/db-migrations/contract` finds only strings and comments). The IgnorePlugin in `nest.config.ts` removes `@nestjs/microservices`, `@nestjs/websockets`, `@nestjs/platform-express`, `class-validator` and `class-transformer`. Which exact modules end up inside `sea-app.mjs`: not verified (no rspack stats were generated). The Q3 numbers are an upper bound.

`sqlite-vector` 1.1.2:

- Upstream tag `1.1.2` of https://github.com/sqliteai/sqlite-vector has `LICENSE.md` with the Apache License 2.0, "Copyright 2026 - SQLite Cloud, Inc." GitHub API reports SPDX `Apache-2.0`. The README says "licensed under the Apache License 2.0".
- npm registry metadata of `@sqliteai/sqlite-vector-darwin-arm64@1.1.2`: `"license": "Apache-2.0"`. The tarball holds `package/LICENSE.md`, `vector.dylib`, `index.js`, `package.json`, `README.md`. The repo downloads the tarball; the build embeds the `.dylib`/`.so`, not the license file.
- Apache-2.0 section 4 asks a redistributor to give recipients a copy of the License and to carry a readable copy of any `NOTICE` text. The upstream tag 1.1.2 root listing has `LICENSE.md` and no `NOTICE` file (filtered root listing through the GitHub contents API).
- The tag vendors `libs/fp16/*.h` (3 headers, no license file in that folder) and `libs/sqlite3.*`. License of the FP16 headers: not verified.

### (b) Tauri desktop shell (`apps/desktop/src-tauri`)

- `Cargo.lock` holds 414 `[[package]]` entries (`grep -c '^\[\[package\]\]'`). `Cargo.toml` has `license = ""` (empty). `tauri.conf.json` has `bundle.externalBin: null` and `resources: null`.
- The crate licenses were not collected. Rust tooling was not installed. Normal practice: `cargo-about` (https://embarkstudios.github.io/cargo-about/) generates a license listing for a crate's dependencies. `cargo-license` is the other common tool: not verified.
- The WebView is the operating system's (WKWebView, WebView2, WebKitGTK) and is not shipped by this repo: not verified. The sidecar wiring (`externalBin`) is still null, so what a final bundle contains is open.

---

## Q3: the measured license set

[Back to navigation](#navigation)

Commands (from the repo root, after `pnpm install --frozen-lockfile`):

```sh
pnpm licenses list --prod --json -C apps/sea-runtime
pnpm licenses list --prod --json -C apps/api-gateway
pnpm licenses list --prod --json -C apps/web-angular
```

`pnpm licenses --help` shows `--json`, `--prod`, `--dev` and `-C/--dir`. It has no per-package filter. At the workspace root, `pnpm licenses list --prod --json` printed 3 bytes (an empty result), because the root has no `dependencies`. The per-app `-C` form returned: sea-runtime 94 packages, api-gateway 104, web-angular 10. All exit codes were 0.

Why two server apps: `apps/sea-runtime` lists `api-gateway` and `web-angular` as `devDependencies` (build ordering), but the SEA bundles `api-gateway` and the web bundle. So the shipped set is the union of sea-runtime, api-gateway and web-angular production dependencies. Libraries (`shared-core`, `service-registry`, `db-migrations`) add only `rxjs` and `zod`, already in the set.

Union, counted by `name@version` (script: read each JSON, dedupe):

| License | Package versions |
| --- | --- |
| MIT | 106 |
| ISC | 5 |
| BSD-3-Clause | 3 |
| Apache-2.0 | 2 |
| 0BSD | 2 |
| Total | 118 (110 distinct names; `tslib` has 2.8.1 and 2.9.1) |

Non-MIT members: Apache-2.0 `reflect-metadata@0.2.2`, `rxjs@7.8.2`; BSD-3-Clause `ieee754@1.2.1`, `qs@6.16.1`, `secure-json-parse@4.1.0`; ISC `inherits@2.0.4`, `iterare@1.2.1`, `once@1.4.0`, `setprototypeof@1.2.0`, `wrappy@1.0.2`; 0BSD `tslib` (both versions).

Findings:

- Missing or `UNKNOWN` license: none (`jq` for `null` or `UNKNOWN` returned nothing).
- GPL, LGPL, AGPL, MPL, EPL, SSPL, Elastic, BUSL, Commons Clause: none in the set. `sqlite-vector` is Apache-2.0 (Q2).
- No MIT/ISC package ships a `NOTICE` file. Scan of the 118 install directories: no `NOTICE*` file. Neither Apache-2.0 package has one.
- One package has no license file in its install directory: `@tokenizer/token@0.3.0` (its `package.json` says MIT). The notice text for it must come from the registry or repository.
- The graph includes `express` and `@nestjs/platform-express`. The second is blocked by the IgnorePlugin. Whether `express` is inside the bundle: not verified.
- Dev-only dependencies are out of scope for shipping obligations: they do not enter the artifacts. `package.json` confirms the section of each shipped dependency: `@nestjs/*`, `rxjs`, `zod`, `reflect-metadata` and the Angular runtime packages are `dependencies`; `@angular/build`, `@angular/cli`, `@nestjs/cli`, `drizzle-*`, `vite`, `vitest`, `typescript`, `rimraf`, `@rspack/core`, `nx` are `devDependencies`. `@rspack/core` 2.3.0 is a build tool (MIT). Code a build tool injects into the output (for example the rspack runtime, the banner) is a case this spike did not check.
- Web bundle: `pnpm nx build web-angular --skip-nx-cache` wrote `apps/web-angular/dist/web-angular/3rdpartylicenses.txt` (16,954 bytes) next to `browser/`. It lists 6 packages (`@angular/core`, `rxjs`, `tslib`, `@angular/common`, `@angular/platform-browser`, `@angular/router`) with full text. `browser/` holds `index.html`, `main-*.js`, 4 `chunk-*.js`, `styles-*.css` and `favicon.ico`, and no license file.

---

## Q4: what the licenses require

[Back to navigation](#navigation)

Not legal advice. Sources are the license texts.

| License | Condition on redistribution, binary form included | Source |
| --- | --- | --- |
| MIT | "The above copyright notice and this permission notice (including the next paragraph) shall be included in all copies or substantial portions of the Software." | https://spdx.org/licenses/MIT.html |
| ISC | Permission is granted "provided that the above copyright notice and this permission notice appear in all copies." | https://spdx.org/licenses/ISC.html |
| BSD-3-Clause | "Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution." Also: the copyright holder's name may not be used to endorse. | https://spdx.org/licenses/BSD-3-Clause.html |
| BSD-2-Clause | Same binary-form sentence. Not present in the measured set | https://spdx.org/licenses/BSD-2-Clause.html |
| Apache-2.0 | Section 4(a): give recipients "a copy of this License". 4(d): if the Work has a NOTICE file, a readable copy of its attributions in a NOTICE file, in the documentation, or in a display. 4(b) concerns modified files, 4(c) retains notices in source form of Derivative Works. | https://www.apache.org/licenses/LICENSE-2.0.txt |
| 0BSD | "Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted." No notice condition in the SPDX text | https://spdx.org/licenses/0BSD.html |
| BlueOak, CC0, Python-2.0 | Not in the measured set. Not examined | not verified |
| PostgreSQL (this project) | The copyright notice and the two following paragraphs "appear in all copies" | Q1 |

Reading: MIT, ISC, BSD-3-Clause and Apache-2.0 each ask for the license text and copyright notice to accompany copies. One aggregate file that carries every text meets the common practice. Whether one file satisfies each license: legal question, not verified. `rxjs` and `reflect-metadata` are Apache-2.0 with no NOTICE file, so only the license copy applies.

---

## Q5: options to produce the notices

[Back to navigation](#navigation)

`rg -n -i licen docs/requirements docs/roadmap` found no requirement and no roadmap decision about third-party licenses, so this page cites no REQ id. A new requirement is a human decision.

| Option | What it covers | Effort | Risks |
| --- | --- | --- | --- |
| (i) Angular `extractLicenses` | Web bundle. The Angular CLI schema (`packages/angular/build/src/builders/application/schema.json`) says `extractLicenses`: "Extract all licenses in a separate file.", default `true`. `angular.json` sets it `false` only for the `development` configuration. Observed output: `3rdpartylicenses.txt` | Zero to produce. About 5 lines in `compile-sea.ts` to embed it | Lists only what Angular bundles (6 packages). The file sits outside `browser/`, so `compile-sea` must read it by path |
| (ii) A rspack license plugin | Nest bundle. `@rspack/core` 2.3.0 types show `SwcJsMinimizerPlugin` with `extractComments` (collects `/*! */` legal comments). No inventory plugin like Angular's was found in the 2.3.0 types or in `https://rspack.rs/llms.txt` | Unknown | `extractComments` collects comments, not each package's license. `license-webpack-plugin` 4.0.2 (ISC, last published 2022-06-19) targets webpack; rspack compatibility: not verified |
| (iii) `pnpm licenses list --json` plus a `tools/scripts/*.ts` generator | Whole shipped set, both bundles | Small to medium: run the three commands, merge, read each license file from the `paths` field, write one file. Needs a policy for `@tokenizer/token` (no license file) | Reports the install graph, an upper bound of what is bundled. Dev-only packages are excluded by `--prod`. Format is pnpm's, which can change |
| (iv) Third-party tools | | Low | Supply chain: each adds a dependency tree the repo's `minimumReleaseAge` and `allowBuilds` policy must review |
| (v) `cargo-about` | Rust crates of the Tauri shell | Small config (`about.toml`, a template) | Needs Rust tooling. The crate set is large (414 lock entries). Not run here |

Registry facts for (iv), read from `https://registry.npmjs.org/<name>` on 2026-11-03:

| Package | Latest | License | Last modified | Direct deps |
| --- | --- | --- | --- | --- |
| `license-checker-rseidelsohn` | 5.0.1 | BSD-3-Clause | 2026-07-15 | 12 |
| `generate-license-file` | 4.2.5 | ISC | 2026-08-29 | 10 |
| `@cyclonedx/cyclonedx-npm` | 6.0.1 | Apache-2.0 | 2026-08-11 | 6 |
| `license-webpack-plugin` | 4.0.2 | ISC | 2022-06-19 | 1 |
| `oss-attribution-generator` | 1.7.1 | MIT | 2022-06-23 | 10 |

None is marked deprecated in the latest version metadata. Quality of their output: not verified. `cargo-about` (Apache-2.0): latest release `0.9.3` published 2026-10-26, repository not archived (GitHub API).

Where the file could live in the SEA (design only, nothing built):

- Embedded asset `licenses/THIRD-PARTY-NOTICES.txt`, read with `getAsset` like the other assets (`apps/sea-runtime/src/persistence/asset-source.ts` shows the pattern). Cost: the text grows the binary. The Angular file is about 17 KB; the full set is expected to be larger, not measured.
- A copy next to the executable in `artifacts/sea-runtime/`. This is what a user can find without running anything.
- A `--licenses` flag or subcommand that prints the asset and exits. The dispatcher parses argv in `libs/service-registry/src/dispatcher.ts` (`--service`). A new flag changes that CLI surface: an open decision.
- Include the project `LICENSE` in the same file (Q1).

---

## Q6: recommendation

[Back to navigation](#navigation)

Update 2026-11-03: the human decided OQ18 to OQ22. The template ships documentation only; slices A to F and the questions below are superseded. See [Third-party license notices](../backlog/third-party-licenses.md#decisions).

Smallest coherent design: generate one `THIRD-PARTY-NOTICES.txt` at package time with a small TypeScript script (option iii) over the production graphs of `sea-runtime`, `api-gateway` and `web-angular`. Add the Node.js `LICENSE`, the `sqlite-vector` `LICENSE.md` and the project `LICENSE`. Embed it as a SEA asset and write a copy next to the executable. Treat the Angular `3rdpartylicenses.txt` as a cross-check, not the source.

Follow-up slices (rough sizes are guesses, not measured):

| Slice | Content | Size |
| --- | --- | --- |
| A | Generator script: run `pnpm licenses`, merge, dedupe, read license files, fail on a missing or non-allowlisted license | S to M, one script plus one run in `package` |
| B | `compile-sea` embeds the file as an asset and copies it next to the binary | S |
| C | Fetch the Node `LICENSE` for the target version and the `sqlite-vector` `LICENSE.md` (pin by hash in `tools/vector/*.json`, like the library) | S |
| D | Optional `--licenses` print | S, touches the CLI surface |
| E | Tauri: `cargo-about`, once the sidecar wiring is final | M, needs Rust tooling |
| F | Requirement text and a CI allowlist check | S, human decision |

Open questions for the human (tracked as [OQ18 to OQ22](../roadmap/PROPOSAL.md#open-questions); backlog item: [Third-party license notices](../backlog/third-party-licenses.md)):

1. Is there a distribution plan (who receives the binaries) so the obligations apply? Internal-only use changes the analysis. Not verified.
2. Add a requirement for third-party notices, and an allowlist policy (fail the build on copyleft)?
3. Add a `--licenses` CLI flag, or only the file?
4. Which file name and location next to the artifact?
5. Replace the empty `license = ""` in `apps/desktop/src-tauri/Cargo.toml` with `PostgreSQL`? (SPDX identifier, as in npm; Cargo's accepted syntax: not verified.)

Do not claim: that the project is "license compliant" or "audited"; that the set is complete before the actual bundle contents are measured; any Rust, WebView or Tauri license fact; that SQLite or Node need no notice (Node's `LICENSE` lists bundled components with their own terms); or that this page is legal advice.

---

## Not verified

[Back to navigation](#navigation)

- The exact modules inside `sea-app.mjs` (no rspack stats generated).
- Whether `express` is bundled.
- Crate licenses of the Tauri shell, `cargo-about` output, WebView terms.
- Whether pnpm or npm validates the `license` field beyond the clean install.
- SPDX matching guidelines for the title line of `LICENSE`.
- The license of the vendored FP16 headers in `sqlite-vector`.
- BlueOak, CC0, Python-2.0 terms (not in the set).
- Whether a binary distribution counts as a "copy" under each license.
- Output quality of the npm tools listed in Q5.
- Windows and Linux SEA builds (only macOS arm64 was available).
