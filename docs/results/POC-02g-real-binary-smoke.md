<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02g-real-binary-smoke.md
title: "POC-2g Real-binary smoke and Linux run"
type: backlog
summary: "Result of slice 2g: @app smoke of the packaged binary as a post-step of package, run on macOS arm64 and in Debian bookworm arm64 and amd64 containers."
ids[0]:
related[3]: docs/backlog/poc-2g-real-binary-smoke.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/results/POC-02f-coordinated-shutdown.md
status: current
updated: 2026-10-31
-->

# POC-2g Real-binary smoke and Linux run

Branch: `minor/poc-02-supervisor`. Epic: [POC-2g](../backlog/poc-2g-real-binary-smoke.md). Question: does one scripted check prove the supervisor story on the packaged binary, on macOS and on Linux?

## Summary

- Yes. `tools/scripts/smoke-sea.ts` runs the packaged binary and prints one line per check. It is a post-step of the `sea-runtime` `package` target (decision D5), tagged `@app` in its output. The root order `securityCheck`, `build`, `test`, `package` is unchanged: the command is `compile-sea.ts && smoke-sea.ts` inside `package`.
- 11 checks pass on macOS arm64 (about 30 s, 27 s of it the restart budget), on Debian bookworm-slim arm64 (native) and on Debian bookworm-slim amd64 (Rosetta, cross-built binary). Windows is not verified (decision D3).
- Breaking the gateway health route in a throwaway copy makes `package` exit 1 at the right check.
- `test` still has no `@app` consumer: the smoke runs in `package`, so `pnpm test -- --filter @app` selects nothing. The first consumer is POC-4 ([REQ-TEST-03](../requirements/11-nx-quality-testing.md), [AC-34](../requirements/11-nx-quality-testing.md)). This is a package check, not a unit or integration suite ([REQ-TEST-01](../requirements/11-nx-quality-testing.md)).

## The checks

| # | Check | Asserts |
| --- | --- | --- |
| 1 | artifacts | `artifacts/sea-runtime/` holds exactly one file, not named `node` ([REQ-RUNTIME-08](../requirements/09-desktop-tauri.md)) |
| 2 | port | the gateway port is free; it is a schema default (the app reads no env), so a busy port fails with a clear message |
| 3 | bad selectors | `--service nope`, `--service`, `--service=`, `--service sea-runtime`, `--service a --service b` each exit with the dispatcher reject code (2) |
| 4 | no arguments | the supervisor reaches `ready` (poll of `GET /api/health`), logs `state ready` and spawned one service ([AC-28](../requirements/11-nx-quality-testing.md)) |
| 5 | same executable | supervisor and child have the same `/proc/<pid>/exe` (macOS: `ps comm`) and the same argv[0], and argv[0] is the artifact ([AC-29](../requirements/11-nx-quality-testing.md)) |
| 6 | HTTP | `GET /api/health` 200 `ready`, `GET /` 200, `GET /api/nope` 404 |
| 7 | child death | `SIGKILL` of the child gives a new pid, health `ready` again, old pid gone |
| 8 | `SIGTERM` | supervisor exits 0, every pid seen is gone, the port is free again |
| 9 | restart budget | repeated `SIGKILL` of each new child: after `maxRestarts` (5) restarts the supervisor logs `state error`, exits with `errorExitCode` (1), spawned 6 times, no pid left |

Every number and state word comes from the built `service-registry` (`SUPERVISOR_CONFIG`, `DISPATCHER_CONFIG`, `AGGREGATE_STATE`) or from the gateway's `serverConfigSchema` default. The spawn line and the `state` line are built by `spawnedMessage` and `stateMessage` in `log-lines.ts`, which the supervisor and the script share, so the script parses what the supervisor writes without a second copy of the text.

## Observed outputs

| Where | Result |
| --- | --- |
| macOS arm64, `pnpm run build` | exit 0 |
| macOS arm64, `pnpm run test` | exit 0 |
| macOS arm64, `pnpm exec nx run sea-runtime:package --skip-nx-cache` | exit 0, smoke 11/11 in 35.4 s, whole `package` 1 m 7 s |
| `node:26.13.0-bookworm` arm64, install plus `package` | exit 0, smoke 11/11 in 34.6 s (a node image has `libatomic`) |
| `debian:bookworm-slim` arm64, binary alone, no `libatomic1` | exit 127 |
| `debian:bookworm-slim` arm64, `libatomic1` installed, `--init` | smoke 11/11 in 36.6 s, exit 0 |
| `debian:bookworm-slim` amd64 (Rosetta), binary alone, no `libatomic1` | exit 127 |
| `debian:bookworm-slim` amd64 (Rosetta), `libatomic1` installed, `--init` | smoke 11/11 in 42.0 s, exit 0 |

