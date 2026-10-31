<!-- toon-meta
fmt: TOON
doc: docs/results/POC-01a-Result.md
title: "POC-1a Result"
type: backlog
summary: "Result of POC-1a: version checks, pnpm and Nx setup, root ECO scripts, manual edits and command log."
related[2]: docs/backlog/poc-1a-monorepo-init.md,docs/backlog/README.md
status: current
updated: 2026-10-31
-->

# POC-1a Result

Slice 1a of POC-1, branch `minor/poc-01a-monorepo`. Backlog: [POC-1a](../backlog/poc-1a-monorepo-init.md).

## Summary

- pnpm 12.16.1 workspace with a catalog, exact pins and a committed `pnpm-lock.yaml`.
- Nx 24.0.2 pinned in the catalog, local only, no Nx Cloud.
- Root `build`, `test` and `package` scripts print an explicit no-op message and exit 0.
- `engines.node` set to `>=26.13.0 <27`.
- One deviation: Nx 24.0.2, not 24.0.3 (see Discrepancies).

## Version table

Baseline pins come from [02-technology-baseline.md](../requirements/02-technology-baseline.md). Registry checks ran 2026-10-31 on `registry.npmjs.org`.

| Package | Baseline (SRS) | npm check | Pin in this slice | Status |
|---|---|---|---|---|
| Node.js | `>=26.13.0 <27` (REQ-STACK-01) | local `v26.13.0` | `engines.node` `>=26.13.0 <27` | verified (local binary); compatibility of the rest of the stack with Node 26 not verified |
| pnpm | `>=12.16.1` (REQ-STACK-02) | local `12.16.1` | `packageManager` `pnpm@12.16.1` | verified |
| Nx | discovered after check (REQ-STACK-08) | latest `24.0.3` (published 2026-10-30T20:41Z) | `24.0.2` (catalog) | verified; `24.0.3` blocked by `minimumReleaseAge` 1440 at check time |
| NestJS `@nestjs/core` | `12.3.2` (REQ-STACK-04) | latest `12.3.2` | not installed in 1a | verified on npm; not installed |
| Angular `@angular/cli` | `>=22.2.5` (REQ-STACK-05) | latest `22.2.5` | not installed in 1a | verified on npm; not installed |
| Zod | `>=4.6.7` (REQ-STACK-06) | `4.6.7` exists | not installed in 1a | verified on npm; not installed |
| Tauri `@tauri-apps/cli` | minimum `2.12.5` (REQ-STACK-03) | latest `2.12.4`; `2.12.5` not found | not installed in 1a | discrepancy, not decided (see below) |

## Discrepancies

- **Nx 24.0.3 blocked.** `nx@24.0.3` was published 2026-10-30T20:41Z. The check ran 2026-10-31T17:09Z. `minimumReleaseAge: 1440` (REQ-SUPPLY-01) rejects versions younger than 24 h, so `pnpm add` refused it. The slice pins `nx@24.0.2` (published 2026-10-26T20:25Z, the newest stable release older than 24 h). The protection stays on; no `minimumReleaseAgeExclude` was added. Move to 24.0.3 after 2026-10-31T20:41Z if wanted.
- **Tauri CLI.** `npm view @tauri-apps/cli@2.12.5` returns an error; npm latest is `2.12.4`. The baseline minimum `2.12.5` names the crate `tauri`, which the brief reports at 2.12.5. Not verified here. Not decided: a human decision is needed.
- **Catalog update.** A first `pnpm add --save-catalog nx@24.0.3` wrote `catalog.nx: 24.0.3` before the install was blocked. Later `pnpm add --save-catalog`, `--save-catalog-name=default`, `pnpm remove` and `--force` runs did not change an existing catalog entry. The stale entry was removed by hand (see Manual edits), then `pnpm add -w -D -E --save-catalog nx@24.0.2` recreated it.
- **Root project as Nx project.** Nx infers the root `package.json` as project `lan-solution-template`. A root script that calls `nx run-many -t <op>` without a filter would call itself. The root scripts therefore pass `--exclude=lan-solution-template`.
- **No-op message after success.** With zero projects, `nx run-many` exits 0 with `0 tasks`. The scripts add `&& echo '<op>: not defined for this package'`. The message prints even when a future project exists and the operation succeeds. Revisit in POC-1b.

## Node LTS record

Source: `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json` (read 2026-10-31), entry `v26`:

| Field | Value |
|---|---|
| start | 2026-05-05 |
| lts | 2026-10-28 |
| maintenance | 2027-10-20 |
| end | 2029-04-30 |
| codename | Lithium |

The pin `>=26.13.0 <27` is the v26 LTS line. This answers OQ3 only for the Node line. Compatibility of Nest, Angular, Tauri and Zod with Node 26: not verified.

## Reference points (REQ-REF-01)

