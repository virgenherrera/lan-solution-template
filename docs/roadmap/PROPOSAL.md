# Roadmap Proposal: lan-solution-template (SRS v1.6)

Status: PROPOSAL v2 — revised with 9 human decisions (see `## Log`). Not approved; no remote action executed (origin configured, nothing pushed).

Source: `lan-solution-template-SRS-v1.6.md` (sections 1-13). IDs below (REQ-*, AC-*, FR/NFR, R-*, A-*, Q-*, D-*) come from the SRS extraction files. Anything not found there is tagged `ASSUMPTION`.

## Context

The SRS v1.6 defines a LAN-first, offline-capable template: Angular 22 PWA (`apps/web-angular`), NestJS gateway (`apps/gateway-nest`), Nest standalone supervisor (`apps/runtime-nest`), a Tauri v2 desktop shell (`apps/desktop`) and `libs/shared-core`. Everything ships as one Node SEA per OS/arch (REQ-RUNTIME-01, FR-02). Persistence is SQLite (default) or PostgreSQL, both with vector search (REQ-DB-01).

Main risks (from the SRS): many very new versions whose existence is unverified (R-02, R11), the single-SEA design (R-04, R2), the sqlite-vector native extension (R-03), Drizzle `1.0.0-rc.5` (R-01, R-07), cross-OS process-tree shutdown (R1, R-04), and the native 3-OS CI matrix (R-01 of 11.4.1).

D-07 puts CI/CD last. D-03 asks for the smallest integrated micro-POCs. This proposal turns both into nine active POCs plus one backlog item (POC-6, PostgreSQL). POC-9 (CI/CD and releases) is on HOLD.

## Method

Shape Up.

- Cycle: 6 weeks of build plus 2 weeks of cooldown.
- Batches: small batch = 1-2 weeks, big batch = a full cycle.
- Appetite is a fixed time budget. Scope flexes, the date does not.
- Circuit breaker: a POC that is not shippable at the end of its appetite is NOT extended by default. It is stopped, its findings are published under `docs/`, and it is reshaped as a new pitch for the next betting table.
- Ordering: uncertainty first. The riskiest unknown is proven earliest, within dependency limits.
- Betting table before each cycle re-decides the bets. Nothing carries over automatically.
- Deliverable per POC: a PR from a branch whose prefix follows REQ-VERSION-02 (`major/`, `minor/`, `fix/`, plus exempt `docs/`, `chore/` per REQ-VERSION-02a), and a POC result page under `docs/` (migrated to the wiki at the end, see Backlog). The page labels each item implemented / verified / blocked-by-environment / out-of-scope (SRS 12.4, D-04, NFR-TRUTH-01) and declares the verified OS.
- Declared targets (decision 4): Windows (ideally 10+; see open questions), Linux, macOS, current Node LTS (tension with the SRS pin, see open questions).
- Before the CI POC exists, PR evidence = logs of root ECO commands run locally (REQ-TEST-10, D-02).
- Test policy everywhere: only APP-level and real E2E tests, no unit/integration suites (REQ-TEST-01, AC-19).
- Every remote action (push, open PR, `gh`, enable wiki) needs explicit human approval. Local rename `master` to `main` is a local action (decision 3).
- POC-9 is on HOLD until all other POCs are ready (decision 9).

## Cycles and bets

| Cycle | POCs | Length | Then |
|---|---|---|---|
| 1 | POC-0, POC-1, POC-2, POC-3 | ~5.5 weeks (0.4 + 1 + 2 + 2) | 2-week cooldown, betting table |
| 2 | POC-4, POC-5 | ~4 weeks (2 + 2) | 2-week cooldown, betting table |
| 3 | POC-7, POC-8 | ~3.5 weeks (1-2 + 2) | cooldown |
| After | POC-9 (only when HOLD is lifted), then docs migration to wiki | ~2 weeks + small | betting table |

| POC | Title | Appetite | Batch | Depends on | Branch |
|---|---|---|---|---|---|
| POC-0 | Repo bootstrap: docs in `docs/`, `main` branch | 1-2 days | small | none | `chore/poc-00-repo-bootstrap` |
| POC-1 | Toolchain viability + OS matrix + workspace skeleton | 1 week | small | POC-0 (not blocking) | `chore/poc-01-toolchain` |
| POC-2 | Single SEA + runtime supervisor | 2 weeks | big | POC-1 | `minor/poc-02-sea-supervisor` |
| POC-3 | Config (`config.json` + schema) + SQLite vector inside SEA | 2 weeks | big | POC-2 | `minor/poc-03-sqlite-vector` |
| POC-4 | HTTPS gateway (dev-certs-style TLS) serving Angular PWA + dev loop | 2 weeks | big | POC-2 (POC-3 not blocking) | `minor/poc-04-https-spa` |
| POC-5 | Tauri desktop shell with SEA sidecar + CA install + first-run setup | 2 weeks | big | POC-2, POC-4 | `minor/poc-05-tauri-sidecar` |
| POC-6 | PostgreSQL adapter parity | n/a | n/a | n/a | BACKLOG (see `## Backlog`) |
| POC-7 | Auth (user:password) + roles + protected UI | 1-2 weeks | small | POC-4, POC-5 | `minor/poc-07-auth-roles` |
| POC-8 | MSI credential dialog + native platform matrix + lockstep versioning | 2 weeks | big | POC-5, POC-7 | `chore/poc-08-matrix-versioning` |
| POC-9 | CI/CD GitHub Actions + Releases | 2 weeks | big | POC-8 | HOLD: `chore/poc-09-ci-cd` |

