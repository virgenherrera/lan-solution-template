<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-008-tls-trust-model.md
title: "ADR-008 TLS trust model"
type: architecture
summary: "Local CA and leaf built with Node built-ins, created only by pnpm dev:certs and validated read-only by the gateway."
ids[0]:
related[10]: docs/architecture/device-trust-guide.md,docs/results/POC-04-Result.md,docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/backlog/poc-4-https-gateway-angular-pwa.md,docs/requirements/06-web-gateway-https-pwa.md,docs/roadmap/PROPOSAL.md,docs/architecture/overview.md,docs/results/RESEARCH-pwa-https-trust.md,docs/results/SPIKE-pwa-https-trust-Result.md
status: current
updated: 2026-11-09
-->

# ADR-008: TLS trust model

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-006](ADR-006-sidecar-status-contract.md) | [ADR-007](ADR-007-persistence-system.md) | [POC-4 backlog](../../backlog/poc-4-https-gateway-angular-pwa.md) | [Web gateway requirements](../../requirements/06-web-gateway-https-pwa.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Decision](#decision)
- [Options rejected](#options-rejected)
- [Phone trust](#phone-trust)
- [Known gap](#known-gap)
- [Consequences](#consequences)
- [Measured](#measured)
- [Not verified](#not-verified)
- [Implementation status](#implementation-status)

## Status

Accepted, 2026-11-03. Implemented on `minor/poc-04-https-gateway`. Evidence: the [POC-4 result](../../results/POC-04-Result.md). The human delegated the choice ([OQ8](../../roadmap/PROPOSAL.md#open-questions)) with this instruction: "trata de hacer auto-gen solo con built-ins de node. y que funcionee en todos los ambientes (dev, sea, sidecar tauri)". The details below are agent decisions. The tasks are on the [backlog page](../../backlog/poc-4-https-gateway-angular-pwa.md).

Amended 2026-11-03 on `minor/strict-tls-identity` after this human instruction: "Si no esta o es invalido truena y dice coaramente porque (faltan los certs o son invalidos por lo que sea) (ya sabes usa zod)" and "deberia ser como la validacion de db". The gateway no longer creates certificates: see [The gateway never creates certificates](#the-gateway-never-creates-certificates).

## Context

The gateway must serve HTTPS with a certificate that names its hostname and IPs ([REQ-TLS-01](../../requirements/06-web-gateway-https-pwa.md)). Nobody may install a tool for it. It must work in dev, in the SEA binary and as a Tauri sidecar.

Measured with a scratch probe:

- `node:crypto` has no X.509 builder. It signs. `crypto.sign('sha256', tbs, { dsaEncoding: 'der' })` returns a valid ECDSA signature.
- A hand-built DER certificate parses with `X509Certificate`. `ca` is true. `checkIssued` and `verify` against the CA are true.
- `openssl verify` accepts the chain. It served only as an external checker. The product never calls it.
- A `node:https` client with `ca: <ca.crt>` completes the handshake by name, by IP and by SNI.
- Without the CA the client fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. With a wrong host it fails with `ERR_TLS_CERT_ALTNAME_INVALID`.
- Pitfall: a DER INTEGER serial with a leading `0x00` byte made the parser fail with `PEM no start line`. The serial must be positive and minimal.

## Decision

### Node built-ins only

The CA and the leaf are built with `node:crypto` and a minimal ASN.1 DER encoder plus an X.509 v3 builder. Both live in `libs/shared-core/src/tls/` (`der.ts`, `x509.ts`). The tbsCertificate is signed with `crypto.sign('sha256', tbs, { dsaEncoding: 'der' })`. There is no dependency, no native module, no `openssl` binary and no `mkcert`.

### Certificate profile

| Item | CA | Leaf |
|---|---|---|
| Key and hash | ECDSA P-256, SHA-256 | ECDSA P-256, SHA-256 |
| Subject CN | `<product> Local CA` | `lan-gateway` |
| Validity | 10 years | 397 days |
| basicConstraints | CA:TRUE, critical | CA:FALSE |
| keyUsage | keyCertSign, cRLSign, critical | digitalSignature, critical |
| extKeyUsage | none | serverAuth |
| SAN | none | dNSName and iPAddress entries |
| Serial | `0x01` then 15 random bytes | same |

The serial is a positive, minimal DER INTEGER.

### SAN set and reissue rule

The leaf SAN is the union of:

- `localhost`, `127.0.0.1`, `::1`.
- The hostname of the machine.
- The non-internal IPv4 and IPv6 addresses of `os.networkInterfaces()`, except link-local IPv6 (`fe80::/10`), which needs a zone id.
- `tls.extraNames` from the config.

`pnpm dev:certs` compares the SAN of the stored leaf with this set. When the leaf is missing, expired, within 30 days of expiry, broken or has a different SAN set, it issues a new leaf under the same CA. The CA never changes, so a device that trusts it keeps trusting the new leaf.

At start the gateway compares the SAN of the stored leaf with the same set. A difference, or an expiry within 30 days, is logged with the fix command ([REQ-TLS-04](../../requirements/06-web-gateway-https-pwa.md)) and the gateway keeps starting with that leaf. The redirect allow-list is the SAN of the leaf, not the wanted set.

### Storage

```text
<base>/certs/      mode 0700
  ca.key           mode 0600, plain PKCS#8
  ca.crt
  leaf.key         mode 0600, plain PKCS#8
  leaf.crt
```

`<base>` is the one base directory of [ADR-007](ADR-007-persistence-system.md#one-base-directory). Only `pnpm dev:certs` writes these files, each with an atomic rename. The gateway reads `ca.crt`, `leaf.crt` and `leaf.key`; `ca.key` may stay offline. The keys are not encrypted and no key-storage provider exists. The file mode is the protection. The CA private key never goes in the database and is never served or distributed ([REQ-TLS-03](../../requirements/06-web-gateway-https-pwa.md)). Reading all of `certs/` yields the keys. That residual risk is accepted.

### The gateway never creates certificates

Decision (agent, 2026-11-03, after the instruction in [Status](#status)). The gateway validates the TLS files like it validates the database config: a missing or invalid file stops the start. It never creates, renews or deletes a file in `certs/`.

- Why: when `certs/` was deleted the gateway created a new CA. The old CA stayed trusted in the store of every device (the iOS simulator collected 3 entries) and the new one had to be trusted again. A start must not change what devices trust.
- Validation: the facts are computed with `node:crypto` `X509Certificate` and checked by one zod schema (`z.literal(true, message)` and `z.date().min(now, message)`, no `superRefine`, no default). `z.prettifyError` lists every problem in one error. A missing file is named individually.
- Checked: `ca.crt` is a CA and not expired. `leaf.crt` is signed by `ca.crt` and is not expired. `leaf.key` matches `leaf.crt`.
- Exit 1 and a message that names the file and `pnpm dev:certs`. A packaged install gets its files from the installer; no installer exists yet.
- Command: `pnpm dev:certs [--base <dir>]` (`apps/tools-cli/src/commands/generate-certs.command.ts`). The base defaults to the cwd and holds `config/config.json` and `certs/`.
  - It creates the CA only when `ca.crt` and `ca.key` are both absent. One present is an error that names the missing one.
  - It never replaces an existing CA, not even an expired one. Deleting `certs/` is the explicit way to get a new CA.
  - It issues only the leaf, when it is missing, expired, within 30 days of expiry, not issued by the CA, not matched by its key, or when its SAN set differs from the wanted set.
  - It prints the SHA-256 fingerprint of the CA. After it creates a new CA it warns that every device that trusts an older CA must trust this one; the older CA stays in their stores until removed.
- The command is the setup that [REQ-TLS-01](../../requirements/06-web-gateway-https-pwa.md) asks for ("the setup MUST generate/provision"). No requirement text changes.
- Code: `libs/shared-core/src/tls/identity.ts` (`loadTlsIdentity`, read-only; it takes only the `tls` block of the config) and `generate.ts` (used only by the command, not exported from `shared-core/tls`). The gateway loads the identity in `AppBootstrap` before `NestFactory.create`, because `httpsOptions` is read while the app is created, before the config namespaces exist. The same memoized, frozen config object then feeds `AppConfigModule`, so the file is read once.

### Strict config blocks

[ADR-007](ADR-007-persistence-system.md) stays intact: strict objects, no defaults, a missing key throws.

```json
{
  "net": { "bind": "0.0.0.0", "httpsPort": 8443, "httpPort": 8080 },
  "tls": { "extraNames": [] }
}
```

`net.bind` is the listen address, validated as an IPv4 or IPv6 address. `0.0.0.0` listens on every IPv4 interface, which other devices on the LAN need to reach the gateway. `::` listens on IPv6 and, on macOS, Linux and Windows, on IPv4 as well. `127.0.0.1` keeps the gateway on the local machine. Dual-stack behavior of `::` on a real LAN: not verified.

- `hostname` leaves `serverConfigSchema`. The listen address comes from `net.bind`.
- `config.example.json` and the smoke config writer carry both blocks.
- All parsed input goes through zod. `JSON.parse` stays inside `json-text.ts`.

### HTTPS, redirect and serving

- HTTPS listens on `net.httpsPort` ([REQ-NET-06](../../requirements/06-web-gateway-https-pwa.md)).
- A minimal listener on `net.httpPort` answers `308` to the HTTPS URL ([REQ-NET-08](../../requirements/06-web-gateway-https-pwa.md)). The target host is the configured host or a host that matches a SAN entry. The `Host` header is never reflected. Any other `Host` gets the configured host.
- `/api/**` never receives `index.html`. A missing `.js` returns 404 ([REQ-NET-07](../../requirements/06-web-gateway-https-pwa.md), AC-17).
- Hashed files are `immutable`. `index.html` and the service worker are `no-cache` ([REQ-NET-05](../../requirements/06-web-gateway-https-pwa.md), [REQ-PWA-02](../../requirements/06-web-gateway-https-pwa.md), AC-12).

### Environments

| Environment | Base directory | Trust |
|---|---|---|
| Dev (`nest start`) | the cwd | `NODE_EXTRA_CA_CERTS=<cwd>/certs/ca.crt` for the Angular proxy process |
| SEA binary | `dirname(execPath)` | the client installs `ca.crt` by hand |
| Tauri sidecar | `dirname(execPath)` of the sidecar | the WebView trust is not decided here |

The dev proxy has no `secure: false`. It uses relative `/api` URLs ([REQ-DEV-02](../../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-03](../../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-04](../../requirements/06-web-gateway-https-pwa.md), AC-14).

### Sidecar simulation

The real Tauri shell is a skeleton (POC-5). The sidecar is checked by a simulation: a node script spawns the SEA binary with piped stdio from another working directory. It reads the NDJSON `status` events of [ADR-006](ADR-006-sidecar-status-contract.md). It then sends an HTTPS request that trusts the generated CA.

The simulation cannot prove:

- The handling of real Tauri `CommandEvent` values.
- The tray.
- The WebView trusting the CA.
- The supervisor ending on stdin EOF when the host quits.

POC-5 owns those.

### Out of scope

- Installing the CA in the trust store of other devices ([REQ-TLS-02](../../requirements/06-web-gateway-https-pwa.md) says "SHOULD facilitate"). The [device-trust guide](../device-trust-guide.md) meets it. The host that runs the gateway has `pnpm dev:trust` (see [Phone trust](#phone-trust)), after `pnpm dev:certs` created the CA.
- Windows ACL.
- Real Tauri and PostgreSQL.

## Phone trust

Amended 2026-11-03 with the [research](../../results/RESEARCH-pwa-https-trust.md) and the [spike result](../../results/SPIKE-pwa-https-trust-Result.md).

The only reason this template serves HTTPS is to deploy mobile LAN apps as a PWA. The platform rules behind that are verified in the research: a service worker needs a secure context (HTTPS or loopback), and Android Chrome installs a PWA only over HTTPS. A LAN IP over plain HTTP is not a secure context. A public CA cannot issue a certificate for a private IP or a `.local` name, so a private CA is the only route on a closed LAN.

Decision:

- The built-in CA stays the default. Each phone installs `ca.crt` once, by hand ([device-trust guide](../device-trust-guide.md)). No MDM and no automatic trust are promised.
- Observed on an Android 15 emulator and an iOS 18.5 simulator: without the CA the browser shows a certificate warning and the service worker does not register. With the CA installed the page loads and the service worker registers. Chrome on Android honors a CA installed as a user CA.
- The leaf stays at 397 days. The 398-day cap applies to certificates from default-trusted roots, not to a root the user installed. No Android cap is known.
- Name constraints on the CA stay deferred: client support is not verified.
- `pnpm dev:trust` (`apps/tools-cli/src/commands/trust-ca.command.ts`) trusts the CA on the machine that runs the gateway, like `dotnet dev-certs https --trust`. macOS: `security add-trusted-cert -p basic -p ssl` on the login keychain. Windows: `certutil -user -addstore Root`. Linux: it prints the steps, because the store depends on the distribution. It takes one parameter, the base directory that holds `certs/ca.crt`, and refuses a file that is not a current CA certificate.
- The PWA of the gateway ships a manifest and a service worker, so the install criteria are met by the app itself. Add to Home Screen, the Chrome install prompt and offline reload on a phone are checked at the first real deployment, not by the template.

### Phone trust options rejected

- A public CA (Let's Encrypt or similar): the Baseline Requirements forbid certificates for internal names and reserved IP addresses.
- MDM auto-trust: a device management service gives automatic full trust on iOS, but MDM is out of scope.
- The Chrome flag `unsafely-treat-insecure-origin-as-secure`: on Android it needs root or developer mode, it is per device and it disables a security check.
- A host trust command as the whole trust model: it trusts the certificate on the machine where it runs, so a phone still needs the manual step. The command exists for the host (see Decision).
- A provided certificate (`tls.source`): no requirement asks for it. It would add one required key to the strict `tls` block, with no default.

## Options rejected

- A pure-JS X.509 dependency (`@peculiar/x509` and similar). The probe shows built-ins suffice. A dependency adds supply-chain surface and bundle weight for no gain.
- `mkcert`. It is an external binary, it installs into the system trust store and it breaks the single-file goal.
- The `openssl` binary. It may be absent, and the SEA must not depend on it.
- An encrypted CA key (PKCS#8 with AES-GCM) behind a NestJS key-storage provider. The key file sits beside the encryption key, so it adds code and no protection. No requirement asks for it.
- Reflecting `Host` in the redirect. It is an open redirect.

## Known gap

`pnpm dev:certs` writes `leaf.key` and then `leaf.crt`, each with an atomic rename. A crash between the two leaves a key that does not match the certificate. The gateway does not repair it: the next start stops with `<leaf.key> does not belong to <leaf.crt>`.

- The next `pnpm dev:certs` reissues the leaf, because a key that does not match is one of its reasons. A leaf has no trust implication, because devices trust the CA. The CA pair is never touched by that repair.
- Only the command writes `certs/`, so the gap is limited to a crash during the command.

## Consequences

- No new dependency. The SEA stays one file.
- The DER encoder and the X.509 builder are project code. The smoke scripts pin them with the probe checks above. There is no unit suite ([REQ-TEST-01](../../requirements/11-nx-quality-testing.md)).
- Every device must install `ca.crt` by hand. The system promises no automatic trust.
- The leaf is reissued by `pnpm dev:certs` when the network changes. The gateway only logs the mismatch. A mobile client that trusts the CA needs nothing.
- A start without the files stops. In dev the operator runs `pnpm dev:certs` once before `pnpm dev:gateway`.
- Deleting `certs/` and running the command creates a new CA. Devices keep the old one and must trust the new one.
- `net` and `tls` are required in `config.json`. An existing config without them stops the start.

## Measured

From the packaged smoke (30 checks, 4 of them the sidecar simulation) and the dev smoke (6 checks). Details: [POC-4 result](../../results/POC-04-Result.md#evidence).

- Modes: `certs/` is `0700`, key files are `0600`.
- A second start uses the files and changes none. After a changed `tls.extraNames`, `generate-certs` gives a new leaf and the same `ca.crt`.
- A start without TLS files exits 1, names the missing file and `pnpm dev:certs`, and creates nothing. A `leaf.key` that does not match `leaf.crt` exits 1 and names the mismatch.
- HTTPS with the CA answers 200. Without the CA the client fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- The redirect answers 308 for a known host, 400 for an unknown host and 405 for a method other than GET and HEAD.
- A taken port stops the start with exit 1.
- The sidecar simulation passes from an unrelated cwd, with a shutdown line on stdin and exit 0.

## Not verified

Same list as the [POC-4 result](../../results/POC-04-Result.md#not-verified).

- Firefox accepting the CA. Chrome on Android (emulator, Chrome 124) and Safari on iOS (simulator, 18.5) accepted it; a real phone was not tested.
- A real device following the [device-trust guide](../device-trust-guide.md): the simulator showed full trust already on after install, a real iPhone may still need the switch.
- The installed PWA, Add to Home Screen, the Chrome install prompt, `.local` resolution on a phone, a changed host IP and whether accepting the certificate warning enables the service worker ([spike result](../../results/SPIKE-pwa-https-trust-Result.md#not-observed)).
- The WebView of Tauri trusting the CA.
- Real Tauri `CommandEvent` handling, the tray and the supervisor ending on stdin EOF.
- Windows: ACLs on `certs/`, shells and any packaged run. Windows ignores 0600.
- The installer step that creates the TLS files of a packaged install: no installer exists. The packaged smoke runs `generate-certs` by hand.
- A base directory inside a read-only app bundle, so `certs/` could not be written. POC-5 and [OQ16](../../roadmap/PROPOSAL.md#open-questions) own it.
- macOS code signing of the sidecar.

## Implementation status

[Back to navigation](#navigation)

Audit of 2026-11-09 against `main` at `cfec959`. The decision text above is kept as the record. This table says what the code does today.

| Decision | Decision status | Implementation | Check | Evidence | Gap |
|---|---|---|---|---|---|
| CA and leaf built with Node built-ins only | Accepted | Implemented | confirmed | `libs/shared-core/src/tls/x509.ts:193-196`, `libs/shared-core/src/tls/der.ts:1` | none |
| CA profile P-256, 10 years, CA:TRUE, keyCertSign | Accepted | Implemented | confirmed | `libs/shared-core/src/tls/generate.ts:10-12`, `libs/shared-core/src/tls/x509.ts:50,260-261` | none |
| Leaf profile 397 days, serverAuth, SAN, CN lan-gateway | Accepted | Implemented | confirmed | `libs/shared-core/src/tls/generate.ts:11,13`, `libs/shared-core/src/tls/x509.ts:299-301` | none |
| Serial 0x01 plus 15 random bytes | Accepted | Implemented | single source | `libs/shared-core/src/tls/x509.ts:54,172` | none |
| SAN set: localhost, loopback, hostname, interface IPs, extraNames | Accepted | Partial | confirmed | `libs/shared-core/src/tls/san.ts:24-46` | ADR includes non-link-local IPv6 interface addresses. Code adds only IPv4 non-internal addresses and omits interface IPv6 on purpose (privacy address rotation, san.ts:25). |
| dev:certs reissues leaf on missing, expiring or SAN change | Accepted | Implemented | confirmed | `libs/shared-core/src/tls/generate.ts:118-125`, `libs/shared-core/src/tls/x509.ts:334`, `package.json:14` | none |
| Gateway logs SAN mismatch or near expiry and keeps starting | Accepted | Implemented | single source | `libs/shared-core/src/tls/identity.ts:158-165` | none |
| certs/ layout, modes 0700/0600, atomic rename | Accepted | Implemented | confirmed | `libs/shared-core/src/tls/generate.ts:15-16,36-40,108-109` | none |
| Gateway never creates certificates; zod facts, exit message | Accepted | Implemented | single source | `libs/shared-core/src/tls/identity.ts:79-95,111-153`, `apps/api-gateway/src/app.bootstrap.ts:15,34-42` | none |
| dev:certs creates CA only if both absent, never replaces | Accepted | Implemented | confirmed | `libs/shared-core/src/tls/generate.ts:100-120`, `apps/tools-cli/src/commands/generate-certs.command.ts` | none |
| Identity loaded before NestFactory.create | Accepted | Implemented | single source | `apps/api-gateway/src/app.bootstrap.ts:15-20` | none |
| Strict net and tls config blocks; hostname removed | Accepted | Implemented | single source | `libs/shared-core/src/config.ts:42-60`, `libs/shared-core/config.example.json:11-18` | none |
| HTTPS listens on net.httpsPort | Accepted | Implemented | confirmed | `apps/api-gateway/src/main.ts:53` | none |
| HTTP listener 308 redirect, Host never reflected | Accepted | Outdated | adjudicated | `apps/api-gateway/src/redirect-listener.ts:27`, `apps/api-gateway/src/redirect-listener.ts:37`, `apps/api-gateway/src/redirect-listener.ts:48` | Unknown Host gets 400 (redirect-listener.ts:43-45), not a redirect to the configured host as the Decision text says; the Measured section of the ADR agrees with the code |
| /api never gets index.html; missing .js is 404 | Accepted | Implemented | confirmed | `apps/api-gateway/src/web-handler.ts:22-44` | none |
| Hashed files immutable; index.html and SW no-cache | Accepted | Implemented | confirmed | `apps/api-gateway/src/web-handler.ts:10-16` | none |
| Environments: dev CA via NODE_EXTRA_CA_CERTS, no secure:false | Accepted | Implemented | single source | `package.json:12`, `apps/web-angular/proxy.conf.json:3-4` | none |
| Sidecar simulation via packaged smoke | Accepted | Implemented | confirmed | `tools/scripts/smoke-sea.ts:105-132` | none |
| Built-in CA default; phones install ca.crt by hand | Accepted | Implemented | single source | `docs/architecture/device-trust-guide.md:33`, `docs/architecture/device-trust-guide.md:35` | none |
| pnpm dev:trust trusts CA on the host, refuses non-CA | Accepted | Implemented | single source | `apps/tools-cli/src/commands/trust-ca.command.ts`, `package.json:15` | none |
| PWA ships manifest and service worker | Accepted | Implemented | adjudicated | `apps/web-angular/src/index.html:43`, `apps/web-angular/angular.json:71`, `apps/web-angular/src/app/app.config.ts:14` | Service worker enabled only outside dev mode (app.config.ts:15) |
| Known gap: crash between leaf.key and leaf.crt writes | Accepted | Implemented | confirmed | `libs/shared-core/src/tls/generate.ts:123-124`, `libs/shared-core/src/tls/identity.ts:90` | none |
| net and tls required in config.json | Accepted | Implemented | confirmed | `libs/shared-core/src/config.ts:60` | none |