The message without `libatomic1`, quoted from both architectures: `error while loading shared libraries: libatomic.so.1: cannot open shared object file: No such file or directory`. It closes the `libatomic` item inherited from POC-1c. The packaged answer is the deb and rpm `depends` of the Tauri hardening chore.

The slim container has neither `ps` nor `node`. The script reads `/proc` on Linux. The script itself ran with a `node` binary copied from the `node:26.13.0-bookworm` image of the same architecture and mounted read-only; the binary under test never used it (check 1 shows no `node` in `artifacts/`).

The amd64 binary was cross-built on the arm64 container with `node tools/scripts/compile-sea.ts sea-runtime --target x86_64-unknown-linux-gnu --executable <amd64 node>` (code cache off, as in POC-2c). The amd64 smoke ran against that binary. A native amd64 build was not run (the install under emulation would pass the 5 min limit).

### Deliberate failure

Copy of the working tree in a `mktemp -d`, with `@Controller('health')` renamed to `@Controller('healthz')` in the gateway. `pnpm exec nx run sea-runtime:package --skip-nx-cache` exit 1:

```text
ok   @app bad selectors exit 2 (5 cases)
FAIL @app no arguments: supervisor ready: /api/health ready: not reached within 45000 ms
```

followed by the last 10 output lines of the run (the gateway mapped `/api/healthz`). The script killed its processes before exiting. The copy was deleted.

### Rosetta finding

On amd64 under Rosetta `/proc/<pid>/exe` of every process is `/run/rosetta/rosetta`, and `realpath` of it fails. The same-executable check therefore compares `exe` between supervisor and child and pins the binary with argv[0]. On native Linux and macOS both comparisons are meaningful; under Rosetta only argv[0] is. Label it when quoting AC-29 for amd64.

## Request table on Linux (POC-1f item)

`GET /` 200, `GET /api/health` 200 `ready`, `GET /api/nope` 404 on Linux arm64 and amd64. The wider 1f table (more paths, headers, SPA fallback) was not repeated: only these three are in the smoke. Not verified.

## Windows

Not executed (decision D3, [REQ-TEST-09](../requirements/11-nx-quality-testing.md)). The documented command, from the repository root of a Windows checkout after `pnpm run build`: `node tools/scripts/compile-sea.ts sea-runtime` then `node tools/scripts/smoke-sea.ts`. The script throws `unsupported platform win32` at check 5 because the executable lookup has no Windows branch; that, `taskkill` and the pid checks are the work for Monday.

## Files and the command that wrote them

| File | Written by |
| --- | --- |
| `tools/scripts/smoke-sea.ts` | manual: no CLI generates a smoke script |
| `apps/sea-runtime/package.json` | `pnpm pkg set` (`nx.targets.package.options.command` and `nx.targets.package.inputs`) |
| `apps/sea-runtime/src/supervisor/log-lines.ts`, `supervisor.service.ts` | manual edit of existing files: shared spawn and state message builders |
| `docs/results/POC-02g-real-binary-smoke.md` | manual |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |

No dependency changed; `pnpm-lock.yaml` is untouched. No `*.spec.ts` was created. Docker: images pulled and removed, no container or image of this slice remains.

## Not verified

- Windows (all of it); any distribution other than Debian bookworm.
- A native amd64 build and a run on real x64 hardware (Rosetta only).
- macOS to Linux cross build (the cross build ran on a Linux arm64 container).
- The Tauri installer part of REQ-RUNTIME-08 (POC-5). This is not AC-18 or AC-20 evidence.

## Risks

- Fixed port 3000: a busy host fails check 2. No flag changes the port without making the apps read configuration.
- The restart-budget check adds about 30 s to every `package` run (sum of the backoff delays). It is the longest check.
- Timeouts are the configured waits plus a 15 s margin; a very slow host can still fail on timing.
- The script imports the built `service-registry` and two TypeScript sources through Node type stripping; a rename there breaks the script.
