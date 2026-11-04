<!-- toon-meta
fmt: TOON
doc: docs/backlog/log-service-otel-grpc.md
title: "Log service with OpenTelemetry data model and gRPC"
type: backlog
summary: "Idea, TBD, no design: one log service for Rust and Node, OpenTelemetry log data model, swappable transport."
ids[0]:
related[4]: docs/backlog/README.md,docs/architecture/adr/ADR-006-sidecar-status-contract.md,docs/architecture/adr/ADR-009-desktop-process-model.md,docs/results/POC-05-Result.md
status: proposed
updated: 2026-11-04
-->

# Log service with OpenTelemetry data model and gRPC

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Idea](#idea)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Idea, TBD. No design. |
| Appetite | none |
| Depends on | none decided |
| Requirements | none. No REQ or AC id exists for it. |
| Origin | Idea raised during POC-5. The source is not recorded. The details below are an agent reading of it. |

---

## Idea

[Back to navigation](#navigation)

Today every process logs on its own. The sidecar writes logs on stderr ([ADR-006](../architecture/adr/ADR-006-sidecar-status-contract.md)) and the Tauri host forwards them to its own log ([ADR-009](../architecture/adr/ADR-009-desktop-process-model.md)). The idea is one log service that Rust and Node both send to.

- The contract follows the OpenTelemetry logs data model. The transport can be swapped.
- Today the transport is stderr, as in ADR-006.
- Later the transport is asynchronous gRPC, sent off the main thread.
- The service persists logs on disk with rotation.
- It may be an OTLP receiver. That is **not verified**: it comes from the knowledge of the agent and needs a review against primary sources (the OpenTelemetry specification and the OTLP protocol).

---

## Risks

[Back to navigation](#navigation)

- The service must start first, and the host must not depend on it. If the service is down, the host falls back to stderr.
- The service listens on loopback only.
- A log line must never carry a token or a secret (REQ-SEC-06 applies).

---

## Out of scope

[Back to navigation](#navigation)

- It is outside POC-5. POC-5 keeps the stderr transport.
- It has no REQ, no AC and no appetite.

---

## Not verified

[Back to navigation](#navigation)

- Everything in this page. It is an idea with no design and no probe.
- That the OpenTelemetry log data model and OTLP fit this use.
- That a gRPC server fits the single SEA binary (the SEA assets and native modules are not checked).