ASSUMPTION: appetites are estimates for one developer plus AI agents. The betting table may change them.

Ordering rationale: POC-2 (single SEA, same-binary re-entry, process shutdown) carries the highest uncertainty (R2, R1, R-04), so it comes right after the toolchain check. POC-3 follows because the native extension inside the SEA is the next unknown (R-03, R-06 of 11.5). CI/CD is last per D-07.

## Pitches

### POC-0: Repo bootstrap (docs in `docs/`, branch `main`)

- **Problem**: The repo has no commits, the local branch is `master` while the SRS refers to `main` (REQ-CI-04), and docs live only as local files. Decisions 2 and 3 say docs stay in `docs/` for now and the wiki is a final migration (Backlog). NFR-DOC-01 and D-05 require documented decisions; D-08 requires sync.
- **Appetite**: 1-2 days, small batch.
- **Solution sketch**:
  - Rename local branch: `git branch -m master main` (local only, no push).
  - Place SRS and roadmap under `docs/` (`docs/roadmap/PROPOSAL.md`; SRS location is a choice, ASSUMPTION).
  - Confirm origin `git@github.com:virgenherrera/lan-solution-template.git` (decision 1; per the plan it was checked with `git remote -v`, no verificado en este documento).
  - Define the page structure to ease the later wiki migration (see Wiki documentation plan).
- **Rabbit holes**: where the SRS file lives; README must stay in repo (NFR-DOC-01, D-08).
- **No-gos**: no wiki, no CI, no code, no push or `gh` without approval.
- **Circuit breaker**: if the rename or layout causes friction, keep files where they are and record it as an open decision.
- **Acceptance criteria**: branch is `main` (`git branch --show-current`), docs under `docs/`, NFR-DOC-01, D-05, D-08, REQ-REP-05 (documentation requirement).
- **Deliverable**: branch `chore/poc-00-repo-bootstrap`; PR title `chore: bootstrap repo with docs and main branch`. Result page `docs/results/POC-00-Result.md` (ASSUMPTION path). Opening the PR is a remote action needing approval.

### POC-1: Toolchain viability + workspace skeleton

- **Problem**: The SRS pins very new versions (Node >=26.13 <27, pnpm >=12.16.1, NestJS 12.3.2, Angular >=22.2.5, Zod >=4.6.7, drizzle-orm 1.0.0-rc.5, Tauri >=2.12.5, sqlite-vector 1.1.2). Their existence and compatibility are unverified (R-02, R11, R-08). Nothing else can start before this is known.
- **Appetite**: 1 week, small batch.
- **Solution sketch**:
  - Verify every pinned version exists and works together (NFR-15, NFR-VER-01). Pin Nx after discovery (NFR-08, REQ-BUILD-01).
  - pnpm workspace plus catalog: `savePrefix` empty, exact versions, `pnpm-lock.yaml` committed (NFR-11, NFR-12).
  - `minimumReleaseAge` 1440, `allowBuilds`, `strictDepBuilds` true (REQ-SUPPLY-01, REQ-SEC-CI-03). Verify pnpm 12 semantics (R-08, R6).
  - Nx local, no Nx Cloud.
  - Skeletons: `apps/web-angular`, `apps/gateway-nest`, `apps/runtime-nest`, `apps/desktop`, `libs/shared-core` (REQ-REP-01..03).
  - Root ECO scripts with explicit no-ops (REQ-ECO-01, REQ-ECO-02).
  - `securityCheck` fail-closed (REQ-SEC-CI-01, REQ-SEC-CI-02).
  - Test filter adapter stub (REQ-TEST-03, REQ-ECO-04).
  - OS matrix (decision 4): Windows (ideally 10+), Linux, macOS, current Node LTS. Reconcile with the SRS pin `>=26.13.0 <27` (REQ-STACK-01): record whether the pin is an LTS line or needs an SRS change. No verificado: whether Node 26 is LTS; verify in this POC.
