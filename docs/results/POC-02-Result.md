<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02-Result.md
title: "POC-2 Result"
type: backlog
summary: "Consolidated result of POC-2 slices 2a to 2h: commits, measurements, OS matrix, deviations and inherited and new pending items."
related[10]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2h-result-and-adr.md,docs/results/POC-02a-launcher-cwd.md,docs/results/POC-02b-dispatcher-registry.md,docs/results/POC-02c-assembler-registry.md,docs/results/POC-02d-readiness-logs.md,docs/results/POC-02e-bounded-restart.md,docs/results/POC-02f-coordinated-shutdown.md,docs/results/POC-02g-real-binary-smoke.md,docs/architecture/adr/ADR-002-single-sea-portability.md
status: current
updated: 2026-10-31
-->

# POC-2 Result

Consolidated result of POC-2, slices 2a to 2g, closed by slice 2h. Backlog: [POC-2 umbrella](../backlog/poc-2-single-sea-runtime-supervisor.md), [POC-2h](../backlog/poc-2h-result-and-adr.md) and [backlog index](../backlog/README.md). Slice pages: [2a](POC-02a-launcher-cwd.md), [2b](POC-02b-dispatcher-registry.md), [2c](POC-02c-assembler-registry.md), [2d](POC-02d-readiness-logs.md), [2e](POC-02e-bounded-restart.md), [2f](POC-02f-coordinated-shutdown.md), [2g](POC-02g-real-binary-smoke.md). Decision record: [ADR-002](../architecture/adr/ADR-002-single-sea-portability.md). Pattern: [POC-1 result](POC-01-Result.md).

## Navigation

