<!-- toon-meta
fmt: TOON
doc: docs/backlog/third-party-licenses.md
title: "Third-party license notices"
type: backlog
summary: "Backlog item: one documentation slice, the third-party license guide for derived products, plus documented future ideas."
ids[0]:
related[4]: docs/backlog/README.md,docs/results/SPIKE-third-party-licenses.md,docs/roadmap/PROPOSAL.md,docs/requirements/10-node-sea-distribution.md
status: current
updated: 2026-11-03
-->

# Third-party license notices

# Third-party license notices

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Problem](#problem)
- [Decisions](#decisions)
- [Slice](#slice)
- [The guide](#the-guide)
- [Future ideas](#future-ideas)
- [Non-goals](#non-goals)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Decided on 2026-11-03: documentation only. No code slice remains. No POC id. |
| Origin | Spike [SPIKE-third-party-licenses](../results/SPIKE-third-party-licenses.md) on branch `chore/third-party-licenses` |
| Depends on | Nothing. |
| Requirements | None. No REQ or AC id exists for this item, and this page invents none ([OQ19](../roadmap/PROPOSAL.md#open-questions)). |
| Decided questions | [OQ18 to OQ22](../roadmap/PROPOSAL.md#open-questions) |
| Not legal advice | The spike is engineering research. Ask a lawyer before you rely on it. |

---

## Problem

[Back to navigation](#navigation)

Source: the [spike summary](../results/SPIKE-third-party-licenses.md#summary).

- The measured production set is 118 package versions (110 names): MIT 106, ISC 5, BSD-3-Clause 3, Apache-2.0 2, 0BSD 2. No missing, `UNKNOWN`, copyleft or source-available license. The set is permissive, not only MIT.
- Every license in the set asks for the notice to travel with copies, except 0BSD.
- The Angular build writes `3rdpartylicenses.txt`. `compile-sea` embeds only `browser/`, so that file is dropped today.
- The set is an upper bound. The exact modules inside `sea-app.mjs`: not verified.
- The Tauri crates (414 `Cargo.lock` entries) were not collected. Their licenses: not verified.

---

## Decisions

[Back to navigation](#navigation)

The human decided on 2026-11-03. The repository is a template.

| ID | Decision |
|---|---|
| [OQ18](../roadmap/PROPOSAL.md#open-questions) | Option 2: documentation only. The template ships guidance, no generator and no built-in notices file. Each derived product implements notices when it distributes binaries. |
| [OQ19](../roadmap/PROPOSAL.md#open-questions) | No for now. No REQ, no AC, no check. The check design is a [future idea](#future-ideas). |
| [OQ20](../roadmap/PROPOSAL.md#open-questions) | No `--licenses` flag. A derived product may add it. |
| [OQ21](../roadmap/PROPOSAL.md#open-questions) | A documented convention only, in [Future ideas](#future-ideas). |
| [OQ22](../roadmap/PROPOSAL.md#open-questions) | Yes. `license = "PostgreSQL"` in `apps/desktop/src-tauri/Cargo.toml`. |

Reasoning for OQ18. A template distributes source and `pnpm-lock.yaml`, not copies of dependencies. The notice obligation of the MIT, ISC, BSD and Apache-2.0 licenses applies when copies are redistributed. The derived product does that act. This is a general analysis, not legal advice.

Reasoning for OQ20. A `--licenses` flag would be argv handled by `dispatch()` in `libs/service-registry`. It would be a third mode that prints an embedded notices file and exits 0. It would change the CLI surface, the exit code contract and the smoke bad-selector check. It has nothing to print without an embedded file.

---

## Slice

[Back to navigation](#navigation)

One slice. No code.

| Slice | Goal | Acceptance (observable) |
|---|---|---|
| A | Write [the guide](#the-guide) in this page. | The guide section exists and holds the neutral sentence about derived products. The metadata check exits 0. |

Slice A is done by this page. The old slices A to F (generator, SEA embed, pinned license texts, `--licenses`, `cargo-about`, CI check) are dropped. Their ideas live in [Future ideas](#future-ideas).

---

## The guide

[Back to navigation](#navigation)

For a team that builds a product from this template.

1. The `license` fields and the `LICENSE` file describe this template. A derived product sets its own license and keeps this template's copyright notice where template code remains, as the PostgreSQL License requires copies to carry it. This is not legal advice.
2. This template ships source and `pnpm-lock.yaml`. It ships no copy of a dependency. It ships no notices file.
3. When your product distributes binaries (a SEA, a Tauri installer), the notice obligation of the dependency licenses applies to you. Measured on the template: MIT 106, ISC 5, BSD-3-Clause 3, Apache-2.0 2, 0BSD 2 production package versions. Re-measure for your product. Source: [spike](../results/SPIKE-third-party-licenses.md).
4. Collect the production licenses with `pnpm licenses list --prod --json -C <app>` for each app that you bundle. Read it with `toon`, per the repository rules.
5. Add the license of the Node.js runtime and of `sqlite-vector` if you bundle them. Add your own `LICENSE`.
6. The Angular build already writes `3rdpartylicenses.txt` for the web bundle (verified in the spike).

---

## Future ideas

[Back to navigation](#navigation)

Documented only. Nothing here is built, scheduled or required.

### Check design

- A deterministic TypeScript script runs `pnpm licenses list --prod --json -C <app>` for `sea-runtime`, `api-gateway` and `web-angular`, and takes the union.
- A zod schema validates the output.
- An SPDX allowlist: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD.
- An exceptions list, each with a reason. Example: `@tokenizer/token` declares MIT without a license file.
- The script exits 1 and lists `package@version` and its license for each violation.
- It hooks next to the root `securityCheck`.
- Limits: SPDX compound expressions need an evaluator. It reads the `license` field, not the license text. It needs installed dependencies.

### Generator design

- A script merges and dedupes the same `pnpm licenses` output and reads each license file.
- It writes the notices file described below.

### Notices file convention

- One plain-text file `THIRD-PARTY-NOTICES.txt`.
- Content: the notice of every distributed dependency, the project `LICENSE`, and the Node.js and `sqlite-vector` licenses.
- It is an asset of the Tauri MSI installer. It is not embedded in the SEA.
- It lands in the install path through Tauri `bundle.resources`. Placement per OS: not verified.
- The SEA package script generates it as a post-step, like the smoke check that runs at the end of `sea-runtime:package`. Tauri packages after the SEA (REQ-ECO-06).
- It is written next to the executable in `artifacts/sea-runtime/`. That `desktop:package` reads that directory: not verified.

---

## Non-goals

[Back to navigation](#navigation)

- No claim that the project is "license compliant" or "audited".
- No claim that the set is complete before the real bundle contents are measured.
- No Rust, WebView or Tauri license fact.
- No new requirement or acceptance criterion.
- No generator, check script or CLI flag in this template.
- No legal advice.

---

## Not verified

[Back to navigation](#navigation)

- Whether a binary counts as a copy under the project `LICENSE` ("appear in all copies").
- The exact modules inside `sea-app.mjs`.
- The licenses of the Tauri crates.
- Tauri `bundle.resources` placement per OS.
- That `desktop:package` reads `artifacts/sea-runtime/`.
- Windows and Linux SEA builds. Only macOS arm64 was available for the spike.
