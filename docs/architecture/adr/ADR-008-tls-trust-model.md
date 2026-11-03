<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-008-tls-trust-model.md
title: "ADR-008 TLS trust model"
type: architecture
summary: "Local CA and leaf built with Node built-ins only, strict net and tls config, HTTPS 8443 with a 308 redirect."
ids[0]:
related[6]: docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/backlog/poc-4-https-gateway-angular-pwa.md,docs/requirements/06-web-gateway-https-pwa.md,docs/roadmap/PROPOSAL.md,docs/architecture/overview.md
status: current
updated: 2026-11-03
-->

# ADR-008: TLS trust model

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-006](ADR-006-sidecar-status-contract.md) | [ADR-007](ADR-007-persistence-system.md) | [POC-4 backlog](../../backlog/poc-4-https-gateway-angular-pwa.md) | [Web gateway requirements](../../requirements/06-web-gateway-https-pwa.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Decision](#decision)
- [Options rejected](#options-rejected)
- [Consequences](#consequences)
- [Not verified](#not-verified)

## Status

Accepted for the design, 2026-11-03. The human delegated the choice ([OQ8](../../roadmap/PROPOSAL.md#open-questions)) with this instruction: "trata de hacer auto-gen solo con built-ins de node. y que funcionee en todos los ambientes (dev, sea, sidecar tauri)". The details below are agent decisions. The code lands on `minor/poc-04-https-gateway`. The tasks are on the [backlog page](../../backlog/poc-4-https-gateway-angular-pwa.md).

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
- The non-internal IPv4 addresses of `os.networkInterfaces()`.
- `tls.extraNames` from the config.

At start the identity service compares the SAN of the stored leaf with this set. A difference is logged ([REQ-TLS-04](../../requirements/06-web-gateway-https-pwa.md)). The leaf is then reissued under the same CA. The CA never changes, so a device that trusts it keeps trusting the new leaf. An expired or unreadable leaf follows the same path.

### Storage

```text
<base>/certs/      mode 0700
  ca.key           mode 0600, plain PKCS#8
  ca.crt
  leaf.key         mode 0600, plain PKCS#8
  leaf.crt
```

`<base>` is the one base directory of [ADR-007](ADR-007-persistence-system.md#one-base-directory). The keys are not encrypted and no key-storage provider exists. The file mode is the protection. The CA private key never goes in the database and is never served or distributed ([REQ-TLS-03](../../requirements/06-web-gateway-https-pwa.md)). Reading all of `certs/` yields the keys. That residual risk is accepted.

### Strict config blocks

[ADR-007](ADR-007-persistence-system.md) stays intact: strict objects, no defaults, a missing key throws.

```json
{
  "net": { "bind": "0.0.0.0", "httpsPort": 8443, "httpPort": 8080 },
  "tls": { "extraNames": [] }
}
```

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

- Installing the CA in the system trust store ([REQ-TLS-02](../../requirements/06-web-gateway-https-pwa.md) says "SHOULD facilitate"). A device-trust guide meets it.
- Windows ACL.
- Real Tauri and PostgreSQL.

## Options rejected

- A pure-JS X.509 dependency (`@peculiar/x509` and similar). The probe shows built-ins suffice. A dependency adds supply-chain surface and bundle weight for no gain.
- `mkcert`. It is an external binary, it installs into the system trust store and it breaks the single-file goal.
- The `openssl` binary. It may be absent, and the SEA must not depend on it.
- An encrypted CA key (PKCS#8 with AES-GCM) behind a NestJS key-storage provider. The key file sits beside the encryption key, so it adds code and no protection. No requirement asks for it.
- Reflecting `Host` in the redirect. It is an open redirect.

## Consequences

- No new dependency. The SEA stays one file.
- The DER encoder and the X.509 builder are project code. The smoke scripts pin them with the probe checks above. There is no unit suite ([REQ-TEST-01](../../requirements/11-nx-quality-testing.md)).
- Every device must install `ca.crt` by hand. The system promises no automatic trust.
- The leaf is reissued when the network changes. A mobile client that trusts the CA needs nothing.
- `net` and `tls` are required in `config.json`. An existing config without them stops the start.

## Not verified

- Chrome, Firefox and Safari acceptance of the CA and an IP SAN leaf.
- The WebView of Tauri trusting the CA.
- A Windows ACL recipe. Windows ignores 0600.
- A base directory inside an app bundle may be read-only, so `certs/` could not be written. POC-5 and [OQ16](../../roadmap/PROPOSAL.md#open-questions) own it.
- Behavior on Windows.