- **Rabbit holes**: pnpm 12 option semantics; Oxlint/angular-eslint/Clippy coverage of Angular templates (REQ-ECO-05); Rust audit tool undefined (A9); Windows 10 support vs Node/Tauri/WebView2 minimums (no verificado).
- **No-gos**: no Nx Cloud, no drizzle-kit, no `bumpDependencies` or `test:doctor` (REQ-DEPS-01), no unit/integration suites, no `^` or `~` ranges.
- **Circuit breaker**: a missing version is documented with a technical link and a minimal substitution (NFR-15, NFR-VER-01, D-06). Do not invent APIs. If the toolchain cannot install, stop and report.
- **Acceptance criteria**: AC-01, AC-02 (host-checkable part), AC-13, AC-19, AC-23, AC-24, AC-32, AC-33 (host OS only), AC-34. Also NFR-01..15, REQ-ECO-01, REQ-ECO-02.
- **Deliverable**: branch `chore/poc-01-toolchain`; PR title `chore: verify toolchain versions and add workspace skeleton`. Result page `docs/results/POC-01-Result.md` with a version-verification table, the OS/Node matrix, and `ADR-001` if a substitution happens.

### POC-2: Single SEA + runtime supervisor

- **Problem**: The product depends on one SEA per platform that bundles dispatcher, runtime-nest and gateway-nest and relaunches itself by role (REQ-RUNTIME-01, REQ-RUNTIME-03, REQ-SEA-01). Viability of the native `node --build-sea` flow with bundled Nest is unproven (R2, R-04). Same-binary re-entry and process-tree shutdown on 3 OSes are hard (R1).
- **Appetite**: 2 weeks, big batch. Highest uncertainty.
- **Solution sketch**:
  - `tools/scripts/compile-sea.ts` using native `node --build-sea`, no postject (REQ-SEA-01, REQ-SEA-02, REQ-SEA-03).
  - Zod-validated dispatcher and closed service registry (REQ-RUNTIME-03).
  - `runtime-nest` uses `createApplicationContext(RuntimeModule)`, no HTTP listener (REQ-RUNTIME-02, FR-45).
  - Supervisor respawns `process.execPath --service gateway-nest`; no `node` from PATH.
  - Minimal `gateway-nest` with NodeAdapter and `/api` health endpoint (REQ-NET-01).
  - Stdio IPC shutdown, timeout, then force-kill of descendants, no orphans (REQ-RUNTIME-06).
  - Readiness timeout, per-service logs, bounded restart (REQ-RUNTIME-05).
  - Real-binary smoke test (REQ-RUNTIME-08).
- **Rabbit holes**: bundling Nest dependencies into one bundle; Windows process tree; `node:sea` asset limits (R-04); restart/backoff values undefined (A3).
- **No-gos**: no fake `auth-ms` (REQ-RUNTIME-05-GATE, D-03), no postject without documented need, no second executable, no Express/Fastify, no SPA yet.
- **Circuit breaker**: if the SEA cannot bundle Nest within the appetite, stop. Publish findings (what failed, which Node limits) and reshape: split bundling from supervision, or evaluate a documented postject need.
- **Acceptance criteria**: AC-11 (partial: no Node install on host), AC-28, AC-29, AC-30 (host OS only, others pending), REQ-RUNTIME-01..08, REQ-SEA-01..03, REQ-TEST-07 (supervisor subset).
- **Deliverable**: branch `minor/poc-02-sea-supervisor`; PR title `feat: single SEA with runtime supervisor and gateway health`. Results under `docs/`: `POC-02-Result`, `ADR-002` (single-SEA portability decision).

### POC-3: Config (`config.json` + schema) + SQLite vector persistence inside SEA

- **Problem**: Persistence must work from inside the SEA with a native vector extension extracted from an asset (R-03, REQ-DB-09). The custom migrator replaces drizzle-kit (R-06), and Drizzle is a release candidate (R-01, R-07).
- **Appetite**: 2 weeks, big batch.
- **Solution sketch**:
  - Zod 4 persisted, namespaced config as immutable DI singleton (REQ-CFG-01, REQ-CFG-02, REQ-CFG-04, REQ-CFG-06).
  - Config design (decision 6; summary of research, sin QC): `z.toJSONSchema()` (Zod 4) generates a versioned `config.schema.json`; the installer places the schema in the install path; the real `config.json` lives in the OS config dir (REQ-CFG-05 L165, REQ-SEA-05 L502) with an absolute `$schema`; `$schema` is optional in Zod. A tag-pinned GitHub URL is a secondary schema source. Open: decision 6 says `config.json` in the install path, which conflicts with REQ-CFG-05 (see open questions).
  - Strategy port for DB adapters (REQ-DB-01, REQ-DB-02).
  - Engine for now: SQLite + vector only (decision 8). PostgreSQL is Backlog.
  - SQLite via `node:sqlite` plus Drizzle `1.0.0-rc.5` plus sqlite-vector 1.1.2. The native library is extracted from a SEA asset with an integrity check per OS/arch (REQ-DB-09).
  - Custom migrator with version/checksum/applied_at, tamper detection, locking, transaction per engine (REQ-DB-04, REQ-DB-05).
  - Startup order: config, adapter, connection, vector check, migrations, ready (REQ-DB-06).
  - `foreign_keys` on, evaluate WAL, explicit durability, DB outside the SEA (REQ-DB-07, REQ-SEA-05).
  - Offline vector insert and similarity query (REQ-DB-08).
