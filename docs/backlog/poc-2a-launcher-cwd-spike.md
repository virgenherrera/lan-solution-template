<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-2a-launcher-cwd-spike.md
title: "POC-2a Launcher cwd spike"
type: backlog
summary: "Backlog slice 2a of POC-2: record the initial cwd of supervisor and gateway under launchd and systemd."
related[3]: docs/backlog/poc-2-single-sea-runtime-supervisor.md,docs/backlog/poc-2b-dispatcher-service-registry.md,docs/backlog/poc-3-config-sqlite-vector.md
status: current
updated: 2026-10-31
-->

# POC-2a: Launcher cwd spike

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-2-single-sea-runtime-supervisor.md) | [Up](poc-2-single-sea-runtime-supervisor.md) | [Next](poc-2b-dispatcher-service-registry.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Files and how they are written](#files-and-how-they-are-written)
- [Risks](#risks)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Done in commit `a606db3` on `minor/poc-02-supervisor`, see [result](../results/POC-02a-launcher-cwd.md) |
| Slice | 2a of 2a to 2h; umbrella [POC-2](poc-2-single-sea-runtime-supervisor.md) |
| Size | ~120 authored lines, documentation only (ASSUMPTION) |
| Depends on | none. Needs the packaged binary from `main` (POC-1f merged) |
| Branch (decided, D1) | `minor/poc-02-supervisor`, one commit or commit group per slice, one draft PR for all of POC-2 |
| Result page | `docs/results/POC-02a-launcher-cwd.md` |
| Requirements | none. The pitch gives no REQ or AC id for this task |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch rabbit holes](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor), [decision 11](../roadmap/PROPOSAL.md#decision-log), [OQ1](../roadmap/PROPOSAL.md#open-questions).

- Replace "not verified" with a measured value: the initial cwd of the supervisor and of the `api-gateway` child under launchd and under systemd.
- Prove, or disprove, that root resolution can never use the cwd as its anchor.
- Feed the answer to the POC-3 paths library and to the POC-5 sidecar design.

This slice adds no repository code. It runs the existing packaged binary.

| No-gos |
|---|
| No repository code and no new package. |
| No install of a tool with `brew` or `apt` on the host. |
| No claim about Windows services. |

---

## Requirements

[Back to navigation](#navigation)

None cited by the pitch for this task. The task serves [REQ-CFG-05](../requirements/04-configuration.md) and [REQ-SEA-05](../requirements/10-node-sea-distribution.md) indirectly (the root is resolved once by a paths library). No id is added here.

---

## Acceptance criteria

[Back to navigation](#navigation)

No AC id. Observable outcomes:

- `docs/results/POC-02a-launcher-cwd.md` exists and holds a table: launcher, supervisor cwd, gateway cwd, how it was read, label (`verified` or `not verified`).
- Every row cites the command and its exit code.
- A closing sentence states whether any launcher starts the process in a directory that cannot anchor the root.
- `toon -d docs/meta.toon` and the metadata check from [Checks](../standards/README.md#checks) exit 0.

---

## Tasks

[Back to navigation](#navigation)

- [x] Build the packaged binary from `main` with the existing targets (`pnpm run build`, then `pnpm exec nx run sea-runtime:package`). Record the commit and the binary path. Source: [REQ-SEA-01](../requirements/10-node-sea-distribution.md); no new REQ.
- [x] Run it under launchd on the macOS host as a user agent without `WorkingDirectory`, then with it. Read the cwd of the supervisor and of the gateway child with `lsof -a -d cwd -p <pid>`. Source: [decision 11](../roadmap/PROPOSAL.md#decision-log), [OQ1](../roadmap/PROPOSAL.md#open-questions); no REQ or AC id.
- [x] Run it under systemd (a system unit and a user unit if the environment has both) without and with `WorkingDirectory`. Read `readlink /proc/<pid>/cwd`. The environment follows D4 of the [umbrella](poc-2-single-sea-runtime-supervisor.md#decisions-for-the-human). Source: [decision 11](../roadmap/PROPOSAL.md#decision-log); no REQ or AC id.
- [x] Record whether the gateway child inherits the supervisor cwd (`spawn` is called without a `cwd` option today). Source: [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md).
- [x] State the consequence for the paths library: the root comes from the OS location of decision 11, never from the cwd. Link it from [POC-3](poc-3-config-sqlite-vector.md). Source: [REQ-CFG-05](../requirements/04-configuration.md), [REQ-SEA-05](../requirements/10-node-sea-distribution.md).
- [x] Publish `docs/results/POC-02a-launcher-cwd.md` and regenerate `docs/meta.toon`. Source: not verified (no pitch id).

---

## Files and how they are written

[Back to navigation](#navigation)

| File | Written by |
|---|---|
| `docs/results/POC-02a-launcher-cwd.md` | manual: no CLI writes a result page |
| `docs/meta.toon` | regeneration command in [Metadata block v1](../standards/README.md#metadata-block-v1) |
| launchd plist and systemd unit | not committed. Written by hand in the scratch area, loaded with `launchctl` and `systemctl`. The page quotes them in fenced blocks. Reason: no CLI generates a unit for an arbitrary binary |

---

## Risks

[Back to navigation](#navigation)

- Docker has no systemd by default. D4 decides between a privileged systemd container and "not verified". A container is not a real host, so the label says so.
- Windows services start in `System32`. That is a documentation claim, not verified here. POC-8 owns it.
- The result depends on the macOS and systemd versions used. The page records both.

---

## Open questions

[Back to navigation](#navigation)

| OQ | Topic | Status |
|---|---|---|
| [OQ1](../roadmap/PROPOSAL.md#open-questions) | root and cwd | decided (decision 11); this slice verifies the cwd |
