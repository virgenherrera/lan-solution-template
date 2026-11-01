<!-- toon-meta
fmt: TOON
doc: docs/results/POC-02a-launcher-cwd.md
title: "POC-2a Launcher cwd"
type: backlog
summary: "Result: under launchd and systemd the packaged binary starts in / without WorkingDirectory; the gateway child inherits it."
ids[0]:
related[3]: docs/backlog/poc-2a-launcher-cwd-spike.md,docs/backlog/poc-3-config-sqlite-vector.md,docs/backlog/poc-2-single-sea-runtime-supervisor.md
status: current
updated: 2026-10-31
-->

# POC-2a Launcher cwd

Branch: `minor/poc-02-supervisor`. Question: what is the initial cwd of the supervisor and of the `api-gateway` child under launchd and systemd, and can the cwd anchor root resolution?

## Summary

- Without `WorkingDirectory`, launchd (macOS) and systemd (Linux system unit) start the supervisor with cwd `/`. Verified.
- With `WorkingDirectory`, the supervisor gets that directory. Verified.
- The `api-gateway` child has the same cwd as the supervisor in all four cases. `spawn` is called without a `cwd` option (`apps/sea-runtime/src/supervisor/supervisor.service.ts`), so the child inherits it.
- Consequence: the cwd is `/` or an operator-chosen directory, so it cannot anchor the root. The paths library of [POC-3](../backlog/poc-3-config-sqlite-vector.md) must resolve the root from the OS location of decision 11 (and `--root` / `APP_HOME` / marker next to the executable), never from the cwd.
- Not verified: systemd user unit, Windows services, a real Linux host.

## Environment

| Item | Value |
| --- | --- |
| Binary | `sea-runtime-aarch64-apple-darwin`, built from commit `f659070` (clean `git archive`/worktree, `pnpm install --frozen-lockfile --offline`, `pnpm run build`, `pnpm exec nx run sea-runtime:package`; exit 0). sha256 starts `5c6c42a002774735` |
| macOS | 27.2 (build 26B123), arm64, user agent in `gui/$(id -u)` |
| Linux binary | built inside the container image for `linux arm64`; same commit, same targets, except `desktop` excluded (no Rust toolchain in the image) |
| Linux host | container, not a real host: Docker Desktop, `--privileged --cgroupns=host`, Debian GNU/Linux 13 (trixie), kernel `7.0.14-linuxkit`, systemd 257, Node 26 image `node:26-trixie` |

A first binary found in `artifacts/` was built before POC-1f (its gateway args were `--web-root`, not `--web ipc`). It was discarded and the binary was rebuilt from `f659070`.

## Results

| Launcher | WorkingDirectory | Supervisor cwd | Gateway cwd | Read with | Label |
| --- | --- | --- | --- | --- | --- |
| launchd user agent (macOS host) | not set | `/` | `/` | `lsof -a -d cwd -p <pid>` (exit 0) | verified |
| launchd user agent (macOS host) | set | the configured directory | the configured directory | `lsof -a -d cwd -p <pid>` (exit 0) | verified |
| systemd system unit (container, not a real host) | not set | `/` | `/` | `readlink /proc/<pid>/cwd` (exit 0) | verified, container, not a real host |
| systemd system unit (container, not a real host) | `/srv/wd` | `/srv/wd` | `/srv/wd` | `readlink /proc/<pid>/cwd` (exit 0) | verified, container, not a real host |
| systemd user unit (container, not a real host) | any | not observed | not observed | `systemctl --user` | not verified |
| Windows service | any | not observed | not observed | none | not verified (blocked-by-environment, D3; POC-8) |

The systemd user unit failed with `Failed to connect to user scope bus via local transport: No such file or directory` (exit 1): the image has no `dbus-user-session`. It was not pursued.

## Commands

launchd. Plist written by hand in a temporary directory outside the repository (no CLI generates a unit for an arbitrary binary). The binary was copied there first. `RunAtLoad` is required, otherwise the job is loaded and never started (`state = not running`).

```xml
<plist version="1.0"><dict>
<key>RunAtLoad</key><true/>
<key>Label</key><string>local.spike2a.wd</string>
<key>ProgramArguments</key><array><string>/tmp-dir/sea</string></array>
<key>WorkingDirectory</key><string>/tmp-dir/work</string>
<key>StandardOutPath</key><string>/tmp-dir/wd.out.log</string>
<key>StandardErrorPath</key><string>/tmp-dir/wd.err.log</string>
</dict></plist>
```

```sh
launchctl bootstrap gui/$(id -u) /tmp-dir/wd.plist    # exit 0
sleep 6
lsof -a -d cwd -p <pid>                                # one run per pid
launchctl bootout gui/$(id -u)/local.spike2a.wd        # exit 0
```

Observed (paths shortened; the no-`WorkingDirectory` run is identical except for the cwd):

```text
pid A ppid 1 args: sea                                 cwd: /tmp-dir/work
pid B ppid A args: sea --service api-gateway --web ipc cwd: /tmp-dir/work
(no WorkingDirectory)
pid A ppid 1 args: sea                                 cwd: /
pid B ppid A args: sea --service api-gateway --web ipc cwd: /
```

systemd (inside the container, system units `spike2a-nowd.service` and `spike2a-wd.service`).

```ini
[Service]
ExecStart=/usr/local/bin/sea
WorkingDirectory=/srv/wd
```

```sh
docker run -d --name spike2a --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw --tmpfs /run --tmpfs /run/lock spike2a-systemd /sbin/init
systemctl start spike2a-wd                             # exit 0
readlink /proc/<pid>/cwd                               # supervisor and gateway
systemctl stop spike2a-wd                              # exit 0
```

```text
nowd: pid 130 ppid 1   sea                                  cwd=/
nowd: pid 139 ppid 130 sea --service api-gateway --web ipc  cwd=/
wd:   pid 168 ppid 1   sea                                  cwd=/srv/wd
wd:   pid 177 ppid 168 sea --service api-gateway --web ipc  cwd=/srv/wd
```

`systemctl is-system-running` reported `degraded` in the container (expected without a full host); the units still ran.

## Decision for POC-3

- Root resolution never reads `process.cwd()` as an anchor. Under both launchers the cwd is `/` unless the operator sets `WorkingDirectory`.
- The supervisor passes no `cwd` to `spawn`, so the child's cwd is the supervisor's. A POC-3 sidecar or service must not depend on it either.
- Recommendation: root precedence `--root`, `APP_HOME`, marker next to the executable (the directory of `process.execPath` in a SEA), dev anchor, OS default. A launcher that needs a fixed cwd may set `WorkingDirectory` to the root, but the code must not rely on it.

## Cleanup

- Container `spike2a` removed; images `spike2a-systemd` and `node:26-trixie` removed (neither existed before). No `docker system prune`.
- launchd jobs booted out (`launchctl list` shows none); no sea process left (`pgrep` count 0).
- Temporary git worktree removed.
- Side effect: a `pnpm exec nx run sea-runtime:package` run in the main checkout, while another slice had uncommitted changes there, failed and left `artifacts/sea-runtime/` empty. Rebuild it there if needed.
