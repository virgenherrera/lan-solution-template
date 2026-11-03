<!-- toon-meta
fmt: TOON
doc: docs/requirements/amendments-2026-10-30.md
title: "Amendments 2026-10-30"
type: requirement
summary: Records agent-applied and human-approved amendments to SRS v1.6 and the open questions that gate them.
ids[0]:
related[7]: docs/requirements/README.md,docs/requirements/12-agent-delivery.md,docs/requirements/traceability.md,docs/requirements/04-configuration.md,docs/requirements/10-node-sea-distribution.md,docs/architecture/adr/ADR-007-persistence-system.md,docs/backlog/persistence-system.md
status: current
updated: 2026-11-03
-->

# Amendments 2026-10-30

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](12-agent-delivery.md) | [Up](README.md) | [Next](amendments-2026-11-02.md)

## Navigation

- [At a glance](#at-a-glance)
- [Approval status](#approval-status)
- [Amendments 2026-10-30](#amendments-2026-10-30)
- [Approved amendment: REQ-CFG-05, no default config copy](#approved-amendment-req-cfg-05-no-default-config-copy)

## At a glance

[Back to navigation](#navigation)

Five agent changes and one approved human amendment to the v1.6 text. Next: the human approves [OQ15](../roadmap/PROPOSAL.md#open-questions).

| SRS v1.6 line | Id | Change | Open question |
|---|---|---|---|
| L95 | [REQ-STACK-07](02-technology-baseline.md) | Drizzle: stable tag first, `1.0.0-rc.5` as fallback | [OQ15](../roadmap/PROPOSAL.md#open-questions), waits for approval |
| L105, L945 | Drizzle note, delivery item 5 | RC risk text becomes conditional | follows L95 |
| L269 | [REQ-NET-01](06-web-gateway-https-pwa.md) | The premise gets a mark; the requirement does not change | none |
| L165, L502 | [REQ-CFG-05](04-configuration.md), [REQ-SEA-05](10-node-sea-distribution.md) | Real `config.json` lives under the resolved root | [OQ1](../roadmap/PROPOSAL.md#open-questions), decided (decision 11) |
| L349 | [REQ-SEC-02](07-security.md) | The only dev account is a seeded, self-destructing data row | [OQ2](../roadmap/PROPOSAL.md#open-questions), decided (decision 12) |
| L165, L502 (second change) | [REQ-CFG-05](04-configuration.md), [REQ-SEA-05](10-node-sea-distribution.md) | No default config copy; one base directory; a missing or invalid `config.json` stops the start | [OQ25](../roadmap/PROPOSAL.md#open-questions), decided (human, 2026-11-03) |

## Approval status

[Back to navigation](#navigation)

| Item | State |
|---|---|
| Text of [REQ-STACK-07](02-technology-baseline.md), [REQ-CFG-05](04-configuration.md), [REQ-SEA-05](10-node-sea-distribution.md), [REQ-SEC-02](07-security.md) | Agent proposal |
| [OQ1](../roadmap/PROPOSAL.md#open-questions) | Decided 2026-10-30 (human decision 11) |
| [OQ2](../roadmap/PROPOSAL.md#open-questions) | Decided 2026-10-30 (human decision 12) |
| [OQ15](../roadmap/PROPOSAL.md#open-questions) | Waits for human approval |
| Approved amendment of [REQ-CFG-05](04-configuration.md) and [REQ-SEA-05](10-node-sea-distribution.md) (no default config copy, one base directory), [OQ25](../roadmap/PROPOSAL.md#open-questions) | Approved 2026-11-03 (human) |

See the Open questions table in the [roadmap proposal](../roadmap/PROPOSAL.md#open-questions).

## Amendments 2026-10-30

[Back to navigation](#navigation)

Line numbers are those of the file before the amendments. They are written as `SRS v1.6 L<n>`.

- SRS v1.6 L95 ([REQ-STACK-07](02-technology-baseline.md)). Drizzle moves from a pinned RC to a preferred stable tag. The fallback is `1.0.0-rc.5` if vector support is missing. See human decision 10 (2026-10-30) ([OQ15](../roadmap/PROPOSAL.md#open-questions)).
- SRS v1.6 L105 and SRS v1.6 L945 (Drizzle note and delivery item 5). The RC risk text becomes conditional: it applies only if the fallback is used.
- SRS v1.6 L269 ([REQ-NET-01](06-web-gateway-https-pwa.md)). The `NodeAdapter` + `ServeStaticModule` premise is marked `not verified`. The requirement does not change. Superseded by POC-1f: no `ServeStaticModule` in the current design.
- SRS v1.6 L165 ([REQ-CFG-05](04-configuration.md)) and L502 ([REQ-SEA-05](10-node-sea-distribution.md)): the install path holds only read-only defaults. The defaults contain no secrets. The real `config.json` lives under the root that the paths library resolves once. The code uses paths relative to that root. Permissions are `0700`/`0600`. [OQ1](../roadmap/PROPOSAL.md#open-questions) is decided by human decision 11.
- SRS v1.6 L349 ([REQ-SEC-02](07-security.md), ref. section 12 item 7). The database is the single source of truth for identity. A setup wizard creates the first real admin (human decision 13). The only dev account is the seeded, self-destructing `dev-admin` data row, only in development. See human decision 12 (2026-10-30) ([OQ2](../roadmap/PROPOSAL.md#open-questions)). No environment flag bypasses the database. No config file holds credentials. The production user-creation path creates the `dev-admin` row. The password is random, at least 15 characters, shown once. The server enforces expiry and purge. Production never seeds. There is no permanent credential and no default credential in production. ASVS citations stay `not verified`.

## Approved amendment: REQ-CFG-05, no default config copy

[Back to navigation](#navigation)

Status: approved by the human on 2026-11-03 ([OQ25](../roadmap/PROPOSAL.md#open-questions), decided). The text of [REQ-CFG-05](04-configuration.md) and [REQ-SEA-05](10-node-sea-distribution.md) is edited.

Human words, verbatim: "SIEMPRE TRUENA si esta invalida o falta", "lo unico que cambia entre dev y prod es el CWD en dev (es lo que diga pnpm) y en built/prod/deploy es el installPath que haya definido el asistente de instalacion" and "usa tu pendjo ownership".

- Removed text. "The install path holds only read-only defaults. The defaults contain no secrets." The shipped `config.default.json` copy path is gone.
- Replaced text. The old root sentences ("The paths library resolves the root once", "the code uses paths relative to that root", "It MUST NOT use the current working directory as the anchor") now say this. The base directory is resolved once. It is the directory of the executable in a packaged run and the current working directory in a dev run. Every path (`config/`, `data/`, `logs/`, `certs/`) is relative to that base, with the same layout in both runs. The code MUST NOT use any other anchor.
- Strict config. The real `config.json` lives at `<base>/config/config.json`. A missing or invalid `config.json` MUST stop the start. The runtime never creates it and never falls back to defaults ([ADR-007](../architecture/adr/ADR-007-persistence-system.md)). Who creates the file on a host is TBD with the installer ([OQ24](../roadmap/PROPOSAL.md#open-questions)).
- Dev base. Decision S11 ([OQ23](../roadmap/PROPOSAL.md#open-questions)) uses `process.cwd()` as the dev base directory. The old cwd ban is gone for dev.
- Unchanged. The permission sentences (`0700`, `0600`, owner-only ACL, secrets) and the [OQ16](../roadmap/PROPOSAL.md#open-questions) sentence.
- Same fix elsewhere. [REQ-SEA-05](10-node-sea-distribution.md) repeated the removed sentences and is corrected. Other normative pages repeating them: none found (not verified beyond a search of `docs/` and the root README).
- Slices. See the [persistence system backlog](../backlog/persistence-system.md).