- **Rabbit holes**: Drizzle RC API drift; native extension per OS/arch; where persisted config lives before the DB exists (A-01); migration owner and locking (R9, REQ-RUNTIME-07).
- **No-gos**: no drizzle-kit, no silent non-vector fallback (REQ-DB-08), no client-supplied extensions, no secrets in CLI args (REQ-CFG-06), no mocks of persistence (REQ-TEST-04-ISO).
- **Circuit breaker**: if the vector extension cannot load from the SEA on the host OS, stop. Publish the findings and reshape the extraction approach. Document the Drizzle RC decision either way (D-05).
- **Acceptance criteria**: AC-07, AC-08, AC-10 (persistence/vector part), REQ-CFG-01..06, REQ-DB-01..09, REQ-TEST-06 (SQLite part), REQ-SEC-06.
- **Deliverable**: branch `minor/poc-03-sqlite-vector`; PR title `feat: config singleton and SQLite vector persistence in SEA`. Results under `docs/`: `POC-03-Result`, `ADR-003` (Drizzle RC compatibility).

### POC-4: HTTPS gateway serving the Angular PWA from the SEA + dev loop

- **Problem**: One Angular build must be served over HTTPS by the gateway to browsers and the Tauri WebView (FR-04). Assets must be materialized safely from the SEA (R3, R-07). Developers need a fast loop that does not need the SEA (REQ-DEV-01..05). Local CA trust is a known friction (R-05).
- **Appetite**: 2 weeks, big batch.
- **Solution sketch**:
  - Angular 22, zoneless, strict TypeScript, Signals, Tailwind, PWA (REQ-WEB-01, REQ-PWA-01).
  - `ng serve` on 4200 with `proxyConfig` `/api/**` to 8443 using a trusted dev CA, no `secure:false` (REQ-DEV-01..04).
  - TLS identity generation with SAN handling (REQ-TLS-01, REQ-TLS-04).
  - TLS design (decision 7, `dotnet dev-certs` style; sin QC): local CA per installation plus a renewable leaf reissued on SAN/IP change (Node, `@peculiar/x509`; a spike comes first, library choice open per A-04); separate dev CA with `NODE_EXTRA_CA_CERTS`; mobile clients install the CA by hand (REQ-TLS-02).
  - HTTPS 8443 plus HTTP 8080 308 redirect without Host-based open redirect (REQ-NET-06, REQ-NET-08).
  - SPA materialization to a per-version hashed cache: manifest, checksums, atomic publish, concurrency-safe, stale cleanup (REQ-NET-03, REQ-NET-04, REQ-SEA-04).
  - `ServeStaticModule` only when `isSea()`, configured before `NestFactory.create` (REQ-NET-02, REQ-NET-05).
  - `/api/**` never falls back to `index.html`; missing assets give 404 (REQ-NET-07).
  - Revalidatable cache headers for `index.html` and the service worker; hashed files immutable (REQ-PWA-02).
- **Rabbit holes**: x509 library spike result (first task of the POC); device CA trust on iOS/Android (document only, no auto-trust; REQ-TLS-02); TLS crypto library choice (A-04); SPA fallback rule for dotted routes (A-11); cache header values.
- **No-gos**: no `secure:false` shipped, no `rejectUnauthorized=false` (REQ-TLS-03), no automatic CA trust on client devices, no private-key distribution, no offline browser sync, no fake Module Federation remotes (REQ-WEB-04).
- **Circuit breaker**: if the full PWA install flow on mobile is not reachable, ship HTTPS serving plus desktop-browser load only and publish the mobile trust findings. Reshape the PWA install part as a new pitch.
- **Acceptance criteria**: AC-04, AC-05, AC-12, AC-14, AC-15, AC-16, AC-17, REQ-NET-01..08, REQ-TLS-01..04, REQ-PWA-01..03, REQ-DEV-01..05, REQ-WEB-01, REQ-TEST-05 (dev :4200 and :8443 smoke subset).
- **Deliverable**: branch `minor/poc-04-https-spa`; PR title `feat: HTTPS gateway serving Angular PWA from SEA`. Results under `docs/`: `POC-04-Result`, `ADR-004` (TLS trust model), device-trust guide.

### POC-5: Tauri desktop shell with SEA sidecar + CA install + first-run setup

