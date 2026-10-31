<!-- toon-meta
fmt: TOON
doc: docs/requirements/06-web-gateway-https-pwa.md
title: "Web Gateway, HTTPS and PWA"
type: requirement
summary: "Defines dev proxy, SEA static serving, LAN TLS and PWA caching requirements."
ids[20]: REQ-DEV-01,REQ-DEV-02,REQ-DEV-03,REQ-DEV-04,REQ-DEV-05,REQ-NET-01,REQ-NET-02,REQ-NET-03,REQ-NET-04,REQ-NET-05,REQ-NET-06,REQ-NET-07,REQ-NET-08,REQ-TLS-01,REQ-TLS-02,REQ-TLS-03,REQ-TLS-04,REQ-PWA-01,REQ-PWA-02,REQ-PWA-03
related[3]: docs/requirements/README.md,docs/requirements/05-persistence.md,docs/requirements/07-security.md
status: current
updated: 2026-10-31
-->

# Web Gateway, HTTPS and PWA (SRS §6)

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](05-persistence.md) | [Up](README.md) | [Next](07-security.md)

This page covers the development proxy, SEA serving, LAN TLS and PWA caching. Next: [security](07-security.md).

## Navigation

- [At a glance](#at-a-glance)
- [6. Development, web packaging, LAN gateway, HTTPS and PWA](#6-development-web-packaging-lan-gateway-https-and-pwa)
  - [6.1 Development: independent apps + proxy (DX with HMR)](#61-development-independent-apps--proxy-dx-with-hmr)
  - [6.2 Production: a single SEA serves both compiled artifacts](#62-production-a-single-sea-serves-both-compiled-artifacts)
  - [6.3 Local LAN TLS, no cost and no Internet dependency](#63-local-lan-tls-no-cost-and-no-internet-dependency)
  - [6.4 PWA and caching strategy](#64-pwa-and-caching-strategy)

---

## At a glance

[Back to navigation](#navigation)

| Topic | Point | Section |
|---|---|---|
| Development | `ng serve` on `4200` proxies `/api/**` to Nest on `8443` | [6.1](#61-development-independent-apps--proxy-dx-with-hmr) |
| Production | One SEA serves the API and the compiled SPA on one origin | [6.2](#62-production-a-single-sea-serves-both-compiled-artifacts) |
| HTTP | Port `8080` redirects to HTTPS with `308` | [6.2](#62-production-a-single-sea-serves-both-compiled-artifacts) |
| LAN TLS | Local CA and gateway certificate; clients install CA trust | [6.3](#63-local-lan-tls-no-cost-and-no-internet-dependency) |
| PWA | Installable; `index.html` and service worker revalidate; hashed files are immutable | [6.4](#64-pwa-and-caching-strategy) |

---

## 6. Development, web packaging, LAN gateway, HTTPS and PWA

[Back to navigation](#navigation)

---

### 6.1 Development: independent apps + proxy (DX with HMR)

- **REQ-DEV-01.** `web-angular` **MUST** start its own `ng serve` (default `127.0.0.1:4200`) with HMR and incremental compilation. `api-gateway` **MUST** start independently on its API port (default HTTPS `127.0.0.1:8443`).
- **REQ-DEV-02.** Configure the **`proxyConfig` of the Angular dev-server** (`@angular/build:dev-server`, Vite-based). Use it to forward **`/api/**`** to the Nest gateway **without changing origin in the browser**. The proxy **MUST NOT** redirect SPA routes or HMR to Nest.
- **REQ-DEV-03.** The Angular application **MUST** call relative routes (`/api/...`) in development and production. It **MUST NOT** contain hardcoded LAN IPs/hosts or different API URLs in each component.
- **REQ-DEV-04.** For TLS development, the local CA/certificate **MUST** be trusted by the proxy process; `secure: false` **MUST NOT** be used as the template's final configuration. If a temporary development unlock exists, it must be explicitly documented as **insecure and not distributable**.
- **REQ-DEV-05.** `@nestjs/serve-static` **MUST NOT** be mounted on the development gateway; Angular is served exclusively by `ng serve`. SEA/Tauri is **not** required to iterate on Angular or Nest.

```mermaid
flowchart LR
    Browser[Development browser] -->|"http://localhost:4200"| Angular["Angular dev-server: Vite / HMR"]
    Angular -->|SPA + HMR| Browser
    Angular -->|"proxy /api/** HTTPS"| Nest["NestJS NodeAdapter localhost:8443"]
    Nest --> DB[(SQLite or PG)]
    style Angular stroke-width:2px
```

```mermaid
sequenceDiagram
    participant B as Browser localhost:4200
    participant A as Angular dev-server :4200
    participant N as NestJS :8443
    B->>A: GET /admin (HTML/JS dev)
    A-->>B: Angular + HMR
    B->>A: GET /api/session
    A->>N: HTTPS /api/session (proxy)
    N-->>A: 200/401 + JSON
    A-->>B: API response (same origin :4200)
    Note over B,N: In production there is no development proxy
```

**Conceptual Angular proxy example.** The agent **MUST** adapt the format to the real builder and certify the result. Do not fix this sample as its own API:

```json
{
  "/api/**": {
    "target": "https://localhost:8443",
    "secure": true,
    "changeOrigin": true
  }
}
```

---

### 6.2 Production: a single SEA serves both compiled artifacts

- **REQ-NET-01.** NestJS **MUST** use `NodeAdapter` from `@nestjs/platform-node`, without Express or Fastify. The API and the SPA **MUST** share process and HTTPS origin in production. *(Premise `NodeAdapter` + `ServeStaticModule` without Express/Fastify: not verified.)*
- **REQ-NET-02.** The `api-gateway` **MUST** enable `ServeStaticModule` **only when its validated config has `webRoot`**. It **MUST NOT** check `node:sea.isSea()` or any other runtime mode. `webRoot` is the optional CLI argument `--web-root`, parsed with `node:util` and validated with Zod. It is read without `process.env`. Use `@nestjs/serve-static` **(>=12.1.1, a compatible pinned version)** with support for `@nestjs/platform-node >=12.3.1`. Without `webRoot`, as in a development run, it is not enabled.
  *Human decision 17: the gateway checks `webRoot`, not `isSea()`. See the [Decision Log](../roadmap/PROPOSAL.md#decision-log).*
- **REQ-NET-03.** `@nestjs/serve-static` needs **`rootPath` as a real directory**. `node:sea.getAsset()` does not by itself produce a browsable filesystem. Therefore, before the gateway starts, the **`sea-runtime` supervisor** **MUST** materialize the packaged Angular tree from the SEA assets and pass its directory to `api-gateway` as `--web-root`. The target is a **per-version/build-ID cache outside the executable**.
  *Human decision 17: the supervisor, not the backend, extracts the tree. The spike used the OS temp directory; the cache moves under the [REQ-SEA-05](10-node-sea-distribution.md) root in POC-3.*
- **REQ-NET-04.** Materialization **MUST** be safe. Validate manifest + checksums. Prevent `../` traversal. Prevent overwriting unmanaged paths. Write to a temporary location and publish atomically. Handle concurrent extraction. Use minimal permissions. Clean up obsolete versions. If the tree already matches the manifest, reuse it without re-extracting.
  *Human decision 17: the supervisor performs this step. The spike staged into a `.tmp-<pid>` directory, checked every hash, renamed into place and wrote a `.complete` marker. Cleanup of obsolete versions is open and belongs to POC-4 ([spike](../results/SPIKE-spa-serving.md)).*
- **REQ-NET-05.** After the supervisor has materialized the tree, `ServeStaticModule.forRoot({ rootPath: <verified-directory> })` **MUST** be configured through Nest module composition done before `NestFactory.create()`, and only when the validated config has `webRoot`. Do **not** instantiate the module afterwards as a dynamic step. Do not add a generic hook orchestrator either.
  *Human decision 17: `AppModule.register(config)` composes the module before `NestFactory.create()`.*
- **REQ-NET-06.** The HTTPS listener **MUST** use `8443` by default, configurable from the singleton; `0.0.0.0` LAN exposure is configured on the installed server and the API is served under `/api/**`. SPA, manifest, service worker and API use the same origin.
- **REQ-NET-07.** Requests to `/api/**` **MUST NOT** receive `index.html` as the SPA fallback. Valid Angular routes may receive the fallback. Missing files (`.js`, `.css`, `.wasm`, manifests, icons) **MUST** respond `404`, not HTML. Implement correct headers/MIME/cache.
- **REQ-NET-08.** A minimal HTTP listener on `8080` **MUST** redirect to HTTPS `:8443` using **308**. Do not serve data or authentication over HTTP. Validate the redirect target and avoid open redirects with a malicious `Host`.

```mermaid
sequenceDiagram
    participant SEA as sea-runtime supervisor
    participant Assets as node:sea getAsset
    participant Cache as SPA cache per version
    participant Gateway as api-gateway process
    participant Static as ServeStaticModule
    SEA->>Assets: Read manifest + Angular files
    SEA->>Cache: Verify version hash
    alt First run or invalid cache
      SEA->>Cache: Extract to temporary directory
      SEA->>Cache: Verify checksum + atomic publication
    else Valid cache
      Cache-->>SEA: Reuse existing tree
    end
    SEA->>Gateway: Spawn with --web-root <verified directory>
    Gateway->>Static: Mount only when webRoot is present
    Gateway-->>SEA: Server ready on HTTPS :8443
```

```mermaid
flowchart TD
    Request["HTTPS :8443"] --> Router{Route}
    Router -->|"/api/**"| Api[Nest controllers + guards]
    Router -->|Existing asset| File["ServeStaticModule: file + MIME/cache"]
    Router -->|SPA route without extension| SPA[Fallback index.html]
    Router -->|Missing file| NF[404]
    Api --> Res[JSON with HTTP status]
    File --> Resp[Angular build bytes]
    SPA --> Resp
```

---

### 6.3 Local LAN TLS, no cost and no Internet dependency

- **REQ-TLS-01.** The setup **MUST** generate/provision a TLS identity for **this gateway**, keep keys in protected persistent storage and reuse/renew according to SAN and identity. The certificate **identifies hostname/IP, never the port**; HTTPS is served only on the listeners the app opens.
- **REQ-TLS-02.** TLS trust on the host computer **SHOULD** be facilitated with explicit consent. Mobile devices and client PCs require installing/verifying trust of the corresponding CA/certificate. The system **MUST NOT** promise automatic trust between devices.
- **REQ-TLS-03.** The setup **MUST NOT** do four things. It never alters the HTTPS servers or configuration of other LAN devices. It never distributes private keys. It never uses `rejectUnauthorized=false`. It never disables certificate validation in production.
- **REQ-TLS-04.** If the IP/hostname changes, the system **MUST** do three things. It detects the SAN mismatch. It reports it clearly. It reissues the certificate where applicable. Document how to establish trust on iOS, Android, Windows and macOS, including PWA requirements.

```mermaid
flowchart LR
    CA["Local CA: keys only on host"] --> Cert["Server certificate: SAN IP/hostname"]
    Cert --> Listener["Gateway HTTPS :8443"]
    ClientA[Client PC] -. install CA trust .-> CA
    ClientB["Mobile/PWA"] -. install CA trust .-> CA
    ClientA -->|HTTPS validated| Listener
    ClientB -->|HTTPS validated| Listener
```

```mermaid
sequenceDiagram
    participant S as Gateway setup
    participant CA as Local CA
    participant C as Server certificate
    participant H as Host computer
    participant G as Gateway HTTPS
    participant D as Client PC or mobile
    S->>CA: Generate or provision the TLS identity, keys stay on the host
    CA->>C: Issue certificate with SAN for IP or hostname
    S->>G: Keep keys in protected storage, reuse or renew by SAN
    H->>CA: Trust the CA, facilitated with explicit consent
    D->>CA: Install and verify CA trust, never automatic
    D->>G: HTTPS validated against the CA
    Note over S,C: IP or hostname changes: detect the SAN mismatch, report it, reissue where applicable
```

---

### 6.4 PWA and caching strategy

- **REQ-PWA-01.** Angular **MUST** produce an installable PWA where the OS/browser allow it, with `manifest.webmanifest`, icons, a service worker and a trusted HTTPS context. It **MUST NOT** include HMR/debug in the distribution.
- **REQ-PWA-02.** The gateway **MUST** differentiate two cache classes. The cache of `index.html` and the service worker is revalidatable. Files with hash-based names are immutable. Keep version consistency between manifest, assets and service worker.
- **REQ-PWA-03.** Mobile devices/PCs **MUST** be able to open `https://IP-or-hostname:8443/` without public Internet. Do **not** require public DNS. Do not promise access to mutable data if the client lost its gateway connection.

```mermaid
flowchart TD
    Open[PWA opens HTTPS URL] --> SW{Service Worker active}
    SW -->|No| Gateway[Download Angular from Gateway]
    SW -->|Yes| Cache[Serve cached assets or update]
    Gateway --> UI[Angular UI]
    Cache --> UI
    UI --> API{Gateway reachable}
    API -->|Yes| Data["Authorized /api operations"]
    API -->|No| Offline["Static UI can open; data not guaranteed"]
```
