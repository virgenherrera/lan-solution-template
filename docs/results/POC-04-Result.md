<!-- toon-meta
fmt: TOON
doc: docs/results/POC-04-Result.md
title: "POC-04 Result"
type: backlog
summary: "Result of POC-4: built-in TLS identity, HTTPS gateway with safe redirect, installable PWA, dev loop and sidecar simulation."
ids[0]:
related[5]: docs/backlog/poc-4-https-gateway-angular-pwa.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/device-trust-guide.md,docs/results/POC-03-Result.md,docs/roadmap/PROPOSAL.md
status: current
updated: 2026-11-03
-->

# POC-04 Result

Branch: `minor/poc-04-https-gateway`. Epic: [POC-4](../backlog/poc-4-https-gateway-angular-pwa.md). Decision: [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md). Device trust: [device-trust guide](../architecture/device-trust-guide.md).

## Summary

- Question: can the gateway serve the Angular PWA over HTTPS with a TLS identity built from Node built-ins only, in dev, in the SEA binary and as a Tauri sidecar?
- Answer: yes on macOS arm64. The gateway creates a local CA and a leaf under `<base>/certs/`, serves HTTPS on `net.httpsPort` and redirects `net.httpPort` with 308. The packaged smoke passes 28 checks, 4 of them the sidecar simulation. The dev smoke passes 3 checks.
- Not done: installing the CA in a system trust store. The guide covers manual install ([REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md)).

## Slices

| Task | Commit subject | What it built |
|---|---|---|
| T0 | `feat: generate X.509 certificates with Node built-ins only` | `der.ts` and `x509.ts` in `libs/shared-core/src/tls/`. ECDSA P-256, SHA-256. |
| T5d | `docs: write ADR-008 TLS trust model and rewrite the POC-4 backlog page` | ADR-008, backlog page T0 to T7, OQ8 decided. |
| T1 | `feat: create and reuse the TLS identity under the certs directory` | `identity.ts`, `san.ts`, strict `net` and `tls` config blocks, atomic key writes. |
| T4 | `feat: make the web app an installable PWA with the Angular CLI` | Manifest, icons, service worker, production only registration. |
| T3 | `feat: apply the serving rules in the web handler` | 404 for missing files with an extension, no `index.html` under `/api`, cache classes. |
| T2 | `feat: serve the gateway over HTTPS with a safe HTTP redirect` | HTTPS listener, redirect listener, exit 1 when a port is taken. |
| T5 | `feat: add a dev loop that proxies to the HTTPS gateway and ignores runtime state` | `dev:gateway`, `dev:web`, proxy with `secure: true`, `smoke-dev.ts`. |
| T6 | `feat: run the real-binary smoke over HTTPS and add the sidecar simulation` | `smoke-sea.ts` over HTTPS and the simulation group. |

T7 is this documentation. The independent verification and the PR follow it.

## Evidence

### Packaged smoke (`tools/scripts/smoke-sea.ts`, 28 checks)

| Group | Checks |
|---|---|
| Artifact | One executable, no node copy, no Drizzle code. |
| Start | Ports free, bad selectors exit, supervisor ready, child runs the same executable. |
| TLS | Identity modes `0700` and `0600`. Second start reuses the identity. `tls.extraNames` gives a new leaf and the same CA. |
| HTTPS | `/api/health` over HTTPS with the CA. Without the CA it fails verification. `index.html` answers. A missing file answers 404. |
| Redirect | Known host gets 308. Unknown host gets 400. A new `extraNames` host redirects after the reissue. |
| Supervisor | Database keys, valid stdout events, invalid stdin line ignored, SIGKILL recovery, SIGTERM and stdin shutdown exit 0, restart budget, schema mismatch, config missing, unknown config key. |
| Sidecar simulation (4) | Spawn from an unrelated cwd with a ready event. Stdout holds only valid events. HTTPS with the CA from the install directory. Shutdown line on stdin gives exit 0 and no listener left. |

### Dev smoke (`tools/scripts/smoke-dev.ts`, 3 checks)

- The gateway listens on `https://127.0.0.1:8443` with cwd as base.
- `:4200/api/health` through the proxy answers with `NODE_EXTRA_CA_CERTS`.
- Without `NODE_EXTRA_CA_CERTS` the proxy request is refused.

### Gateway probes

