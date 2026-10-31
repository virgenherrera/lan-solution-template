<!-- toon-meta
fmt: TOON
doc: docs/architecture/overview.md
title: Architecture overview
type: architecture
summary: Mermaid architecture diagrams citing SRS sections for runtime and desktop topology.
ids[0]:
related[1]: README.md
status: current
updated: 2026-10-30
-->

# Architecture overview

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](../backlog/README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Overview](#overview)
- [Development topology](#development-topology)
- [Production topology](#production-topology)
- [Tauri sidecar](#tauri-sidecar)
- [Architecture decisions](#architecture-decisions)
  - [ADR-001: Toolchain substitution](#adr-001-toolchain-substitution)
  - [ADR-002: Single-SEA portability](#adr-002-single-sea-portability)
  - [ADR-003: Drizzle tag choice](#adr-003-drizzle-tag-choice)
  - [ADR-004: TLS trust model](#adr-004-tls-trust-model)
  - [ADR-005: Desktop process model](#adr-005-desktop-process-model)
  - [ADR-006: Auth mechanism](#adr-006-auth-mechanism)
  - [ADR-007: Release flow](#adr-007-release-flow)
  - [Topics without an ADR number](#topics-without-an-adr-number)

---

## At a glance

[Back to navigation](#navigation)

| View | Shows | Section |
| --- | --- | --- |
| Development | Separate apps behind a dev proxy | [Development topology](#development-topology) |
| Production | One SEA, a supervisor, a gateway, one HTTPS origin | [Production topology](#production-topology) |
| Desktop | Tauri starts the SEA supervisor as a sidecar | [Tauri sidecar](#tauri-sidecar) |
| Decisions | Seven ADR placeholders. None is written yet. | [Architecture decisions](#architecture-decisions) |

---

## Overview

[Back to navigation](#navigation)

This page holds the architecture diagrams required by NFR-DOC-01 (Mermaid diagrams). Every node cites the SRS v1.6 section that states it. The SRS is the reference for scope and behavior. Per SRS section 12 item 8, keep these diagrams in sync with the build. Nothing is implemented yet (documentation phase).

---

## Development topology

[Back to navigation](#navigation)

Separate apps behind a dev proxy.

```mermaid
flowchart LR
    subgraph Repo["Repository: sibling apps in apps/ (SRS 1.1)"]
      A["apps/web-angular: Angular dev-server (SRS 1.1, 8)"]
      N["apps/api-gateway: NestJS with watch/HMR (SRS 1.1, 9.1)"]
      C["libs/shared-core: contracts + Zod (SRS 1.1)"]
    end
    BR["Browser"] --> A
    A -->|"dev proxy to /api (SRS 1.1, 9.1)"| N
    A --> C
    N --> C
```

Sources:

- Sibling apps with independent sources, configuration and Nx targets: SRS section 1.1.
- In development, Angular calls the gateway over HTTP. It does not import sources: SRS section 1.1 (diagram interpretation).
- The gateway MAY start directly with watch/HMR behind the Angular proxy. No SEA, Tauri or supervisor is needed. Source: SRS section 9.1 (accepted trade-off).
- The development proxy must be tested: SRS section 12 item 3.

---

## Production topology

[Back to navigation](#navigation)

One SEA, a supervisor and a gateway process, one HTTPS origin.

```mermaid
flowchart TB
    SEA["Single SEA file per OS/arch: dispatcher + sea-runtime + api-gateway + SPA assets (SRS 1.1, 9.1 REQ-RUNTIME-01)"]
    SEA -->|"no args: supervisor mode (SRS 9.1 REQ-RUNTIME-03)"| SUP["Supervisor process: sea-runtime, no listeners (SRS 9.1 REQ-RUNTIME-02)"]
    SUP -->|"spawn process.execPath --service gateway (SRS 9.1 REQ-RUNTIME-03)"| GW["Gateway process: api-gateway (SRS 1.2, 9.1)"]
    GW --> DB[("SQLite vector (SRS 1.2)")]
    GW --> ORIGIN["HTTPS :8443: /api + Angular PWA, one origin (SRS 1.2, 9.1)"]
    ORIGIN --> M["Mobile PWA (SRS 1.2)"]
    ORIGIN --> B["PC browser PWA (SRS 1.2)"]
    ORIGIN --> W["Tauri WebView (SRS 1.2, 9 REQ-DESK-02)"]
```

Sources:

- One physical SEA per platform/architecture. The same file runs several times. Each run has its own Node runtime and DI container. Source: SRS section 1.1 and [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md).
- The gateway HTTPS is the only public HTTP entry point of the LAN. The supervisor publishes no HTTP. Source: SRS section 1.1 and [REQ-RUNTIME-02](../requirements/09-desktop-tauri.md).
- Same origin `https://IP-or-hostname:8443/` hosts `/api/**` and the PWA: SRS section 1.2.
- The baseline starts only `api-gateway`: SRS section 1.2 and [REQ-RUNTIME-05](../requirements/09-desktop-tauri.md).
- SQLite vector persistence: SRS section 1.2 (topology diagram).

---

## Tauri sidecar

[Back to navigation](#navigation)

```mermaid
sequenceDiagram
    participant T as Tauri Rust
    participant S as SEA supervisor
    participant G as SEA gateway child
    participant V as WebView
    T->>S: start sidecar once, no args (REQ-DESK-01, REQ-RUNTIME-03)
    S->>G: spawn same execPath with --service gateway (REQ-RUNTIME-03)
    G-->>S: IPC READY + health (SRS 9.1 sequence)
    S-->>T: aggregate state starting/ready/degraded/error/stopping (REQ-RUNTIME-05)
    T->>V: show Angular served by the gateway (REQ-DESK-02)
    T->>S: Quit: controlled shutdown (REQ-DESK-03, REQ-RUNTIME-06)
    S->>G: IPC SHUTDOWN, then app.close() (REQ-RUNTIME-06)
```

Sources:

- The SEA is distributed through `bundle.externalBin` as a sidecar, per target triple. Source: SRS section 9, [REQ-DESK-01](../requirements/09-desktop-tauri.md).
- Tauri/Rust starts, monitors and stops only the supervisor. The supervisor manages the Nest processes. Source: SRS section 9, [REQ-DESK-02](../requirements/09-desktop-tauri.md) and [REQ-DESK-05](../requirements/09-desktop-tauri.md).
- The WebView shows the same Angular served from the gateway process: SRS section 9, [REQ-DESK-02](../requirements/09-desktop-tauri.md).
- The host stays operable from LAN clients with the window hidden: SRS section 9, [REQ-DESK-06](../requirements/09-desktop-tauri.md).
- Shutdown over IPC on `stdio`, then timeout and forced termination: SRS section 9.1, [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md).

---

## Architecture decisions

[Back to navigation](#navigation)

The [roadmap proposal](../roadmap/PROPOSAL.md#pitches) defines ADR numbering once. Each POC deliverable names its ADR. The numbers are proposals, not SRS requirements. No decision record is written yet. Each entry below is a placeholder. Topics come from SRS v1.6 text.

### ADR-001: Toolchain substitution

Status: placeholder. Written by POC-1, only if a version substitution happens ([POC-1](../roadmap/PROPOSAL.md#poc-1-toolchain-viability-and-workspace-skeleton)). No topic in this page.

### ADR-002: Single-SEA portability

Status: placeholder. Written by POC-2 ([POC-2](../roadmap/PROPOSAL.md#poc-2-single-sea-and-runtime-supervisor)). Topic here: a single SEA executable per OS/architecture (SRS 9.1, [REQ-RUNTIME-01](../requirements/09-desktop-tauri.md)).

### ADR-003: Drizzle tag choice

Status: placeholder. Written by POC-3 ([POC-3](../roadmap/PROPOSAL.md#poc-3-config-and-sqlite-vector-persistence-inside-the-sea)). Topic here: Drizzle version choice and the RC fallback. Sources: SRS section 12 item 5. Also the amendment to SRS v1.6 L95.

### ADR-004: TLS trust model

Status: placeholder. Written by POC-4 ([POC-4](../roadmap/PROPOSAL.md#poc-4-https-gateway-serving-the-angular-pwa)). No topic in this page.

### ADR-005: Desktop process model

Status: placeholder. Written by POC-5 ([POC-5](../roadmap/PROPOSAL.md#poc-5-tauri-desktop-shell-with-sea-sidecar)). Topic here: Tauri v2 sidecar through `bundle.externalBin` (SRS 9, [REQ-DESK-01](../requirements/09-desktop-tauri.md)).

### ADR-006: Auth mechanism

Status: placeholder. Written by POC-7 ([POC-7](../roadmap/PROPOSAL.md#poc-7-auth-and-roles)). No topic in this page.

### ADR-007: Release flow

Status: placeholder. Written by POC-9, which is on HOLD ([POC-9](../roadmap/PROPOSAL.md#poc-9-github-actions-cicd-and-releases-hold)). No topic in this page.

### Topics without an ADR number

The proposal assigns no ADR id to these topics. They stay unnumbered until a human records them.

- Angular, gateway and supervisor as sibling apps, joined only at build/distribution (SRS 1.1).
- `sea-runtime` as a Nest standalone supervisor without listeners (SRS 9.1, [REQ-RUNTIME-02](../requirements/09-desktop-tauri.md)).
- Re-entry of the same binary through a Zod-validated `--service` dispatcher (SRS 9.1, [REQ-RUNTIME-03](../requirements/09-desktop-tauri.md)).
- Shutdown through Node IPC over `stdio` instead of relying on `SIGTERM` (SRS 9.1, [REQ-RUNTIME-06](../requirements/09-desktop-tauri.md)).
