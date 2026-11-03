<!-- toon-meta
fmt: TOON
doc: docs/backlog/third-party-licenses.md
title: "Third-party license notices"
type: backlog
summary: "Proposed backlog item: ship third-party license notices with the SEA and Tauri artifacts, in slices A to F."
ids[0]:
related[4]: docs/backlog/README.md,docs/results/SPIKE-third-party-licenses.md,docs/roadmap/PROPOSAL.md,docs/requirements/10-node-sea-distribution.md
status: current
updated: 2026-11-03
-->

# Third-party license notices

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Problem](#problem)
- [Goal](#goal)
- [Slices](#slices)
- [Non-goals](#non-goals)
- [Risks](#risks)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Proposed. Nothing is built. No POC id. |
| Origin | Spike [SPIKE-third-party-licenses](../results/SPIKE-third-party-licenses.md) on branch `chore/third-party-licenses` |
| Depends on | Nothing for slices A to D. Slice E waits for the final Tauri sidecar wiring. |
| Requirements | None. The spike found no requirement or roadmap decision about third-party licenses. No REQ or AC id exists for this item, and this page invents none. Slice F proposes one; that is a human decision. |
| Open questions | [OQ18 to OQ22](../roadmap/PROPOSAL.md#open-questions) |
| Not legal advice | The spike is engineering research. Ask a lawyer before you rely on it. |

---

## Problem

[Back to navigation](#navigation)

Source: the [spike summary](../results/SPIKE-third-party-licenses.md#summary).

- The measured production set is 118 package versions (110 names): MIT 106, ISC 5, BSD-3-Clause 3, Apache-2.0 2, 0BSD 2. No missing, `UNKNOWN`, copyleft or source-available license.
- Every license in the set asks for the notice to travel with binary copies, except 0BSD.
- The Angular build writes `3rdpartylicenses.txt`. `compile-sea` embeds only `browser/`, so that file is dropped today.
- The project `LICENSE` says the notice must "appear in all copies". Whether a binary counts as a copy: not verified.
- The set is an upper bound. The exact modules inside `sea-app.mjs`: not verified.
- The Tauri crates (414 `Cargo.lock` entries) were not collected. Their licenses: not verified.

---

## Goal

[Back to navigation](#navigation)

- One generated `THIRD-PARTY-NOTICES.txt` travels with each shipped artifact.
- The file carries the production dependency licenses, the Node.js `LICENSE`, the `sqlite-vector` `LICENSE.md` and the project `LICENSE`.
- The SEA embeds it as an asset. A copy sits next to the executable.

Source: [spike recommendation](../results/SPIKE-third-party-licenses.md#q6-recommendation). The design is not decided. See [Open questions](#open-questions).

---

## Slices

[Back to navigation](#navigation)

Sizes are guesses from the spike, not measured. Acceptance items are proposals; the spike states none.

| Slice | Goal | Size | Depends on | Acceptance (observable) |
|---|---|---|---|---|
| A | Generator script under `tools/scripts/`. Runs `pnpm licenses list --prod --json -C <app>` for `sea-runtime`, `api-gateway` and `web-angular`, merges, dedupes, reads each license file. | S to M | None | One command writes one text file. It lists the 118 package versions measured by the spike, or a changed count that the run reports. The command exits non-zero on a missing license or a license outside the allowlist. A package with no license file (`@tokenizer/token@0.3.0` in the spike) is handled by a stated rule. |
| B | `compile-sea` embeds the file as an asset and copies it next to the binary. | S | A | The built SEA holds the asset. The file exists next to the executable in `artifacts/sea-runtime/`. Both files are byte-equal. |
| C | Fetch the Node.js `LICENSE` for the target version and the `sqlite-vector` `LICENSE.md`. Pin them by hash in `tools/vector/*.json`, like the library. | S | A | The generated file contains both texts. A changed upstream file fails the hash check. |
| D | Optional `--licenses` print. The dispatcher in `libs/service-registry/src/dispatcher.ts` parses argv. | S | B | The flag prints the asset and exits 0. Without the flag, existing output and exit codes are unchanged. Touches the CLI surface: open decision [OQ20](../roadmap/PROPOSAL.md#open-questions). |
| E | Tauri crates: `cargo-about` with `about.toml` and a template. | M | Final sidecar wiring (`externalBin` is `null` today). Rust tooling. | The generated file lists the crate licenses. Crate count compared with `Cargo.lock`. |
| F | Requirement text and a CI allowlist check. | S | Human decision ([OQ19](../roadmap/PROPOSAL.md#open-questions)). CI release work is on hold (decision 9). | A requirement id exists after the human decides. The check fails the build on a license outside the allowlist. |

---

## Non-goals

[Back to navigation](#navigation)

- No claim that the project is "license compliant" or "audited".
- No claim that the set is complete before the real bundle contents are measured.
- No Rust, WebView or Tauri license fact until slice E runs.
- No new requirement or acceptance criterion. This page proposes none.
- No legal advice.

---

## Risks

[Back to navigation](#navigation)

- The pnpm output format can change. Source: [Q5](../results/SPIKE-third-party-licenses.md#q5-options-to-produce-the-notices), option (iii).
- The text grows the SEA binary. The Angular file is about 17 KB; the full set was not measured.
- Third-party tools add a dependency tree that the `minimumReleaseAge` and `allowBuilds` policy must review.
- Only macOS arm64 was available for the spike. Windows and Linux SEA builds: not verified.

---

## Open questions

[Back to navigation](#navigation)

Tracked in the [Open questions](../roadmap/PROPOSAL.md#open-questions) table of the roadmap. All owned by the human, none blocking.

| ID | Question |
|---|---|
| [OQ18](../roadmap/PROPOSAL.md#open-questions) | Is there a distribution plan (who receives the binaries), so the obligations apply? |
| [OQ19](../roadmap/PROPOSAL.md#open-questions) | Add a requirement for third-party notices and an allowlist policy that fails the build on copyleft? |
| [OQ20](../roadmap/PROPOSAL.md#open-questions) | Add a `--licenses` CLI flag, or only the file? |
| [OQ21](../roadmap/PROPOSAL.md#open-questions) | Which file name and location next to the artifact? |
| [OQ22](../roadmap/PROPOSAL.md#open-questions) | Replace the empty `license = ""` in `apps/desktop/src-tauri/Cargo.toml` with `PostgreSQL`? |