| Probe | Result |
|---|---|
| HTTPS request with `ca.crt` | 200 |
| HTTPS request without the CA | `UNABLE_TO_VERIFY_LEAF_SIGNATURE` |
| HTTP request, known host | 308 to `https://<host>:<httpsPort><path>` |
| HTTP request, unknown host or non origin-form target | 400, no `Location` |
| HTTP request, method other than GET and HEAD | 405 with `Allow: GET, HEAD` |
| HTTPS port or HTTP port already taken | `startup failed: cannot listen on <address>`, exit 1 |
| `tls.extraNames` changed | New leaf, same `ca.crt`, the new name redirects |

The 405 and port-busy rows come from the T2 probe run. The smoke does not repeat them.

### T0 probes (scratch, before the builder moved into the library)

- `X509Certificate` parses both certificates. `ca` is true for the CA.
- `checkIssued` and `verify` against the CA are true.
- `openssl verify` accepts the chain. It was an external checker only.
- A `node:https` client with `ca:` connects by name, by IP and by SNI.
- Without the CA the client fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. With a wrong host it fails with `ERR_TLS_CERT_ALTNAME_INVALID`.
- A serial with a leading `0x00` made the parser fail. The serial is positive and minimal.

## Hand edits and deviations

Generated files come from the official CLIs. These edits have no CLI:

- `pnpm-workspace.yaml`: `@angular/service-worker` added to the `angular` catalog (`ng add @angular/pwa` adds the dependency, not the catalog entry).
- `apps/web-angular/public/manifest.webmanifest`: `scope` and `start_url` set to `/`, theme colors added.
- `apps/web-angular/ngsw-config.json`: `!/api/**` in `navigationUrls`, `dataGroups` empty, so the service worker never caches the API.
- `apps/web-angular/src/index.html`: `theme-color` meta.
- `.gitignore`: `config/`, `certs/`, `data/` and `logs/` at the root and under `apps/*` and `libs/*`.
- `libs/shared-core/src/config.ts` and `config.example.json`: strict `net` and `tls` blocks. `hostname` left `serverConfigSchema`.
- `package.json`: scripts `dev:gateway` and `dev:web`.
- `tools/scripts/smoke-dev.ts` and `smoke-sea.ts`.

Deviations from the plan:

- Backlog tasks 4 and 5 (key-storage provider, AES-GCM key file) are dropped. No requirement asks for them ([ADR-008](../architecture/adr/ADR-008-tls-trust-model.md#options-rejected)).
- The 8443 and 8080 values live in `config.example.json`, not in code. The persisted config has no defaults ([ADR-007](../architecture/adr/ADR-007-persistence-system.md)). [REQ-NET-06](../requirements/06-web-gateway-https-pwa.md) is corrected (see [amendments](../requirements/amendments-2026-10-30.md#editorial-corrections-2026-11-03)).
- The OQ8 spike became the T0 probe. The pure-JS dependency path was not needed.

Independent verification (read-only, adversarial, against the packaged binary; ports 48443 and 48080) found no defect in the certificate profile, the identity storage, the 25-case config matrix, the 40 raw-socket redirect probes (no unknown Host is ever redirected, no CR or LF reaches `Location`) or the three environments (dev, SEA, sidecar simulation). It found one defect and two edge cases, all fixed here:

- Hashed `chunk-*.js` files got `no-cache` because the hash pattern accepted only upper-case characters. Angular chunk hashes mix cases and can hold `_` and `-`. The pattern now accepts them.
- `/API/x` (upper case) got `index.html`. The router treats it as an API route, so the web handler now compares the prefix in lower case.
- `net.httpPort` equal to `net.httpsPort` passed the schema and made the supervisor loop on `EADDRINUSE`. The gateway now stops at start with `config net.httpPort must differ from net.httpsPort` (exit 1).

## Not verified

- Chrome, Firefox and Safari accepting the CA and an IP SAN leaf.
- Any mobile or desktop device following the [device-trust guide](../architecture/device-trust-guide.md).
- The WebView of Tauri trusting the CA.
- Real Tauri `CommandEvent` handling, the tray and the supervisor ending on stdin EOF when the host quits.
- Windows: ACLs on `certs/`, shells and any packaged run.
- A base directory inside a read-only app bundle ([OQ16](../roadmap/PROPOSAL.md#open-questions)).
- macOS code signing of the sidecar.

## Gaps

- A crash between writing `leaf.key` and `leaf.crt` leaves a mismatched pair. The next start throws. See [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md#known-gap).
- No endpoint serves `ca.crt`. The operator copies the file to each device by hand.
