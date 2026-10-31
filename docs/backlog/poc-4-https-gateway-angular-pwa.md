<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-4-https-gateway-angular-pwa.md
title: "POC-4 HTTPS gateway serving the Angular PWA"
type: backlog
summary: "Backlog item for the HTTPS gateway serving the Angular PWA."
related[3]: docs/backlog/README.md,docs/backlog/poc-3-config-sqlite-vector.md,docs/backlog/poc-5-tauri-sidecar-desktop-shell.md
status: current
updated: 2026-10-30
-->

# POC-4: HTTPS gateway serving the Angular PWA

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-3-config-sqlite-vector.md) | [Up](README.md) | [Next](poc-5-tauri-sidecar-desktop-shell.md)

## Navigation

- [At a glance](#at-a-glance)
- [Goal](#goal)
- [Requirements](#requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Tasks](#tasks)
- [Open questions](#open-questions)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Cycle 2 (planned) |
| Appetite | 2 weeks, big batch |
| Depends on | POC-2 (POC-3 not blocking) |
| Branch | `minor/poc-04-https-spa` |
| Requirements | 23 REQ ids |
| Acceptance criteria | AC-04, AC-05, AC-12, AC-14, AC-15, AC-16, AC-17 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa).

- Serve one Angular build over HTTPS from the SEA.
- Clients: browsers and the Tauri WebView.
- The dev loop does not need the SEA.

| No-gos |
|---|
| No shipped `secure:false`. |
| No `rejectUnauthorized=false`. |
| No automatic CA trust on client devices. |
| No private-key distribution. |
| No offline browser sync. |
| No fake Module Federation remotes. |

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa)):

- [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md)
- [REQ-NET-02](../requirements/06-web-gateway-https-pwa.md)
- [REQ-NET-03](../requirements/06-web-gateway-https-pwa.md)
- [REQ-NET-04](../requirements/06-web-gateway-https-pwa.md)
- [REQ-NET-05](../requirements/06-web-gateway-https-pwa.md)
- [REQ-NET-06](../requirements/06-web-gateway-https-pwa.md)
- [REQ-NET-07](../requirements/06-web-gateway-https-pwa.md)
- [REQ-NET-08](../requirements/06-web-gateway-https-pwa.md)
- [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md)
- [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md)
- [REQ-TLS-03](../requirements/06-web-gateway-https-pwa.md)
- [REQ-TLS-04](../requirements/06-web-gateway-https-pwa.md)
- [REQ-PWA-01](../requirements/06-web-gateway-https-pwa.md)
- [REQ-PWA-02](../requirements/06-web-gateway-https-pwa.md)
- [REQ-PWA-03](../requirements/06-web-gateway-https-pwa.md)
- [REQ-DEV-01](../requirements/06-web-gateway-https-pwa.md)
- [REQ-DEV-02](../requirements/06-web-gateway-https-pwa.md)
- [REQ-DEV-03](../requirements/06-web-gateway-https-pwa.md)
- [REQ-DEV-04](../requirements/06-web-gateway-https-pwa.md)
- [REQ-DEV-05](../requirements/06-web-gateway-https-pwa.md)
- [REQ-WEB-01](../requirements/08-web-angular.md)
- [REQ-TEST-05](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-SEA-04](../requirements/10-node-sea-distribution.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-04](../requirements/11-nx-quality-testing.md)
- [AC-05](../requirements/11-nx-quality-testing.md)
- [AC-12](../requirements/11-nx-quality-testing.md)
- [AC-14](../requirements/11-nx-quality-testing.md)
- [AC-15](../requirements/11-nx-quality-testing.md)
- [AC-16](../requirements/11-nx-quality-testing.md)
- [AC-17](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa). [REQ-TEST-05](../requirements/11-nx-quality-testing.md) is the dev :4200 and :8443 smoke subset.

---

## Tasks

[Back to navigation](#navigation)

- [ ] Spike, first task, 2 days at most, inside the appetite (decision 14, [OQ8](../roadmap/PROPOSAL.md#open-questions)). Compare a hand-built DER writer on `node:crypto` with a pure-JS dependency. Checks: `openssl verify` accepts the chain. Chrome, Firefox and Safari accept the installed CA and a leaf with an IP SAN. The leaf is reissued when the IP or SAN changes, with the same CA. Two more checks: a Windows ACL recipe and a read of the OWASP guidance. Output: the POC result page and `ADR-004` (TLS trust model). Circuit breaker: the own path fails in 2 days. Then adopt the pure-JS dependency that passes [REQ-SUPPLY-01](../requirements/02-technology-baseline.md). Source: decision 14, [OQ8](../roadmap/PROPOSAL.md#open-questions), [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Angular 22, zoneless, strict TypeScript, Signals, Tailwind and PWA. Source: [REQ-WEB-01](../requirements/08-web-angular.md), [REQ-PWA-01](../requirements/06-web-gateway-https-pwa.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] `ng serve` on 4200 with `proxyConfig` `/api/**` to 8443 through a trusted dev CA, never `secure:false`. Use `NODE_EXTRA_CA_CERTS` for the dev CA. Source: [REQ-DEV-01](../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-02](../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-03](../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-04](../requirements/06-web-gateway-https-pwa.md), [AC-14](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Declare a NestJS provider contract for CA key storage. The contract is an injection token or an abstract class. The POC fixes the name. It reuses the port and strategy wording of POC-3. Source: decision 14, [OQ8](../roadmap/PROPOSAL.md#open-questions), [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md), [REQ-DB-01](../requirements/05-persistence.md), [REQ-DB-02](../requirements/05-persistence.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Implement the initial provider. It keeps the CA private key encrypted (PKCS#8 with AES-GCM) in a `dataDir` file. The encryption key is in a separate file. There is no OS store dependency. Source: decision 14, [OQ8](../roadmap/PROPOSAL.md#open-questions), [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Generate the TLS identity: one local CA per installation. The CA and the leaf have a SAN, with IPs included. Issue them through the library path the spike chose. Source: [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md), [REQ-TLS-04](../requirements/06-web-gateway-https-pwa.md), [AC-04](../requirements/11-nx-quality-testing.md), decision 14, [OQ8](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Reissue the leaf when the IP or SAN changes, without changing the CA. Source: decision 14, [OQ8](../roadmap/PROPOSAL.md#open-questions), [REQ-TLS-04](../requirements/06-web-gateway-https-pwa.md), [AC-04](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Test that the CA private key is not in the database. Source: decision 14, [OQ8](../roadmap/PROPOSAL.md#open-questions), [REQ-TLS-01](../requirements/06-web-gateway-https-pwa.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Document manual CA install for mobile clients; no auto-trust. Publish a device-trust guide and `ADR-004` (TLS trust model). Source: [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md), [REQ-PWA-03](../requirements/06-web-gateway-https-pwa.md), [AC-04](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Serve HTTPS on 8443. Serve an HTTP 308 redirect on 8080. Allow no Host-based open redirect. Source: [REQ-NET-06](../requirements/06-web-gateway-https-pwa.md), [REQ-NET-08](../requirements/06-web-gateway-https-pwa.md), [AC-05](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Materialize the SPA into a per-version hashed cache: manifest, checksums, atomic publish, concurrency-safe, stale cleanup. Source: [REQ-NET-03](../requirements/06-web-gateway-https-pwa.md), [REQ-NET-04](../requirements/06-web-gateway-https-pwa.md), [REQ-SEA-04](../requirements/10-node-sea-distribution.md), [AC-16](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Load `ServeStaticModule` only when `isSea()`, configured before `NestFactory.create`. Source: [REQ-NET-02](../requirements/06-web-gateway-https-pwa.md), [REQ-NET-05](../requirements/06-web-gateway-https-pwa.md), [AC-16](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] `/api/**` never falls back to `index.html`; a missing asset returns 404. Source: [REQ-NET-07](../requirements/06-web-gateway-https-pwa.md), [AC-17](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Revalidatable cache headers for `index.html` and the service worker; hashed files immutable. Source: [REQ-PWA-02](../requirements/06-web-gateway-https-pwa.md), [AC-12](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))
- [ ] Run the dev :4200 and :8443 smoke subset. Source: [REQ-TEST-05](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa))

Ids with no pitch task (none invented): [AC-15](../requirements/11-nx-quality-testing.md), [REQ-NET-01](../requirements/06-web-gateway-https-pwa.md), [REQ-TLS-03](../requirements/06-web-gateway-https-pwa.md), [REQ-DEV-05](../requirements/06-web-gateway-https-pwa.md).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions.

| OQ | Topic | Status |
|---|---|---|
| [OQ8](../roadmap/PROPOSAL.md#open-questions) | TLS crypto library and key storage | decided (human decision 14): pending spike |
| [OQ17](../roadmap/PROPOSAL.md#open-questions) | install-time choice: server mode or client mode | proposed |