- **Problem**: The desktop host must start, monitor and stop the SEA supervisor, show state in the tray and keep the gateway reachable from the LAN while the window is hidden (REQ-DESK-02, REQ-DESK-06). Tray, autostart and single-instance behavior differ per OS (R5, R-10).
- **Appetite**: 2 weeks, big batch.
- **Solution sketch**:
  - SEA as `externalBin` sidecar, one per target triple (REQ-DESK-01).
  - Tauri only starts, monitors and stops the supervisor (REQ-DESK-02).
  - Tray: starting/ready/error, Open UI, Quit; window close hides to tray; Quit cleans the tree (REQ-DESK-03).
  - Autostart at OS login (REQ-DESK-04), single instance, port-busy handling, orphan handling, crash recovery (REQ-DESK-05).
  - Restricted IPC capabilities (REQ-SEC-05); no shell/sidecar privileges for LAN-served frontend.
  - WebView loads the gateway origin (AC-18).
  - Tauri installs `ca.crt` into the OS trust store with explicit consent (REQ-TLS-02).
  - First-run setup common to Linux/macOS (loopback-only flow to set the initial credential); on Windows the MSI sets it (POC-8). Exact flow is an ASSUMPTION, see open questions.
  - Native E2E via `@wdio/tauri-service` on an instrumented build, excluded from the commercial installer (REQ-TEST-08, AC-20).
- **Rabbit holes**: per-OS WebDriver support (R4); drift between instrumented and shipped build (R-09 of 11.4.1); autostart default (A7); whether the tray shows a degraded state (A5).
- **No-gos**: Tauri does not host a second SPA or a public port, no pre-login native service claim (REQ-DESK-04), no WDIO plugin in the product, no cross-OS claims without native runs (REQ-TEST-09).
- **Circuit breaker**: if native WebDriver E2E is not workable on the host OS, ship the black-box installer smoke only, label E2E blocked-by-environment, and reshape E2E as a new pitch.
- **Acceptance criteria**: AC-03, AC-18, AC-20, AC-30 (host OS), REQ-DESK-01..06, REQ-SEC-05, REQ-TEST-08, REQ-ECO-06 (Tauri after SEA).
- **Deliverable**: branch `minor/poc-05-tauri-sidecar`; PR title `feat: Tauri shell supervising SEA sidecar with tray`. Results under `docs/`: `POC-05-Result`, `ADR-005` (desktop process model).

### POC-7: Auth (user:password) + roles + protected UI

