<!-- toon-meta
fmt: TOON
doc: docs/standards/README.md
title: Standards and references
type: standard
summary: "Technical and normative references, standards mapping, and the metadata block convention."
ids[0]:
related[2]: README.md,docs/standards/identifier-glossary.md
status: current
updated: 2026-10-30
-->

# Standards and references

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md)

[Next](identifier-glossary.md)

## Navigation

- [At a glance](#at-a-glance)
- [13. Technical and normative references](#13-technical-and-normative-references)
  - [Specifications and security](#specifications-and-security)
  - [Reference implementation](#reference-implementation)
  - [Scripts, dependencies and release](#scripts-dependencies-and-release)
- [Standard to where applied](#standard-to-where-applied)
- [Identifier glossary](#identifier-glossary)
- [Metadata block v1](#metadata-block-v1)
- [Checks](#checks)

---

## At a glance

[Back to navigation](#navigation)

| Topic | What you find | Section |
| --- | --- | --- |
| References | Specification, implementation and release links | [13. Technical and normative references](#13-technical-and-normative-references) |
| Standard mapping | Which requirement file applies which standard | [Standard to where applied](#standard-to-where-applied) |
| Id families | Ids outside the SRS | [Identifier glossary](#identifier-glossary) |
| Page metadata | The toon-meta block and the `docs/meta.toon` loop | [Metadata block v1](#metadata-block-v1) |
| Checks | The open question count command and the metadata check command | [Checks](#checks) |

---

## 13. Technical and normative references

[Back to navigation](#navigation)

Source: SRS v1.6 section 13. Per the SRS conventions note, these references are engineering guides. They state no certification or full compliance.

### Specifications and security

- ISO/IEC/IEEE 29148:2018 — https://www.iso.org/standard/72089.html
- ISO/IEC 25010:2023 — https://www.iso.org/standard/78176.html
- RFC 2119 + RFC 8174 (BCP 14) — https://www.rfc-editor.org/rfc/rfc2119 ; https://www.rfc-editor.org/rfc/rfc8174
- RFC 9110 (HTTP semantics and 308 redirection) — https://www.rfc-editor.org/rfc/rfc9110
- OWASP ASVS 5.0.0 — https://owasp.org/projects/asvs

### Reference implementation

- Node SEA (`--build-sea`, `assets`, code cache, arguments) — https://nodejs.org/api/single-executable-applications.html
- Node `child_process.spawn()` and IPC — https://nodejs.org/api/child_process.html
- NestJS standalone `createApplicationContext()` — https://docs.nestjs.com/application-context
- NestJS microservices and gRPC (future growth) — https://docs.nestjs.com/microservices/basics ; https://docs.nestjs.com/microservices/grpc
- NestJS NodeAdapter — https://docs.nestjs.com/http/performance
- NestJS ServeStaticModule (`NodeAdapter` compatible) — https://docs.nestjs.com/recipes/serve-static
- Angular CLI dev-server + proxy — https://angular.dev/tools/cli/serve
- Mermaid architecture-beta — https://mermaid.js.org/syntax/architecture
- Nx task dependencies — https://nx.dev/docs/reference/project-configuration
- NestJS + Drizzle + `forRootAsync()` — https://docs.nestjs.com/data/drizzle
- Drizzle `node:sqlite` — https://orm.drizzle.team/docs/sqlite/connect-node-sqlite
- SQLite-vector 1.1.2 — https://github.com/sqliteai/sqlite-vector/releases
- pgvector 0.8.7 — https://github.com/pgvector/pgvector/blob/master/CHANGELOG.md
- Tauri sidecar — https://tauri.app/develop/sidecar/
- Tauri autostart — https://tauri.app/plugin/autostart/
- Tauri cross-platform WebDriver — https://tauri.app/develop/tests/webdriver/
- WebdriverIO Tauri service — https://webdriver.io/docs/wdio-tauri-service
- WDIO Tauri: test plugin and production exclusion — https://webdriver.io/docs/desktop-testing/tauri/plugin-setup
- Tauri WebDriver CI Linux/Xvfb — https://tauri.app/develop/tests/webdriver/ci/
- Jest CLI testNamePattern (`-t`) — https://jestjs.io/docs/cli
- Playwright: tags and `--grep` — https://playwright.dev/docs/test-annotations
- PWA installability — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Apple: certificate trust on iOS — https://support.apple.com/en-us/102390
- Nx CLI `--nxBail` — https://nx.dev/docs/reference/nx-commands
- SQLite WAL — https://www.sqlite.org/wal.html

### Scripts, dependencies and release

- nest-base — testing/coverage — https://github.com/virgenherrera/nest-base#testing--coverage
- nest-base — namespaced configuration — https://github.com/virgenherrera/nest-base#namespaced-configuration-workflow
- nest-base — `package.json` at pinned commit — https://github.com/virgenherrera/nest-base/blob/3153f90c72544263ae5a194e7f2864a9dda3cdd8/package.json#L45
- fullstack-base — `package.json` at pinned commit — https://github.com/virgenherrera/fullstack-base/blob/50afc753617d628e0d8c5bd7ed2521ceae9a4298/package.json#L41
- fullstack-base — pnpm catalog — https://github.com/virgenherrera/fullstack-base/blob/50afc753617d628e0d8c5bd7ed2521ceae9a4298/pnpm-workspace.yaml
- fullstack-base — npm-check-updates doctor — https://github.com/virgenherrera/fullstack-base/blob/50afc753617d628e0d8c5bd7ed2521ceae9a4298/.ncurc.json
- Nx Release groups and fixed relationship — https://nx.dev/docs/guides/nx-release/release-groups
- Nx Release (configuration and publishing) — https://nx.dev/docs/guides/nx-release
- pnpm catalogs — https://pnpm.io/catalogs
- pnpm 12 `minimumReleaseAge`, `allowBuilds` and settings — https://pnpm.io/settings
- pnpm audit (threshold, query and errors) — https://pnpm.io/cli/audit
- pnpm audit signatures — https://pnpm.io/cli/audit#signatures
- Nest 12: Oxlint in scaffolding, Jest still supported — https://docs.nestjs.com/migration-guide
- Angular lint/ESLint — https://angular.dev/cli/lint
- npm-check-updates doctor — https://www.npmjs.com/package/npm-check-updates
- GitHub Actions PR `closed`/`merged` — https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- GitHub workflow artifacts — https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts
- GitHub protected branches — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub Actions workflow permissions — https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

---

## Standard to where applied

[Back to navigation](#navigation)

Maps each standard to the requirement files that apply it. Two places state a use of one. They are the SRS conventions note (SRS v1.6, line 9) and section 13. Every other mapping is marked "not verified".

| Standard | Where applied | Basis |
| --- | --- | --- |
| ISO/IEC/IEEE 29148:2018 | [requirements/README.md](../requirements/README.md) (organization of the requirement files) | SRS conventions note: the SRS organization takes it as a reference. Per-file mapping: not verified |
| ISO/IEC 25010:2023 | [requirements/README.md](../requirements/README.md); quality attributes in [11-nx-quality-testing.md](../requirements/11-nx-quality-testing.md) | SRS conventions note: quality attributes are inspired by it. The file mapping to 11-nx-quality-testing.md: not verified |
| OWASP ASVS 5.0.0 | [07-security.md](../requirements/07-security.md) ([REQ-SEC-02](../requirements/07-security.md) cites ASVS 5.0.0 6.3.2 and 6.4.1) | SRS conventions note: application controls. The [REQ-SEC-02](../requirements/07-security.md) citations are marked `not verified` in the SRS (see [amendments-2026-10-30.md](../requirements/amendments-2026-10-30.md)) |
| RFC 2119 + RFC 8174 (BCP 14) | All requirement files in [requirements/](../requirements/README.md) (MUST / MUST NOT / SHOULD / MAY) | SRS conventions note |
| NIST SP 800-63B | Not stated in the SRS v1.6 | not verified |
| ISO/IEC/IEEE 42010 | Not stated in the SRS v1.6; candidate use: [architecture/overview.md](../architecture/overview.md) | not verified |
| ISO 8601 | Not stated in the SRS v1.6 | not verified |
| ASD-STE100 | Not stated in the SRS v1.6 | not verified |
| ADR index and Decision Log | [roadmap/PROPOSAL.md](../roadmap/PROPOSAL.md#adr-index) | See the note below |

Note on `ADR index` and `Decision Log` (sources accessed 2026-10-30):

- Baseline, ISO 10007:2017: a configuration baseline is approved information. It fixes a characteristic at a point in time. It serves as a lifecycle reference (https://iteh.es/catalog/standards/iso/a779c3ed-00ca-4798-9a60-8f07ee800b8f/iso-10007-2017). The clause wording is not verified, since the standard is paywalled.
- Baseline, PMI Lexicon: the approved version of a work product. Only formal change control changes it (https://www.pmi.org/pmbok-guide-standards/lexicon). The current Lexicon edition wording is not verified.
- Decisions and rationale: ISO/IEC/IEEE 42010:2022 has clauses on architecture decisions and rationale (https://quality.arc42.org/standards/iso-42010). That source is a secondary summary. The normative text is not verified.
- ADR (architecture decision record) is an industry convention (Nygard), not an ISO term.
- `Decision Log` is not verified as a defined PMBOK term. It is a common project practice (https://thedigitalprojectmanager.com/project-management/decision-log/), a secondary source.
- The roadmap uses both names in that practice sense. It claims no certification.

---

## Identifier glossary

[Back to navigation](#navigation)

[identifier-glossary.md](identifier-glossary.md) lists the `NFR-*`, `D-*`, `R-*`, `A-*`, `Q-*` and `FR-*` ids. They are outside the repo; not defined in the SRS.

---

## Metadata block v1

[Back to navigation](#navigation)

Placement. Every tracked `.md` file carries the block on line 1, except `AGENTS.md` and `README.md`. Those two files are entry and instruction files. A block on line 1 would hide their first line from the reader and the agent. The root SRS original carries a block. One blank line follows the closing line. The H1 follows that blank line. The opening line holds `<!--`, a space and `toon-meta`, nothing else. The closing line is `-->` alone.

Schema v1. The interior is TOON. Keys, in order:

| Key | Rule |
| --- | --- |
| `fmt` | Always `TOON`. Not copied into [docs/meta.toon](../meta.toon). |
| `doc` | Repository-relative path of the file itself. |
| `title` | Page title. |
| `type` | Page kind, one of: `architecture`, `backlog`, `index`, `requirement`, `roadmap`, `standard`, `traceability`. |
| `summary` | One sentence, 20 words or fewer. |
| `ids[]` | Ids the page defines. Only requirement files define ids. Other pages use `ids[0]:` or omit the key. |
| `related[]` | Repository-relative paths, or `related[0]:`. |
| `status` | Page status, one of: `current`, `historical`, `proposed`. |
| `updated` | Date of the last edit to the block, `YYYY-MM-DD`. |

The block has no `refs` key. The regeneration command adds `refs` to [docs/meta.toon](../meta.toon). The command computes `refs` from the file body. The value cannot drift.

Counting rule for `ids` and `refs`. An id matches `\b(REQ|AC)-[A-Z0-9]+(-[A-Z0-9]+)*\b`.

- `ids` lists the ids the page defines. The author writes the list in the block. An id is defined where it opens a bold definition (`**REQ-<AREA>-<NN>.**`, `- **REQ-<AREA>-<NN>.**`, `**REQ-<AREA>-<NN> — Title.**`, `- **Title (REQ-<AREA>-<NN>).**`) or is the first cell of a plain table row (a link-wrapped cell, as in `traceability.md`, is a citation) in `docs/requirements/` (`| AC-<NN> |`). `ids` covers both `REQ-` and `AC-` ids. Each id has exactly one defining page.
- `refs` lists the distinct ids the page body cites. It excludes the ids in `ids`.
- The body starts after the closing `-->` line. The block text is not counted.
- `refs` is `[]` when the page cites no id.

Guards. Reject a block before decoding it when any of these hold:

- No closing `-->` line.
- Empty interior.
- A `-->` inside the interior, on a line other than the closing line.

Only then run `toon -d` on the interior. A decode that exits non-zero is an error. Empty input also decodes to `{}` with exit 0, so the empty-block guard is required.

Extract one block, with the guards (run from the repository root, replace `FILE` and `OUT`). The temporary file lives outside the repository:

```sh
T=$(mktemp); awk '/^<!-- toon-m[e]ta[[:space:]]*$/{s=1;next} s==1&&/^-->[[:space:]]*$/{s=2;exit} s==1{if(index($0,"-->"))e=1;n++;print} END{if(s!=2||e||n==0)exit 2}' FILE > "$T" && toon -d "$T" > OUT; rm -f "$T"
```

The metadata chain runs in this order: toon-meta blocks, then [docs/meta.toon](../meta.toon). [docs/meta.toon](../meta.toon) is derived from the blocks and the file bodies. Never edit it by hand. Run the regeneration command after any edit that adds or removes an id. The command skips `AGENTS.md` and `README.md`. It decodes every other tracked `.md` file in path order. It keeps `doc`, `title`, `type`, `summary`, `ids`, `related`, `status` and `updated`. It adds `refs`. It sorts the entries by `doc`. It encodes `{"docs": [...]}` straight to `docs/meta.toon`. No JSON file is written to disk. The command needs `awk`, `jq`, `toon` and `git`. Pass an output directory as the first argument to write elsewhere. The default is `docs`:

```sh
export LC_ALL=C; d=${1:-docs}; t=$(mktemp -d); i=0
for f in $(git ls-files '*.md' | sort); do
  case $f in AGENTS.md|README.md) continue;; esac
  i=$((i+1))
  awk '/^<!-- toon-m[e]ta[[:space:]]*$/{s=1;next} s==1&&/^-->[[:space:]]*$/{s=2;exit} s==1{if(index($0,"-->"))e=1;n++;print} END{if(s!=2||e||n==0)exit 2}' "$f" > "$t/$i.toon" || exit 1
  toon -d "$t/$i.toon" > "$t/$i.raw" || exit 1
  awk 'NR==1&&/^<!-- toon-m[e]ta[[:space:]]*$/{s=1;next} s==1{if(/^-->[[:space:]]*$/)s=2;next}
    s==2{l=$0; while(match(l,/(REQ|AC)-[A-Z0-9]+(-[A-Z0-9]+)*/)){
      p=(RSTART>1)?substr(l,RSTART-1,1):" "; q=substr(l,RSTART+RLENGTH,1)
      if(p!~/[A-Za-z0-9_]/&&q!~/[a-z0-9_]/)print substr(l,RSTART,RLENGTH)
      l=substr(l,RSTART+RLENGTH-1)}}' "$f" | sort -u | jq -R . | jq -s . > "$t/$i.refs" || exit 1
  jq --slurpfile r "$t/$i.refs" '(.ids // []) as $x | {doc,title,type,summary,ids:$x,related:(.related // []),status,updated,refs:($r[0] - $x)}' "$t/$i.raw" > "$t/$i.out" || exit 1
done
jq -s '{docs: (sort_by(.doc))}' "$t"/*.out | toon -o "$d/meta.toon" && rm -rf "$t"
```

Check the sync. Run the regeneration command from the repository root with an empty temporary directory as the first argument. Then run `cmp -s` on the generated file against [docs/meta.toon](../meta.toon). Exit 0 means in sync. The [Checks](#checks) section has a check command for the entry count and the block placement.

JSON on demand: `toon -d docs/meta.toon > meta.json` writes `meta.json` in the working directory. It is not a tracked file.

`toon` is the `@toon-format/cli` command-line tool. This page does not pin a version.

Ingestors. LangChain and LlamaIndex loaders read the Markdown text. They do not read an HTML comment (not verified for the versions in use). Feed them the JSON produced on demand from [docs/meta.toon](../meta.toon). Or use a preprocessing step that extracts the block first.

---

## Checks

[Back to navigation](#navigation)

Open question counts. Run this from the repository root. It reads the `## Open questions` table of [the roadmap proposal](../roadmap/PROPOSAL.md). It prints the rows per Owner, per Status and per Blocking (first word). It exits non-zero when a row lacks a field. It also exits non-zero when an open question has status `needs human decision`. The Ownership summary copies only what it prints.

```sh
set -o pipefail
awk -F'|' '
function trim(s){gsub(/^[ \t]+|[ \t]+$/,"",s);return s}
/^## /{s=($0=="## Open questions");next}
s&&/^\| OQ[0-9]+ /{
  id=trim($2);o=trim($5);b=trim($6);st=trim($7)
  if(NF!=8||o==""||b==""||st==""){print "bad row: " id > "/dev/stderr";bad=1;next}
  sub(/ .*/,"",b);n++;O[o]++;B[b]++;S[st]++
  if(st=="needs human decision"){print "open: " id > "/dev/stderr";bad=1}
}
END{
  print "rows " n
  for(k in O)print "owner " k ": " O[k]
  for(k in S)print "status " k ": " S[k]
  for(k in B)print "blocking " k ": " B[k]
  exit bad+(n==0)
}' docs/roadmap/PROPOSAL.md | sort
```

Metadata check. Run this from the repository root. It exits non-zero in any of these cases:

- `toon -d docs/meta.toon` fails.
- The number of entries in [docs/meta.toon](../meta.toon) differs from the number of tracked `.md` files minus `AGENTS.md` and `README.md`.
- A tracked `.md` file other than those two lacks a block on line 1.
- `AGENTS.md` or `README.md` carries a block on line 1.
- An id defined in `docs/requirements/` (bold definition or first table cell) is missing from every `ids` list, or appears in more than one `ids` list.

```sh
t=$(mktemp); toon -d docs/meta.toon > "$t" || exit 1
d=$(mktemp)
for f in $(git ls-files 'docs/requirements/*.md'); do
  awk 'function id(s){if(match(s,/(REQ|AC)-[A-Z0-9]+(-[A-Z0-9]+)*/))print substr(s,RSTART,RLENGTH)} match($0,/^(- )?\*\*[^*]*\*\*/){id(substr($0,RSTART,RLENGTH))} /^\| (REQ|AC)-/{id($0)}' "$f"
done | sort -u > "$d"
jq -r '.docs[].ids[]' "$t" | sort > "$d.m"
[ "$(uniq -d "$d.m" | awk 'END{print NR}')" = 0 ] || { echo "id with more than one definer" >&2; exit 1; }
cmp -s "$d" "$d.m" || { echo "ids differ from definitions" >&2; diff "$d" "$d.m" >&2; exit 1; }
rm -f "$d" "$d.m"
n=$(git ls-files '*.md' | awk '$0!="AGENTS.md"&&$0!="README.md"' | awk 'END{print NR}')
m=$(jq '.docs | length' "$t"); rm -f "$t"
[ "$n" = "$m" ] || { echo "entries $m, files $n" >&2; exit 1; }
for f in $(git ls-files '*.md'); do
  h=$(head -n 1 "$f" | awk '/^<!-- toon-m[e]ta[[:space:]]*$/{print "yes"}')
  case $f in
    AGENTS.md|README.md) [ -z "$h" ] || { echo "block in $f" >&2; exit 1; } ;;
    *) [ -n "$h" ] || { echo "no block: $f" >&2; exit 1; } ;;
  esac
done
```