- [Summary](#summary)
- [Slices and commits](#slices-and-commits)
- [Measured values (OQ11, decision D2)](#measured-values-oq11-decision-d2)
- [OS and architecture matrix](#os-and-architecture-matrix)
- [Acceptance criteria](#acceptance-criteria)
- [Inherited items from POC-1](#inherited-items-from-poc-1)
- [Pending items: inherited and new](#pending-items-inherited-and-new)
- [Files and the command that wrote them](#files-and-the-command-that-wrote-them)
- [Deviations](#deviations)
- [Requirement text review](#requirement-text-review)
- [Not verified](#not-verified)

## Summary

- POC-2 is delivered as eight slices on one branch, `minor/poc-02-supervisor` (decision D1), one commit or commit group per slice, one draft PR. No push and no PR was made by this documentation work.
- One SEA binary per platform runs the supervisor with no argument and re-enters itself with `--service <id>`. Registered ids come from a closed Zod registry in `libs/service-registry` (2b, 2c).
- The supervisor knows readiness, prefixes every log line, derives one aggregate state (2d), restarts a crashed service with bounded backoff (2e), and stops services over IPC with a timeout and a process-tree kill (2f).
- One scripted smoke check of 11 checks runs on the packaged binary as a post-step of `package` (decision D5). It passed on macOS arm64, Debian bookworm-slim arm64 and Debian bookworm-slim amd64 (Rosetta, cross-built binary) ([2g](POC-02g-real-binary-smoke.md)).
- Windows is not verified (decision D3, [REQ-TEST-09](../requirements/11-nx-quality-testing.md)). This page makes no claim of Windows support.
- Every number below comes from a slice page or a QC report named next to it. A QC report is a TOON file in the session scratch area (not in the repository). "not verified" means no page or report shows it.

## Slices and commits

| Slice | Commit | Subject | Page | Independent QC report |
|---|---|---|---|---|
| plan | `7dd959f` | docs: plan poc-2 as slices 2a to 2h (#10) | [umbrella](../backlog/poc-2-single-sea-runtime-supervisor.md) | none |
| decisions | `f659070` | docs: record poc-2 human decisions D1 to D5 | [umbrella](../backlog/poc-2-single-sea-runtime-supervisor.md#decisions-for-the-human) | none |
| 2a | `a606db3` | docs: record poc-2a launcher cwd under launchd and systemd | [2a](POC-02a-launcher-cwd.md) | none found |
| 2b | `48987d4` | feat: add zod dispatcher and closed service registry (POC-2b) | [2b](POC-02b-dispatcher-registry.md) | `qc-2b-rerun.toon` (commit `ec90de9`, 6 selector cases PASS) |
| 2b fix | `ec90de9` | fix: revert unrequested zod lockfile bump and record 2b selector evidence | [2b](POC-02b-dispatcher-registry.md) | `qc-2b-rerun.toon` |
| 2c | `0f7a834` | feat: drive the sea assembler from the service registry (POC-2c) | [2c](POC-02c-assembler-registry.md) | `qc-2c.toon` (18 pass, 3 not run, 0 fail); `docker-2c-verify.toon` |
| 2d | `97b5f01` | feat: add supervisor readiness, prefixed logs and aggregate health (POC-2d) | [2d](POC-02d-readiness-logs.md) | no QC report found; evidence is the slice page only |
| 2e | `06ab764` | feat: add bounded service restart with backoff (POC-2e) | [2e](POC-02e-bounded-restart.md) | `qc-2e.toon` (pass with observations; one fail, see pending item 2) |
| 2e follow-up | `ef5c429` | task: centralize state literals in service-registry | [2d](POC-02d-readiness-logs.md), [ADR-002](../architecture/adr/ADR-002-single-sea-portability.md#state-words) | `qc-2f.toon` checks "state_literals" pass |
| 2f | `85a8ed3` | feat: add coordinated shutdown and tree kill (POC-2f) | [2f](POC-02f-coordinated-shutdown.md) | `qc-2f.toon` (pass with reservations) |
| 2g | `d5e8b04` | feat: add real-binary smoke as package post-step (POC-2g) | [2g](POC-02g-real-binary-smoke.md) | no QC report found; evidence is the slice page only |
| 2h | the commit that adds this page | docs: close poc-2 with result page and adr-002 | this page | none |

## Measured values (OQ11, decision D2)

Decision D2 accepted the [OQ11](../roadmap/PROPOSAL.md#open-questions) values as constants of one Zod schema (`SUPERVISOR_CONFIG`, `libs/service-registry/src/supervisor-config.ts`). The table gives the constant and what was measured on macOS arm64, Node 26.13.0, one service (`api-gateway`). OQ11 itself is not edited here: that needs the human.

| Value | Constant | Measured | Source |
|---|---|---|---|
| Readiness timeout | `readinessTimeoutMs` 30000 | gateway never listens: `not ready within 30000 ms`, then `state error`, supervisor exit 1 after 32 s, 0 processes left | [2d](POC-02d-readiness-logs.md#late-and-never-listening-gateway) |
| Late gateway | within the timeout | `GW_DELAY_MS=5000` (scratch edit): `ready`, health 200 `ready` at about 7 s after launch | [2d](POC-02d-readiness-logs.md#late-and-never-listening-gateway) |
| Backoff, initial, factor, cap | 1000 ms, 2, 30000 ms | delay n = `min(1000 * 2^n, 30000)` | [2e](POC-02e-bounded-restart.md) |
| Jitter | 0.2 | six kills, page: 997, 1617, 4245, 9368, 17845 ms; QC rerun: 1053, 2266, 3369, 7107, 16429 ms. Allowed ranges 800 to 1200, 1600 to 2400, 3200 to 4800, 6400 to 9600, 12800 to 19200 ms. All ten values are inside their ranges. | [2e](POC-02e-bounded-restart.md#six-kills-in-a-row), `qc-2e.toon` |
| Restart budget (window D2) | `maxRestarts` 5 in `restartWindowMs` 300000 | exit 6: `restart budget exhausted: 5 restarts in 300000 ms; no further spawn`, `state error`, supervisor exit 1, no seventh spawn. First kill to `error` about 36.4 s | [2e](POC-02e-bounded-restart.md#six-kills-in-a-row), `qc-2e.toon` check "kill6_budget" |
| Stable reset | `stableResetMs` 60000 | after 62 s idle the next kill logs `restart 1/5` (972 ms then 1070 ms in the page; 1042 ms in the QC rerun) | [2e](POC-02e-bounded-restart.md#counter-reset-after-60-s), `qc-2e.toon` check "stability_reset_60s" |
| Window pruning after 300 s | `restartWindowMs` | not measured | [2e](POC-02e-bounded-restart.md#not-verified) |
| Exit before ready (port busy) | same budget | page: 1177, 1830, 4642, 7254, 17209 ms, budget gone in 34 s; QC rerun: 943, 1687, 3303, 6511, 13070 ms, exhausted after 26.3 s | [2e](POC-02e-bounded-restart.md#exit-before-ready-port-busy), `qc-2e.toon` check "startup_failure_budget" |
| Worst single delay | cap before jitter | up to 36 s by construction (30000 plus 20 percent). Whether it suits the desktop shell: not verified | [2e](POC-02e-bounded-restart.md#not-verified) |
| Graceful stop | `gracefulStopMs` 10000 | `SIGTERM` exit 0 in 0.007 s; frozen gateway: escalation at 10.003 s, tree gone 8 ms later, exit 10.017 s; QC: stopped after 10.07 s, `killed 10017 ms` | [2f](POC-02f-coordinated-shutdown.md#stop-timings), `qc-2f.toon` check "hung_child_sigstop_sigterm" |
| Supervisor `SIGKILL` | none | gateway gone after 0.032 s (page) and 0.06 s (QC) | [2f](POC-02f-coordinated-shutdown.md#supervisor-death), `qc-2f.toon` |
| Resident memory | not constrained | supervisor 86912 KB, gateway 96304 KB (`ps rss`) | [2d](POC-02d-readiness-logs.md#observed-outputs) |
| SEA size | not constrained | macOS arm64 148224928 bytes; Linux arm64 153214000, Linux amd64 153209984 (build in container), cross-built amd64 153062528 bytes | [2c](POC-02c-assembler-registry.md#sea-size-and-reproducibility), `docker-2c-verify.toon` |
| Smoke duration | none | 11 of 11 checks: 35.4 s macOS (whole `package` 1 m 7 s), 34.6 s node image arm64, 36.6 s slim arm64, 42.0 s slim amd64 (Rosetta) | [2g](POC-02g-real-binary-smoke.md#observed-outputs) |

## OS and architecture matrix

| OS | Architecture | Status | Evidence |
|---|---|---|---|
| macOS 27.2 (host) | arm64 | verified | all slices; [2g](POC-02g-real-binary-smoke.md) 11 of 11 checks |
| Linux, Debian GNU/Linux 13 (trixie), `node:26-trixie`, privileged systemd container | arm64 | verified in Docker, container, not a real host (2a only: launchd and systemd cwd) | [2a](POC-02a-launcher-cwd.md#results) |
| Linux, `node:26.13.0-bookworm` and `debian:bookworm-slim` | arm64 | verified in Docker (`libatomic1` installed on the slim image) | [2g](POC-02g-real-binary-smoke.md#observed-outputs), `docker-2c-verify.toon` item C |
| Linux, `debian:bookworm-slim` | amd64 | verified in Docker under Rosetta, binary cross-built on Linux arm64; real x64 hardware not verified | [2g](POC-02g-real-binary-smoke.md#rosetta-finding), `docker-2c-verify.toon` items C and D |
| Linux, real host | any | not verified | none |
| macOS to Linux cross build | any | not verified (the cross build ran on a Linux arm64 container) | `docker-2c-verify.toon` item D |
| Windows | any | `blocked-by-environment` (decision D3). Not verified. No claim of support | [2f](POC-02f-coordinated-shutdown.md#windows), [2g](POC-02g-real-binary-smoke.md#windows) |

## Acceptance criteria

| AC | Scope in POC-2 | Result | Evidence |
|---|---|---|---|
| [AC-11](../requirements/11-nx-quality-testing.md) | partial: no Node on the host | verified in `debian:bookworm-slim` arm64 and amd64 only after `libatomic1` is installed. The bare slim image exits 127: `error while loading shared libraries: libatomic.so.1: cannot open shared object file: No such file or directory`. `ldd` lists `libatomic.so.1` as a direct need on both architectures. Other distributions: not verified | [2g](POC-02g-real-binary-smoke.md#observed-outputs), `docker-2c-verify.toon` item C, [2c](POC-02c-assembler-registry.md) (macOS: one file, no `node` on `PATH`, `qc-2c.toon` checks 5 to 8) |
| [AC-28](../requirements/11-nx-quality-testing.md) | supervisor mode and second process | verified on macOS arm64, Linux arm64 and amd64 (Rosetta) by smoke checks 4 and 6 | [2g](POC-02g-real-binary-smoke.md#the-checks) |
| [AC-29](../requirements/11-nx-quality-testing.md) | same executable, never `node` from `PATH` | verified on macOS (`ps` comm) and Linux (`/proc/<pid>/exe`). Under Rosetta `/proc/<pid>/exe` is `/run/rosetta/rosetta` for every process, so only argv[0] is meaningful there. 2e: `ps -o comm=` of the new pid equals the supervisor | [2g](POC-02g-real-binary-smoke.md#rosetta-finding), [2e](POC-02e-bounded-restart.md#six-kills-in-a-row), `qc-2e.toon` check "same_executable" |
| [AC-30](../requirements/11-nx-quality-testing.md) | host OS only, others pending | verified on macOS arm64: no orphan after `SIGTERM`, `SIGINT`, frozen child and supervisor `SIGKILL`. Linux: smoke check 8 (`SIGTERM`, every pid gone) passed on arm64 and amd64. A real grandchild and a `ps` dump on Linux: not executed. Windows: not verified | [2f](POC-02f-coordinated-shutdown.md#stop-timings), [2g](POC-02g-real-binary-smoke.md), `qc-2f.toon` |
| [AC-31](../requirements/11-nx-quality-testing.md) | registry design only | verified as design. Dry run in a scratch copy: a renamed copy of `api-gateway` as `auth-ms` appeared in `--service nope` output; a `nest new` service `billing` was bundled and ran in a Linux arm64 container | [2b](POC-02b-dispatcher-registry.md#registry-design-for-a-future-auth-ms-ac-31), `docker-2c-verify.toon` item A |

## Inherited items from POC-1

Final status of each item of the [umbrella table](../backlog/poc-2-single-sea-runtime-supervisor.md#inherited-from-poc-1).

| Inherited item | Final status | Evidence or next owner |
|---|---|---|
| Linux SEA needs `libatomic.so.1`; amd64 untested | closed: confirmed by `ldd` and by exit 127 on both architectures; `libatomic1` installs it. The deb and rpm `depends` stay with POC-5 (see pending item 5) | [2g](POC-02g-real-binary-smoke.md#observed-outputs), `docker-2c-verify.toon` item C |
| `Warning: Code cache data rejected.` on amd64 under emulation | narrowed, not closed: appears on amd64 under Rosetta with code cache on, not on arm64, not with `useCodeCache` false, not in the cross-built binary. V8 mechanism: not verified | `docker-2c-verify.toon` item B; pending item 4 |
| Supervisor restart on macOS not observed | closed | [2e](POC-02e-bounded-restart.md) |
| `SIGINT` on macOS not observed | closed | [2f](POC-02f-coordinated-shutdown.md#stop-timings) |
| Children stopped by signal only, no IPC and no timeout | closed on macOS and Linux smoke; Windows not verified | [2f](POC-02f-coordinated-shutdown.md) |
| cwd under systemd and launchd | closed for launchd user agent and systemd system unit (container); systemd user unit not verified | [2a](POC-02a-launcher-cwd.md#results) |
| Windows binaries and process tree | open, D3; POC-8 | pending item 1 |
| Sidecar not wired in `apps/desktop` | open; POC-5 | none |
| CSP, WebView2 minimum, Linux Tauri builds, identifier, `@tauri-apps/cli` pin | open; POC-5 (identifier and WebView2 also POC-8) | none |
| Unknown paths return the index with 200 | open; POC-4 | none |
| Phone width, keyboard and focus, Lighthouse | open; POC-4 | none |
| Test filter has no consumer | open; POC-4. The smoke runs in `package`, so `pnpm test -- --filter @app` selects nothing | [2g](POC-02g-real-binary-smoke.md) |
| `test:static` does no lint or format | open; POC-4 or a chore branch | none |
| `tsc --noEmit` gap of the rspack build | closed in 1e for `sea-runtime`; the build itself does no type check | umbrella table |
| `package` never cached; binary not reproducible | recorded: two packages of one tree gave the same bundle hash and different binary hashes (`1c930d19f8c14f7a`, `9c5967bb56a8561e`); reproducibility is POC-9 | [2c](POC-02c-assembler-registry.md#sea-size-and-reproducibility) |
| `nx run-many -t package` alone skips `securityCheck` | open; POC-9 | none |
| Node 26 compatibility of Nest, Angular, Tauri, Zod | not verified as a claim; each slice ran on Node 26.13.0 without a reported incompatibility | slice pages |
| Angular runtime 22.2.4 against 22.2.5; `esbuild` in the lockfile | open; outside POC-2 | [POC-1 result](POC-01-Result.md) |
| Gateway keeps a full copy of the web bundle; memory not measured | measured once: gateway 96304 KB resident, supervisor 86912 KB | [2d](POC-02d-readiness-logs.md#observed-outputs) |
| Fixed 10 s web receive timeout; slow start | partly measured: a 5 s delay after the receive did not touch it. A supervisor that delays the send past 10 s: not verified | [2d](POC-02d-readiness-logs.md#late-and-never-listening-gateway) |
| Requirement text naming `ServeStaticModule`, `--web-root`, temp extraction | reviewed, see [Requirement text review](#requirement-text-review) | this page |
| Only macOS arm64 tested for 1f | partly closed: `GET /`, `GET /api/health`, `GET /api/nope` on Linux arm64 and amd64. The wider 1f table was not repeated | [2g](POC-02g-real-binary-smoke.md#request-table-on-linux-poc-1f-item) |

## Pending items: inherited and new

"Phase" is the proposed owner. It is a proposal unless it says decided. The human decides.

| # | Item | Origin | State | Phase |
|---|---|---|---|---|
| 1 | Windows halted (D3): process tree, `taskkill /T`, SEA run, the smoke at check 5 (`unsupported platform win32`), IPC `disconnect` when the supervisor dies. The human tests it on his Windows computer on Monday; a VMware VM there also serves item 9 | inherited, decision D3 | `blocked-by-environment`; not verified | decided: human on Monday, then POC-8 ([OQ7](../roadmap/PROPOSAL.md#open-questions)); the quit contract for Windows is POC-5 |
| 2 | `/api/health` is unreachable while the `api-gateway` restarts. The endpoint lives in the child. `degraded` is visible only in the supervisor stdout JSON line. QC: `GET /api/health` got no response (HTTP 000) in every gap between kills. Future option: serve the health from the supervisor. Decision for the human | new, `qc-2e.toon` check "health_between_kills" (fail) | open; not decided | human decision; until then POC-5 reads the stdout JSON state (design, not verified against Tauri) |
| 3 | Real orphaned grandchild and a `ps` before and after dump on Linux not executed. The real gateway has no grandchild; the grandchild proofs used scratch scripts on macOS. Debian `--init`, `Z` versus `S` state: not verified | new, `qc-2f.toon` checks "grandchild_scratch_gateway", "linux_docker_init", "ps_before_after_arm64" | not verified | next Linux Docker run; proposed POC-8 platform matrix |
| 4 | `Code cache data rejected.` only under Rosetta amd64. Real x64 hardware and the V8 reason: not verified. Workaround proven: code cache off (the cross build already does this) | inherited, `docker-2c-verify.toon` item B | open | proposed POC-8 (real x64) or POC-9 (CI runner) |
| 5 | `libatomic1` confirmed by `ldd` on arm64 and amd64 and by AC-11: the bare `debian:bookworm-slim` image fails with exit 127. POC-5 must install the built deb and rpm on a clean image to prove the `depends` | inherited, closed here, `docker-2c-verify.toon` item C | confirmed; installer proof not verified | POC-5 |
| 6 | Cross build proved only from Linux arm64 (`--target` with `--executable`, code cache off). macOS to Linux: not verified. Native amd64 build: not run (the install under emulation exceeds the 5 min limit) | new, `docker-2c-verify.toon` item D, [2g](POC-02g-real-binary-smoke.md#not-verified) | open | proposed POC-9 |
| 7 | Binary not reproducible; `package` not cached | inherited | recorded | POC-9 |
| 8 | The smoke adds about 30 s to every `package` run: the sum of the backoff delays in check 9 (27 s of 35.4 s on macOS) | new, [2g](POC-02g-real-binary-smoke.md#risks) | accepted by D5; not decided if shortened | open; revisit in POC-9 when CI time matters |
| 9 | systemd user unit not verified in 2a: `Failed to connect to user scope bus via local transport` (exit 1; the image has no `dbus-user-session`). Real Linux host: not verified | new, [2a](POC-02a-launcher-cwd.md#results), decision D4 | not verified | the Monday VMware VM; POC-8 |
| 10 | Execution root for POC-3. The cwd is `/` unless the operator sets `WorkingDirectory`, so it never anchors the root. Recommendation: precedence `--root`, `APP_HOME`, a marker next to the executable (directory of `process.execPath` in a SEA), dev anchor, OS default | new, [2a](POC-02a-launcher-cwd.md#decision-for-poc-3), decision 11 | recommendation, not decided here | POC-3 paths library |
| 11 | The health body changed: `{"status":"ok"}` before 2d, now `{"status":"<aggregate state>"}`, HTTP 200. Nothing else in the repository reads it; any client matching the literal `ok` must change | new, [2d](POC-02d-readiness-logs.md#risks) | recorded | POC-4 and POC-5 consumers; POC-7 decides what else the endpoint may expose |
| 12 | Two services, dependency order and `degraded` with one service ready and another restarting: not run. `startupOrder` is pure and not consumed with dependencies (the services asset lists ids only) | new, [2d](POC-02d-readiness-logs.md#not-verified), [2e](POC-02e-bounded-restart.md#not-verified) | not verified | the first real second service; no fake `auth-ms` (no-go) |
| 13 | A crash exit does not sweep the dead child's descendants; only the stop sequence does. Pid reuse window after the post-exit tree kill: not measured | new, [2f](POC-02f-coordinated-shutdown.md#not-verified) | open | POC-3 or a later hardening slice, not decided |
| 14 | A force-kill after 10 s can cut a SQLite write | new, [2f](POC-02f-coordinated-shutdown.md#risks) | open | POC-3: re-measure `gracefulStopMs` once SQLite exists |
| 15 | Fixed port 3000: a busy host fails smoke check 2 and the gateway cannot bind (2e: budget burns in 26 to 34 s) | new, [2g](POC-02g-real-binary-smoke.md#risks) | open | POC-3 configuration; the user message is POC-5 ([REQ-DESK-05](../requirements/09-desktop-tauri.md)) |
| 16 | Quit contract for Tauri: POSIX `SIGTERM` to the supervisor; Windows needs a control message or closed stdin, which the supervisor does not read | new, [2f](POC-02f-coordinated-shutdown.md#quit-contract-for-tauri-text-only) | text only, not verified | POC-5 and POC-8 |
| 17 | Distributions other than Debian bookworm; the wider 1f request table on Linux | inherited | not verified | POC-8 and POC-4 |

## Files and the command that wrote them

Full rows with reasons are in each slice page. "manual" means no CLI writes the file.

| Slice | File or group | Written by |
|---|---|---|
| 2a | `docs/results/POC-02a-launcher-cwd.md`; launchd plist and systemd units (scratch, outside the repository) | manual |
| 2b | `libs/service-registry/package.json` | `pnpm init`, then `pnpm pkg set` |
| 2b | `libs/service-registry/tsconfig.json` | `pnpm exec tsc --init`, then one manual edit (`"types": ["node"]`) |
| 2b | `libs/service-registry` dependencies; `apps/sea-runtime/package.json`, `pnpm-lock.yaml` | `pnpm --filter service-registry add zod@catalog:` and `add -D @types/node@24.19.2`; `pnpm --filter sea-runtime add service-registry@workspace:*` |
| 2b | `libs/service-registry/src/*.ts`, `supervisor.service.ts`, `tools/scripts/compile-sea.ts` | manual (edit of CLI-generated files where they existed) |
| 2c | `apps/sea-runtime/package.json` (`nx.targets.package.inputs`) | `pnpm pkg set --json` run in `apps/sea-runtime` |
| 2c | `assembler-config.ts`, `index.ts`, `compile-sea.ts` | manual |
| 2d | `apps/api-gateway/package.json` dependency | `pnpm --filter api-gateway add 'service-registry@workspace:*'` |
| 2d | `apps/api-gateway/package.json` (`nx.targets.build.dependsOn`) | `pnpm pkg set --json 'nx.targets.build.dependsOn=["^build"]'` |
| 2d | `pnpm-lock.yaml` | `pnpm` (three lines) |
| 2d | `control-channel.ts`, `supervisor-config.ts`, `startup-order.ts`, `aggregate-state.ts`, `log-lines.ts`, `health-state.ts`, edits in `supervisor.service.ts`, `main.ts`, `health.controller.ts`, `app.module.ts`, `web-bundle.ts` | manual |
| 2e | `service-lifecycle.ts`, edits in `supervisor.service.ts`, `supervisor-config.ts`, `aggregate-state.ts` | manual |
| 2e follow-up | `states.ts` and edits in seven files (commit `ef5c429`) | manual; the commit message is the source (8 files, +53 -23) |
| 2f | `process-tree.ts`, edits in `supervisor.service.ts`, `api-gateway/src/main.ts`, `supervisor-config.ts`, `control-channel.ts` | manual |
| 2g | `tools/scripts/smoke-sea.ts`, edits in `log-lines.ts`, `supervisor.service.ts` | manual |
| 2g | `apps/sea-runtime/package.json` (`nx.targets.package.options.command`, `inputs`) | `pnpm pkg set` |
| 2h | `docs/results/POC-02-Result.md`, `docs/architecture/adr/ADR-002-single-sea-portability.md`, edits in `docs/backlog/*.md` and `docs/roadmap/PROPOSAL.md` | manual: no CLI writes these pages |
| every slice | `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

No slice added a `*.spec.ts` file ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)): 2b, 2c, 2e, 2f and 2g pages and QC checks report 0.

## Deviations

- **V1. One branch and one draft PR for POC-2.** Decision D1 supersedes the one-PR-per-slice plan. Source: [umbrella](../backlog/poc-2-single-sea-runtime-supervisor.md#decisions-for-the-human).
- **V2. Smoke in `package`, not `test`.** Decision D5. `pnpm test -- --filter @app` selects nothing until POC-4. Source: [2g](POC-02g-real-binary-smoke.md).
- **V3. Windows halted.** Decision D3. Code for the Windows branch of shutdown (`taskkill /pid <pid> /T /F`, no `detached`) is written and not verified.
- **V4. Systemd evidence from a container.** Decision D4. Labelled "container, not a real host".
- **V5. Health body changed.** `{"status":"ok"}` became `{"status":"<aggregate state>"}` in 2d. Source: [2d](POC-02d-readiness-logs.md#risks).
- **V6. `detached: true` on POSIX.** Each child leads its own process group so `process.kill(-pid, 'SIGKILL')` reaches descendants. Side effect: `Ctrl+C` in a terminal no longer reaches the child; the supervisor routes it. Source: [2f](POC-02f-coordinated-shutdown.md#risks).
- **V7. A readiness timeout now kills the child with `SIGKILL`** (2e). Before 2e it only marked the child failed. Source: [2e](POC-02e-bounded-restart.md#risks).
- **V8. Lockfile bump reverted in 2b.** `pnpm add` bumped `zod` 4.6.6 to 4.6.7 for two transitive entries; reverted by hand in `ec90de9`. `pnpm install --frozen-lockfile` exits 0. Source: [2b](POC-02b-dispatcher-registry.md#risks), `qc-2b-rerun.toon`.
- **Shell false positive in 2b QC.** An unquoted zsh variable holding `--service nope` is passed as one argument, so the binary started the supervisor and the check read exit 124. Re-run with an argument array: exit 2 in all cases. Source: [2b](POC-02b-dispatcher-registry.md#observed-outputs).

## Requirement text review

Task of [POC-2h](../backlog/poc-2h-result-and-adr.md): record each place that still names `ServeStaticModule`, `--web-root` or the temp extraction. No requirement file was edited. The SRS owner decides.

| Place | Text | State |
|---|---|---|
| [06-web-gateway-https-pwa.md](../requirements/06-web-gateway-https-pwa.md) line 97 (REQ-NET-01) | premise `NodeAdapter` with `ServeStaticModule` | already annotated "not verified" in the same entry |
| [06-web-gateway-https-pwa.md](../requirements/06-web-gateway-https-pwa.md) lines 99 and 101 | "Replaces the `ServeStaticModule` + `--web-root` design of human decision 17" and "Replaces the extraction to a directory of human decision 17" | annotated; "Not verified against the SRS owner" |
| [10-node-sea-distribution.md](../requirements/10-node-sea-distribution.md) line 49 (REQ-SEA-04) | "Human decision 17 (extraction and `--web-root`) is replaced by POC-1f" | annotated; "Not verified against the SRS owner" |
| [amendments-2026-10-30.md](../requirements/amendments-2026-10-30.md) line 60 | `NodeAdapter` + `ServeStaticModule` premise marked `not verified`; superseded by POC-1f | annotated |
| [11-nx-quality-testing.md](../requirements/11-nx-quality-testing.md) line 463 (AC-16) | "replaces the `ServeStaticModule` cache of POC-1f" | annotated |

The Decision Log item 17 in [PROPOSAL](../roadmap/PROPOSAL.md#decision-log) keeps the old design with "Superseded by POC-1f" notes. The SRS owner has not confirmed the replacement: not verified.

## Not verified

- Windows, all of it (decision D3).
- Real Linux host; systemd user unit; any distribution other than Debian bookworm and trixie (2a only).
- Real x64 hardware; macOS to Linux cross build; native amd64 build.
- Two or more services at once, dependency order, `degraded` with two services.
- A real grandchild process of the gateway and a `ps` dump on Linux; Debian `--init`.
- The Tauri side of the stdout JSON state line, the quit contract and the installer part of [REQ-RUNTIME-08](../requirements/09-desktop-tauri.md) (POC-5). The smoke is not AC-18 or AC-20 evidence.
- The window pruning after 300 s; the supervisor delaying the web bundle past 10 s; an `app.close()` blocked by keep-alive connections.
- The V8 reason for the code cache rejection.
- OQ11 in [PROPOSAL](../roadmap/PROPOSAL.md#open-questions) still reads "decided (human decision, POC-2 D2) ... measured values still to report". Updating it needs the human.