- **Problem**: LAN is untrusted (REQ-SEC-01). Roles public/employee/admin must be enforced in NestJS, not only in Angular (REQ-SEC-02). Decision 5: vanilla user:password auth; the credential is set by the user in the MSI; a dev override exists for admin/root.
- **Appetite**: 1-2 weeks, small batch. Depends on POC-5 (first-run setup / CA install).
- **Solution sketch**:
  - Auth design (decision 5; sin QC): scrypt via Node native (argon2id only if Node ships it, no verificado); NIST 800-63B-style policy (15+ chars, blocklist, no composition rules); exponential throttle per account/IP; server-side sessions in SQLite with cookie `__Host-sid`; CSRF via SameSite plus Origin check.
  - Initial credential: set by the user at install (MSI, POC-8) or first-run setup on Linux/macOS (POC-5). No permanent default credentials (REQ-SEC-02).
  - Dev override for admin/root: explicit flag plus `NODE_ENV=development` plus bind 127.0.0.1, stripped from release builds, with a smoke test proving absence. Conflicts with REQ-SEC-02 (L349) and L947 (D-07: no insecure demo credentials; the plan's "password from local `.env`" is no verificado in the SRS); needs human reconciliation (open questions).
  - Roles public/employee/admin; Nest guards returning 401/403 (REQ-SEC-01).
  - Retro ARPANET terminal public page, logon, minimal protected employee and admin routes (REQ-WEB-02).
  - Lazy-loaded role routes; unauthorized views not rendered in the DOM; API still blocks (REQ-WEB-03, REQ-SEC-03).
  - Strict payload validation and size limits, auth-abuse defenses (REQ-SEC-04, REQ-CFG-03).
  - Playwright on dev :4200 and distributed :8443 (REQ-TEST-05).
- **Rabbit holes**: dev override vs REQ-SEC-02; session store location; scope of the dev-mode proxy test (A10).
- **No-gos**: no insecure demo credentials (D-07), no fake `auth-ms`, no secrets in browser bundles (REQ-SEC-03), no security via hidden JS only, no dev override in release builds.
- **Circuit breaker**: if the dev override cannot be proven absent from the release build, ship without it and reshape.
- **Acceptance criteria**: AC-06, REQ-SEC-01..04, REQ-SEC-06, REQ-WEB-02..04, REQ-TEST-05.
- **Deliverable**: branch `minor/poc-07-auth-roles`; PR title `feat: user:password auth with roles and protected API and UI`. Results under `docs/`: `POC-07-Result`, `ADR-006` (auth mechanism).

### POC-8: MSI credential dialog + native platform matrix + lockstep versioning

- **Problem**: A macOS pass does not imply Windows/Linux (AC-21, NFR-PORT-01, REQ-TEST-09). Lockstep versioning must also reach `tauri.conf.json` and `Cargo.toml`, which Nx Release does not update by itself (R-02 of 11.3).
- **Appetite**: 2 weeks, big batch.
- **Solution sketch**:
  - MSI dialog for the initial credential: hidden property plus `MsiHiddenProperties`, hash computed in a deferred custom action (design, no verificado). Smoke test per OS that the credential works and no default exists.
  - Run root ECO commands natively on each declared OS/arch; record a result matrix verified/pending/blocked (REQ-TEST-10, D-02).
  - Nx Release fixed group, `release:version` syncing `tauri.conf.json` and `Cargo.toml`, validating all version refs, reproducible changelog (REQ-VERSION-01, REQ-VERSION-03).
  - Branch-to-SemVer mapping validation (REQ-VERSION-02, REQ-VERSION-02a, REQ-VERSION-02b).
- **Rabbit holes**: runner/VM availability (Q-08); Windows x64 vs ARM (R4); release group membership incl. runtime-nest (Q-01); exemption mechanism for `docs/*` and `chore/*` (Q-02).
- **No-gos**: no cross-OS claims without native verification, Docker does not replace native installer validation (REQ-TEST-09), no CI workflow yet.
- **Circuit breaker**: if only some OSes are reachable, close with a partial matrix declared as such (NFR-PORT-01), mark the rest pending/blocked, and reshape the remainder as a new pitch.
- **Acceptance criteria**: AC-21, AC-25, AC-33, REQ-VERSION-01..03, REQ-TEST-09, REQ-TEST-10, NFR-PORT-01, NFR-TRUTH-01.
- **Deliverable**: branch `chore/poc-08-matrix-versioning`; PR title `chore: native platform matrix and lockstep versioning`. Results under `docs/`: `Platform-Matrix`, `POC-08-Result`.

### POC-9: CI/CD GitHub Actions + Releases (final phase, D-07) — HOLD

- **Status**: HOLD (decision 9) until all other POCs are ready. Scope of HOLD is an open question (does it also hold PR pushes per POC?).
- **Problem**: CI/CD is in scope only after local commands are stable (D-07, FR-46). The release flow must work with branch protection, no amend or force-push, serialized releases and idempotent reruns (R-03, R-10 of 11.4).
- **Appetite**: 2 weeks, big batch.
- **Solution sketch**:
  - `ci-cd.yml` calls only root scripts (REQ-CI-07, REQ-ECO-07, FR-08).
  - PR CI on Windows/Linux/macOS native runners: install, securityCheck, build, test, package, smoke (REQ-CI-01, REQ-CI-09, D-09).
  - CD from a versioned SHA: new release commit or release PR, no amend (REQ-CI-04), tag `vX.Y.Z`, SHA-256 hashed installers with OS/arch names, smoke before upload (REQ-CI-05, REQ-CI-10, D-10).
  - Serialized releases per target branch, idempotent reruns (REQ-CI-06).
  - Minimal permissions, `contents:write` only on release jobs (REQ-CI-03, REQ-SEC-CI-04).
  - Signing only if credentials exist; unsigned artifacts never declared signed (R-08).
- **Rabbit holes**: bot commit vs release PR (Q-03); branch protection; macOS/Windows runner cost and setup (R-01 of 11.4.1); Rust audit tooling (A9, R7).
- **No-gos**: no cloud deploy, no direct `nx`/`jest`/`ng`/`cargo`/`ncu`/`postject` in the workflow, no `continue-on-error` on audit, no amend/force-push, no untrusted-PR cache, no `securityFix` run silently (REQ-DEPS-02a). Every remote/`gh` action needs human approval.
- **Circuit breaker**: if a mandatory platform cannot run, the release is blocked, not green (REQ-CI-02, REQ-CI-06). Ship PR CI only, publish findings, and reshape CD as a new pitch.
- **Acceptance criteria**: AC-26, AC-27, AC-35, AC-36, REQ-CI-01..10, REQ-SEC-CI-01..04, AC-02, AC-32.
- **Deliverable**: branch `chore/poc-09-ci-cd`; PR title `chore: GitHub Actions CI and release pipeline`. Results under `docs/`: `POC-09-Result`, `ADR-007` (release flow).

## No-gos

Global, from the SRS:

- No Nx Cloud (REQ-BUILD-01).
- No drizzle-kit (REQ-DB-04).
- No Express/Fastify (REQ-NET-01, REQ-STACK-04).
- No postject unless a documented need exists (REQ-SEA-02).
- No fake `auth-ms` (D-03).
- `bumpDependencies` and `test:doctor` are not implemented, docs only (REQ-DEPS-01).
- No unit/integration suites (REQ-TEST-01, AC-19).
- No `secure:false` shipped (REQ-DEV-04).
- No fake Module Federation remotes (REQ-WEB-04).
- No cloud deploy (D-07).
- No fake LLM engine (D-07).
- No insecure demo credentials (D-07).
- No offline browser sync (D-07).
- No cross-OS claims without native verification (REQ-TEST-09, NFR-PORT-01).
- No automatic CA trust on client devices (REQ-TLS-02).

## Wiki documentation plan

Decision 2: docs live only in `docs/` for now; they migrate to the GitHub Wiki (separate git repo `<repo>.wiki.git`) when consolidated (Backlog). The structure below is the target of that migration.

Page structure (flat, unique names):

- `Home`, `_Sidebar`, `_Footer`
- `SRS-v1.6`
- `Roadmap`
- `Pitch-POC-NN-<slug>`
- `POC-NN-Result`
- `ADR-NNN-<slug>` (decisions per SRS 12.5 / D-05: portability, security, Drizzle RC)
- `Platform-Matrix` (REQ-TEST-10)
- `Glossary` (optional)

| Source | Wiki page |
|---|---|
| `lan-solution-template-SRS-v1.6.md` | `SRS-v1.6` |
| `docs/roadmap/PROPOSAL.md` | `Roadmap` |
| each pitch section of the proposal | `Pitch-POC-NN-<slug>` |
| POC evidence (logs, labels, verified OS) | `POC-NN-Result` |
| decisions | `ADR-NNN-<slug>` |
| native results matrix | `Platform-Matrix` |

Tensions and rules:

- NFR-DOC-01 and D-08 require Mermaid diagrams in README/architecture, kept in sync with what is built. The README therefore stays in the repo even if the wiki holds the rest.
- Wiki edits are not reviewed via PR by default. Proposal: every wiki change references the PR of its POC.
- ASSUMPTION (verify): `.wiki.git` only exists after the wiki is enabled and a first page is created in the web UI.
- All wiki setup and pushes are remote actions that need explicit human approval.

## SRS coverage matrix

| SRS section | Topic | Covered by |
|---|---|---|
| 1 | Purpose and scope (FR-01..05, FR-45, FR-46) | POC-2, POC-4, POC-5, POC-9 |
| 2 | Tech baseline and reproducibility (REQ-STACK-01..10, REQ-SUPPLY-01/02, NFR-15) | POC-1, Backlog POC-6 (pgvector), POC-3 (Drizzle, sqlite-vector) |
| 3 | Expected file structure (REQ-REP-01..05) | POC-1, POC-0 (docs) |
| 4 | Configuration (REQ-CFG-01..06) | POC-3 |
| 5 | Persistence, vectors, migrations (REQ-DB-01..09) | POC-3 (SQLite); PostgreSQL parts in Backlog POC-6 |
| 6 | Dev, web packaging, LAN gateway, HTTPS, PWA (REQ-DEV, REQ-NET, REQ-TLS, REQ-PWA) | POC-4 |
| 7 | Default security (REQ-SEC-01..06) | POC-7, POC-5 (REQ-SEC-05), POC-3 (REQ-SEC-06) |
| 8 | Angular web (REQ-WEB-01..04) | POC-4 (REQ-WEB-01), POC-7 (REQ-WEB-02..04) |
| 9 | Desktop Tauri and processes (REQ-DESK, REQ-RUNTIME) | POC-5, POC-2 |
| 10 | Node SEA and distribution (REQ-SEA-01..06) | POC-2, POC-4, POC-8 (REQ-SEA-06) |
| 11 | Nx, quality, tests (11.0 build/test/security, 11.1 ECO, 11.2 refs/deps, 11.3 versioning, 11.4 CI/CD, 11.5 acceptance, 11.6 portability) | POC-1 (ECO, REQ-DEPS, security gate), POC-8 (11.3, 11.6, REQ-TEST-09/10), POC-9 (11.4, 11.4.1), POC-2..7 (REQ-TEST-04..08 per feature) |
| 12 | Delivery instructions (D-01..D-10, NFR-TRUTH-01, NFR-DOC-01, NFR-VER-01) | POC-0, POC-1, every POC result page |
| 13 | Technical and normative references | POC-1 (version verification), POC-0 (ADR/doc links) |

Acceptance criteria coverage:

| AC | POC | AC | POC |
|---|---|---|---|
| AC-01 | POC-1 | AC-19 | POC-1 |
| AC-02 | POC-1, POC-9 | AC-20 | POC-5 |
| AC-03 | POC-5 | AC-21 | POC-8 |
| AC-04 | POC-4 | AC-22 | POC-1 |
| AC-05 | POC-4 | AC-23 | POC-1 |
| AC-06 | POC-7 | AC-24 | POC-1 |
| AC-07 | POC-3 | AC-25 | POC-8 |
| AC-08 | POC-3 | AC-26 | POC-9 |
| AC-09 | Backlog (POC-6) | AC-27 | POC-9 |
| AC-10 | POC-3, POC-4 | AC-28 | POC-2 |
| AC-11 | POC-2, POC-5 | AC-29 | POC-2 |
| AC-12 | POC-4 | AC-30 | POC-2, POC-5, POC-8 |
| AC-13 | POC-1 | AC-31 | POC-2 (registry design only) |
| AC-14 | POC-4 | AC-32 | POC-1, POC-9 |
| AC-15 | POC-4 | AC-33 | POC-1 (host), POC-8 |
| AC-16 | POC-4 | AC-34 | POC-1 |
| AC-17 | POC-4 | AC-35 | POC-9 |
| AC-18 | POC-5 | AC-36 | POC-9 |

## Open questions

Answered by the human (items 1-9 of `## Log`) were removed from this list: remote URL, wiki as final migration, `main`, targets, auth, config, TLS, DB engine, release HOLD. Remaining, each needs a human decision (SRS id in parentheses):

1. `config.json` in the install path (decision 6) vs REQ-CFG-05 (L165) and REQ-SEA-05 (L502) requiring config outside the executable in OS config dirs. Proposal: schema in install path, real config in OS config dir.
2. Dev override for admin/root (decision 5) vs REQ-SEC-02 (L349) and L947 (D-07, no insecure demo credentials). Needs SRS amendment or constrained design.
3. "Current Node LTS" (decision 4) vs pin `>=26.13.0 <27` (REQ-STACK-01). Is Node 26 LTS? No verificado.
4. Windows 10 support: "idealmente 10+". Hard requirement or best effort? Tauri/WebView2/Node minimums not verified.
5. First-run setup for Linux/macOS (no MSI): loopback setup flow acceptable?
6. Scope of POC-9 HOLD: does it also hold pushes and PRs per POC, or only CI/CD?
7. Minimum verified-OS set to close a micro-POC (Q-08, NFR-PORT-01).
8. TLS crypto library and key storage per OS (A-04, Q-07); spike pending.
9. Release via bot commit vs release PR (Q-03), relevant when HOLD lifts.
10. Nx release group membership, including runtime-nest (Q-01).
11. Restart, backoff and readiness values (A3).
12. Autostart default on or opt-in (A7).
13. Rust audit tool and threshold (A9).
14. Persisted config bootstrap before the DB exists (A-01), with decision 6 in mind.

## Log

Human decisions (source: plan `optimized-wondering-waffle.md`, "Decisiones registradas"):

1. origin = `git@github.com:virgenherrera/lan-solution-template.git`.
2. Docs only in `docs/`; migrate to the wiki when consolidating (final backlog item).
3. Branch `main` (rename local with `git branch -m master main`; no push).
4. Targets: Windows (ideally 10+), Linux, macOS, current Node LTS.
5. Auth: vanilla user:password; credential set by the user in the MSI; dev override for admin/root.
6. `config.json` in the install path with `$schema`; sibling versioned schema.
7. TLS in the style of `dotnet dev-certs`.
8. DB: SQLite + vector for now.
9. Release automation on HOLD until all POCs are ready.

Design notes for auth, config and TLS are research summaries without QC (sin QC); they are embedded in POC-7, POC-3, POC-4/5 and POC-8.

## Backlog

- POC-6: PostgreSQL adapter parity (`pg` + pgvector >=0.8.7 behind the same port; REQ-DB-01..03, REQ-DB-05, REQ-DB-08, AC-09, REQ-TEST-06 PG part). Deferred by decision 8. Original appetite 1 week, small batch; original branch name `minor/poc-06-postgres-pgvector`. Circuit breaker unchanged: pgvector not installable means blocked-by-environment.
- Docs migration to GitHub Wiki (decision 2): enable wiki (needs approval), create first page in the web UI (ASSUMPTION, verify), clone `.wiki.git`, publish pages per the Wiki documentation plan. Last item, after POC-9 is unblocked or earlier at the human's call.

## Assumptions

- ASSUMPTION: one developer plus AI agents.
- ASSUMPTION: first POCs are verified on a macOS host only and declared as such (NFR-TRUTH-01).
- ASSUMPTION: appetites are estimates.
- ASSUMPTION: branch prefixes for POC PRs reuse the REQ-VERSION-02 naming (`major/`, `minor/`, `fix/`, `docs/`, `chore/`).
- ASSUMPTION: the wiki `.wiki.git` repo requires a first page created in the web UI (verify).
- ASSUMPTION: ADR numbering and page slugs are proposals, not SRS requirements.
- ASSUMPTION: the mapping of SRS sections 3 and 13 to POC-1 and POC-0 is a planning choice; the SRS does not assign them to phases.