1. `nest-base` testing/coverage: reuse the observable pipeline idea. Reject its unit and isolated integration suites.
2. `nest-base` namespaced configuration: keep typed classes, namespace registration, single Zod validation and an immutable singleton. Later POC, not 1a.
3. `nest-base` scripts/bump: adopt naming only. `bumpDependencies` and `test:doctor` stay TBD (REQ-DEPS-01). No npm-check-updates install.
4. `fullstack-base` scripts: adopt root composition. Reject `test:unit` and its `test:e2e` meaning.
5. `fullstack-base` pnpm catalog: adopted `catalog:` style and `savePrefix: ''`. Its versions (Angular 22.0.x, Nest 11.x) are not this baseline.
6. `fullstack-base` doctor (`.ncurc.json`): reference only. Not installed; no `.ncurc.json` created (REQ-DEPS-01).

## Manual edits

Each edit below has no CLI route, or the CLI could not do it. Every other file was written by a CLI.

| # | File | Edit | Reason |
|---|---|---|---|
| 1 | `pnpm-workspace.yaml` | Deleted the stale lines `catalog:` and `  nx: 24.0.3`. The next `pnpm add --save-catalog nx@24.0.2` wrote the new entry. | `pnpm add --save-catalog` did not update an existing catalog entry. Deleting the stale entry let the CLI recreate it with the right version. |
| 2 | `.gitignore` | Appended `node_modules/` on its own line. A first append joined it to the previous line (`migrate-runsnode_modules/`); a `sed -i` split it back. | No CLI writes a `node_modules` ignore line. `nx init` had added the `.nx/*` lines. `git status` showed `node_modules/` as untracked. |

Not edited by hand: `package.json` (all fields via `pnpm init` and `pnpm pkg set`), `pnpm-lock.yaml` (pnpm), `nx.json` (`nx init`), `pnpm-workspace.yaml` settings (`pnpm config set`). The `packages:` list of `pnpm-workspace.yaml` was not added: no `apps/*` or `libs/*` exist yet, and POC-1b adds them.

## Commands run

Each command ran from the repository root unless noted. Exit codes come from the command itself, not from a pipe.

| # | Command | Result |
|---|---|---|
| 1 | `git branch --show-current` | `minor/poc-01a-monorepo` |
| 2 | `npm view nx version`, `@nestjs/core`, `@angular/cli`, `@tauri-apps/cli` | `24.0.3`, `12.3.2`, `22.2.5`, `2.12.4` |
| 3 | `npm view @tauri-apps/cli@2.12.5 version` | error, no such version |
| 4 | `curl` of `registry.npmjs.org/nx` (time map, scratch file outside repo) | `24.0.2` 2026-10-26, `24.0.3` 2026-10-30 |
| 5 | `pnpm -v`, `node -v` | `12.16.1`, `v26.13.0` |
| 6 | `pnpm init` | created `package.json` with `packageManager` `pnpm@12.16.1` and `type` `module` |
| 7 | `pnpm pkg set engines.node=">=26.13.0 <27"` | set |
| 8 | `pnpm config set --location project savePrefix ''`, `minimumReleaseAge 1440`, `strictDepBuilds true` | wrote the three keys into `pnpm-workspace.yaml` |
| 9 | `pnpm add -w -D -E --save-catalog nx@24.0.3` | blocked: `minimumReleaseAge` cutoff; `nx` not added |
| 10 | `pnpm add -w -D -E --save-catalog nx@24.0.2` | added; failed with `ERR_PNPM_IGNORED_BUILDS` |
| 11 | `pnpm approve-builds --all` | `allowBuilds: nx: true`; nx postinstall done |
| 12 | `pnpm add`, `pnpm remove`, `pnpm update`, `--save-catalog-name=default`, `--force` (catalog refresh attempts) | catalog kept `24.0.3`; `package.json` had literal `24.0.2` |
| 13 | `pnpm pkg set devDependencies.nx=catalog:` then `pnpm install` | install blocked by `minimumReleaseAge` |
| 14 | `pnpm pkg set devDependencies.nx=24.0.2` | set (temporary) |
| 15 | manual edit 1 (see Manual edits) | stale catalog removed |
| 16 | `pnpm add -w -D -E --save-catalog nx@24.0.2` | catalog `nx: 24.0.2`; `package.json` devDependency `nx` `24.0.2` |
| 17 | `pnpm install` | `Already up to date`, exit 0 |
| 18 | `pnpm exec nx init --interactive=false --nxCloud=false --aiAgents=none --plugins=skip` | created `nx.json` (no cloud key); appended `.nx/*` lines to `.gitignore` |
| 19 | `pnpm exec nx run-many -t build`, `-t test`, `-t package` (before scripts) | build and package `0 tasks`; test ran the placeholder root script and failed |
| 20 | `pnpm pkg set scripts.build/test/package` | set; placeholder `test` removed |
| 21 | `pnpm exec nx show projects` | `["lan-solution-template"]`, the root project |
| 22 | `pnpm build`, `pnpm test`, `pnpm package` | each exit 0, each prints `<op>: not defined for this package` |
| 23 | `pnpm install --frozen-lockfile` | exit 0 |
| 24 | `node --version` | `v26.13.0`, inside `>=26.13.0 <27` |
| 25 | `pnpm exec nx --version` | `Local: v24.0.2`, equal to the catalog pin |
| 26 | `rg -i cloud nx.json` | no match (exit 1) |
| 27 | `grep -n '[\^~]' package.json pnpm-workspace.yaml` | no match (exit 1) |
| 28 | `git status --short` | `.gitignore` modified; new files `nx.json`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, this page |
