<!-- toon-meta
fmt: TOON
doc: docs/requirements/12-agent-delivery.md
title: Delivery instructions for the agent
type: requirement
summary: Mandatory agent steps to build the template from an empty repository and report results.
ids[0]:
related[3]: docs/requirements/README.md,docs/requirements/11-nx-quality-testing.md,docs/requirements/amendments-2026-10-30.md
status: current
updated: 2026-10-30
-->

# 12. Delivery instructions for the agent

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](11-nx-quality-testing.md) | [Up](README.md) | [Next](amendments-2026-10-30.md)

## Navigation

- [At a glance](#at-a-glance)
- [12. Delivery instructions for the agent](#12-delivery-instructions-for-the-agent)

## At a glance

[Back to navigation](#navigation)

| Topic | Point |
|---|---|
| Scope | Scaffolding, code and README from an empty repository |
| Order | Frozen-lockfile install, `securityCheck`, `build`, `test`, `package` |
| Labels | Implemented, verified, blocked by environment, out of scope |
| Last | CI/CD comes last; cloud, fictitious LLM, demo credentials, offline sync stay out |
| OS | Name the OS actually checked |
| Next | [amendments](amendments-2026-10-30.md) |

## 12. Delivery instructions for the agent

[Back to navigation](#navigation)

1. **MUST** generate the scaffolding, JSON/YAML files, base code and README that meet this SRS. Start from an empty repository. **MUST** use `nest-base` and `fullstack-base` as design precedents. Do not assume that their earlier implementations are mandatory practices. **MUST NOT** materialize TBD tasks (`bumpDependencies`, `test:doctor`) as active implementation.
2. **MUST** run the ECO commands in the normative CI order: frozen-lockfile install, `securityCheck`, `build`, unfiltered `test` and `package` with native verification; record results and fix reproducible problems. `test` **MUST** propagate `test` to all packages and each one run static → dynamic. For native E2E it **MUST** report per operating system whether it ran on a host, VM, runner or remained pending. Do not present configurations that were not run as verified.
3. **MUST** implement the smallest integrated micro-POCs that satisfy the acceptance criteria. A **real** standalone `runtime-nest` supervises only `gateway-nest` for now. Avoid inventing `auth-ms` or other fictitious business services. **MUST** preserve the isolation of Angular and Nest and test the development proxy.
4. **MUST** distinguish explicitly: **implemented**, **verified**, **blocked by environment** and **out of scope**.
5. **MUST** document decisions that affect portability, security or compatibility with the chosen Drizzle version. This includes the RC fallback, if applicable.
6. **MUST** use the required versions when they exist and are compatible. Any necessary substitution **MUST** be justified with a technical link and identified in the result.
7. **MUST** implement CI/CD as the final phase of the template. Do it once the local commands are stable. **MUST NOT** implement these items. They are cloud deployment and a fictitious LLM engine. They also include insecure demo credentials and offline synchronization between browsers.
8. **MUST** include Mermaid diagrams in the README or explanatory architecture. Keep them in sync with what was actually built. This SRS is the reference for scope and behavior. **MUST** declare which OS was actually checked. Do not infer that testing on macOS certifies Windows and Linux.
