<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-010-first-run-admin-setup.md
title: "ADR-010 First admin authentication"
type: architecture
summary: "Proposed path for creating the first real admin: CLI setup plus a loopback wizard with a one-time token. Not decided."
ids[0]:
related[7]: docs/results/POC-05-Result.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md,docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/backlog/poc-7-auth-roles.md,docs/roadmap/PROPOSAL.md
status: proposed
updated: 2026-11-04
-->

# ADR-010: First admin authentication

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-006](ADR-006-sidecar-status-contract.md) | [ADR-008](ADR-008-tls-trust-model.md) | [ADR-009](ADR-009-desktop-process-model.md) | [POC-5 result](../../results/POC-05-Result.md) | [POC-7 backlog](../../backlog/poc-7-auth-roles.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Proposal](#proposal)
- [Options evaluated](#options-evaluated)
- [Sources](#sources)
- [Not verified](#not-verified)
- [Open questions for the human](#open-questions-for-the-human)

## Status

Proposed, 2026-11-04. **Nothing here is decided.** It records the recommendation of the POC-5 spike S3 (decision 13, OQ5, "first-run setup wizard"). The spike read primary sources through page summaries and ran no code. The human has not accepted or rejected it. This ADR does not amend [ADR-006](ADR-006-sidecar-status-contract.md): that depends on question 2 below.

The ADR number follows the [ADR index](../../roadmap/PROPOSAL.md#adr-index), where ADR-010 is the auth mechanism that POC-7 implements.

## Context

The user creates the first real admin at install time. The wizard replaces the seeded dev super user (decision 13). Facts from the repository:

- The window already loads `https://127.0.0.1:<port>/` and has no IPC ([ADR-009](ADR-009-desktop-process-model.md)).
- The gateway certificate always names `localhost`, `127.0.0.1` and `::1` ([ADR-008](ADR-008-tls-trust-model.md)). The window needs `ca.crt` trusted to load the page.
- ADR-006: stdout carries only `status` events. A `setup` event needs an amendment.
- REQ-SEC-05: the LAN-served frontend gets no shell or sidecar privilege. REQ-SEC-06: tokens are never written to logs. REQ-SEC-02: no permanent default credentials.
- Epic no-gos: Tauri hosts no second SPA and no public port.
- Decision 12: the dev seed `dev-admin` is a data row with a bootstrap mark. "Has an admin" must exclude it, or setup never opens in dev.

## Proposal

CLI `setup` as the baseline on every OS, plus a loopback wizard with a one-time token. The wizard is the primary path on desktop. The CLI is the headless path and the fallback.

Rules of the wizard. All of them live in the gateway; none in Tauri.

1. The state comes from the database: no real admin means setup is open. The check runs on every request.
2. The TCP peer must be loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`). An undefined `remoteAddress` is denied. The `Host` header must be in `localhost`, `127.0.0.1`, `[::1]` with the gateway port. A `POST` needs an `Origin` equal to the target origin. A missing `Origin` is rejected.
3. A one-time token from a CSPRNG, with an expiry and a wrong-attempt limit that burns it. Only a hash is kept in memory. It never reaches a log, argv or environment.
4. Password: at least 15 characters, at least 64 accepted, compared against a blocklist, no composition rules. The user types the username (no fixed `admin` or `root`).
5. The admin is created through the production user-creation path in one conditional transaction ("insert if no real admin"), so two parallel submits cannot make two. Success deletes the token and the `dev-admin` bootstrap row.
6. After success `/setup` answers 404 for good.

Token delivery on desktop (delivery A): the sidecar emits one new stdout event kind `setup` with the token. The Rust host keeps it in memory and navigates the existing window to `https://127.0.0.1:<port>/setup#t=<token>`. The page reads the URL fragment and posts the token. This needs no IPC, no capability and no `remote` URL. The host must not log the event line. In a terminal or in dev, the token is printed only when stdout is a TTY, never through the logger.

Implementation order:

1. Server: setup state, conditional first-admin insert, password policy (needs the POC-7 user-creation path).
2. CLI `setup` on every OS. This alone satisfies the circuit breaker.
3. Gateway `/setup` with the rules above.
4. ADR-006 amendment for the `setup` event. Host parses it, opens the window at `/setup#t=<token>`, tray item "Set up admin" while setup is open. This comes after the CA trust (the window needs `ca.crt` trusted).
5. Per-OS smoke test (AC-21): the first admin logs in, no default exists, `/setup` is 404 afterwards.
6. POC-8: drop the MSI credential dialog only if step 5 passes on Windows.

Circuit breaker, as in the epic: if the wizard does not pass on a target OS, keep the MSI dialog on Windows and the CLI `setup` on Linux and macOS.

Tauri surface of the proposal: `sidecar.rs` parses one more event kind; `gateway.rs` navigates to the `/setup#t=` URL; `tray.rs` gets one item. IPC: none. Capabilities: unchanged.

## Options evaluated

| Option | Verdict |
|---|---|
| Loopback-only setup mode | Keep. Not enough alone: a local user on a shared machine is also loopback. |
| Single-use token | Keep. Closes "first to reach the wizard owns the admin". |
| Delivery A: host passes the token by stdout event and URL fragment | Recommended on desktop. Needs an ADR-006 amendment. |
| Delivery B: token through Tauri `invoke` | Not recommended. It needs a capability with `remote.urls` for the LAN page, which REQ-SEC-05 forbids. Without a capability, app commands are allowed for all windows. |
| Delivery C: token in the terminal | Keep for dev and terminal runs. Not for the sidecar (stdout is machine events). |
| Host and Origin checks | Keep. Cheap. The Host allowlist is the DNS-rebinding control. |
| Attempt limit | Keep. A loopback attacker can burn the token, which only forces a re-issue. |
| Permanent deactivation once an admin exists | Keep. A deleted database reopens setup, by design. |
| 15 characters plus blocklist | Keep. The blocklist source is a human decision. |
| CLI `setup` | Keep on every OS as baseline and fallback. |

## Sources

Tags: V verified in the cited page by the spike (through a page summary, not line by line). S assumption.

- Secure contexts treat loopback as potentially trustworthy (V): https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- `socket.remoteAddress` may be `undefined` (V): https://nodejs.org/api/net.html#socketremoteaddress
- One-time tokens: CSPRNG, long, single use, expiring (V): https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- Jenkins initial admin password (V): https://www.jenkins.io/doc/book/installing/linux/
- Jupyter token (V): https://jupyter-server.readthedocs.io/en/latest/operators/security.html
- Tauri capabilities and `remote` (V): https://v2.tauri.app/security/capabilities/
- Tauri sidecar channels (V): https://v2.tauri.app/develop/sidecar/
- Host allowlist against DNS rebinding (secondary source, a project wiki): https://github.com/nccgroup/singularity/wiki/Preventing-DNS-Rebinding-Attacks
- Origin checks, missing `Origin` is no proof (V): https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Lockout can become a DoS (V): https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- NIST SP 800-63B-4, section 3.1.1.2: 15 characters, 64 accepted, blocklist, no composition rules (V): https://pages.nist.gov/800-63-4/sp800-63b.html
- Portainer stops itself when the first admin is not created in time (V): https://docs.portainer.io/faqs/installing/your-portainer-instance-has-timed-out-for-security-purposes-error-fix

## Not verified

- OWASP ASVS 5.0.0 6.3.2 and 6.4.1.
- URL fragment behavior in WebView2, WKWebView and WebKitGTK (only the general URL rule is known).
- Windows and Linux behavior of every step.
- Whether `tauri-plugin-shell` logs raw stdout lines.
- Node `listen('127.0.0.1')` behavior per OS.
- The effect of a proxy hop on `remoteAddress` (no proxy is designed).
- The numbers 128 bits, 15 minutes and 5 attempts: they are assumptions of the spike.
- NCC Group is a secondary source for the Host allowlist.
- Whether another local OS user can read the sidecar stdout pipe or the WebView URL.
- No code was written or run for this proposal.

## Open questions for the human

None of these is decided.

1. Windows: drop the MSI credential dialog if the wizard passes the Windows smoke test, or ship both?
2. May ADR-006 be amended with a `setup` stdout event (a new contract surface between sidecar and host)?
3. Token policy numbers: expiry (assumed 15 minutes) and wrong-attempt limit (assumed 5). Accept, or choose?
4. Password blocklist: bundle a list in the SEA (which list, how large), accept a dependency, or accept a short built-in list?
5. Is the CLI `setup` required on Windows too, or only on Linux and macOS as the epic says?
