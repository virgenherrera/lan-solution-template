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
- [Editorial corrections 2026-11-03](#editorial-corrections-2026-11-03)

## At a glance

[Back to navigation](#navigation)

Five agent changes and one approved human amendment to the v1.6 text, plus the editorial corrections of 2026-11-03.

| SRS v1.6 line | Id | Change | Open question |
|---|---|---|---|
| L95 | [REQ-STACK-07](02-technology-baseline.md) | Drizzle: stable tag first, `1.0.0-rc.5` as fallback | [OQ15](../roadmap/PROPOSAL.md#open-questions), decided (human, 2026-11-02) |
| L105, L945 | Drizzle note, delivery item 5 | RC risk text becomes conditional | follows L95 |
| L269 | [REQ-NET-01](06-web-gateway-https-pwa.md) | The premise gets a mark; the requirement does not change | none |
| L165, L502 | [REQ-CFG-05](04-configuration.md), [REQ-SEA-05](10-node-sea-distribution.md) | Real `config.json` lives under the resolved root | [OQ1](../roadmap/PROPOSAL.md#open-questions), decided (decision 11) |
| L349 | [REQ-SEC-02](07-security.md) | The only dev account is a seeded, self-destructing data row | [OQ2](../roadmap/PROPOSAL.md#open-questions), decided (decision 12) |
| L165, L502 (second change) | [REQ-CFG-05](04-configuration.md), [REQ-SEA-05](10-node-sea-distribution.md) | No default config copy; one base directory; a missing or invalid `config.json` stops the start | [OQ25](../roadmap/PROPOSAL.md#open-questions), decided (human, 2026-11-03) |

## Approval status

[Back to navigation](#navigation)

| Item | State |
|---|---|
| Text of [REQ-SEC-02](07-security.md) | Agent proposal |
| Text of [REQ-STACK-07](02-technology-baseline.md) | Applied; [OQ15](../roadmap/PROPOSAL.md#open-questions) closed 2026-11-02 |
| [OQ1](../roadmap/PROPOSAL.md#open-questions) | Decided 2026-10-30 (human decision 11) |
| [OQ2](../roadmap/PROPOSAL.md#open-questions) | Decided 2026-10-30 (human decision 12) |
| Approved amendment of [REQ-CFG-05](04-configuration.md) and [REQ-SEA-05](10-node-sea-distribution.md) (no default config copy, one base directory), [OQ25](../roadmap/PROPOSAL.md#open-questions) | Approved 2026-11-03 (human) |

See the Open questions table in the [roadmap proposal](../roadmap/PROPOSAL.md#open-questions).

## Amendments 2026-10-30

[Back to navigation](#navigation)

Line numbers are those of the file before the amendments. They are written as `SRS v1.6 L<n>`.

- SRS v1.6 L95 ([REQ-STACK-07](02-technology-baseline.md)). Drizzle moves from a pinned RC to a preferred stable tag. The fallback is `1.0.0-rc.5` if vector support is missing. See human decision 10 (2026-10-30) ([OQ15](../roadmap/PROPOSAL.md#open-questions)).
- SRS v1.6 L105 and SRS v1.6 L945 (Drizzle note and delivery item 5). The RC risk text becomes conditional: it applies only if the fallback is used.
- SRS v1.6 L269 ([REQ-NET-01](06-web-gateway-https-pwa.md)). The `NodeAdapter` + `ServeStaticModule` premise is marked `not verified`. The requirement does not change. Superseded by POC-1f: no `ServeStaticModule` in the current design. The `NodeAdapter` part is verified in `apps/api-gateway/src/main.ts` and the mark is removed (see the editorial corrections).
- SRS v1.6 L165 ([REQ-CFG-05](04-configuration.md)) and L502 ([REQ-SEA-05](10-node-sea-distribution.md)): the install path holds only read-only defaults. The defaults contain no secrets. The real `config.json` lives under the root that the paths library resolves once. The code uses paths relative to that root. Permissions are `0700`/`0600`. [OQ1](../roadmap/PROPOSAL.md#open-questions) is decided by human decision 11. Superseded in part by the approved amendment below.
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
- Same fix elsewhere. [REQ-SEA-05](10-node-sea-distribution.md) repeated the removed sentences and is corrected. Other normative pages repeating them: none in `docs/requirements/` (checked 2026-11-03).
- Slices. See the [persistence system backlog](../backlog/persistence-system.md).

## Editorial corrections 2026-11-03

[Back to navigation](#navigation)

Facts and noise only. No requirement changes intent. Each entry: file and line (after the edit), before, after, reason. Code reference: the repository at this date.

| File, line | Before | After | Reason |
|---|---|---|---|
| [04-configuration.md](04-configuration.md) L44, REQ-CFG-02 | "incompatible with Nest 11" | "incompatible with Nest 12" | [REQ-STACK-04](02-technology-baseline.md) pins NestJS 12.3.2 |
| [04-configuration.md](04-configuration.md) L48, REQ-CFG-04 | "(`DrizzleModule.forRootAsync` or an equivalent supported composition)" | "asynchronous providers" | Drizzle is build time only ([REQ-DB-04](05-persistence.md)); the code uses async DI providers |
| [04-configuration.md](04-configuration.md) L50, REQ-CFG-05 | "outside the executable. They belong in the appropriate Windows, macOS or Linux directories." and "directory of the executable." | "outside the executable file." and "directory of the executable (the install path)." | The approved amendment above fixes the base directory; no OS default root exists in `libs/shared-core/src/paths.ts` |
| [05-persistence.md](05-persistence.md) L43, REQ-DB-01 | "`node:sqlite` + `drizzle-orm/node-sqlite`" and "`pg` + Drizzle" | "`node:sqlite`" and "`pg`" | [REQ-DB-04](05-persistence.md): the SEA holds no `drizzle-orm` code; `libs/shared-core/src/db/sqlite/adapter.ts` uses `node:sqlite` |
| [05-persistence.md](05-persistence.md) L63, REQ-DB-10 | "Status: a proposal from the 2026-11-02 amendment. The human has not approved it." | removed | Approved by the human on 2026-11-02 (title of the requirement, [ADR-005](../architecture/adr/ADR-005-live-schema-validation.md)) |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L99, REQ-NET-01 | "(Premise `NodeAdapter` without Express/Fastify: not verified. The former `ServeStaticModule` premise is replaced by POC-1f.)" | "(The former `ServeStaticModule` premise is replaced by POC-1f.)" | `apps/api-gateway/src/main.ts` uses `NodeAdapter`; `apps/api-gateway/package.json` has no Express or Fastify |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L104, REQ-NET-04 note | "Not met: ... Not verified." | "Not met today: ..." | `apps/api-gateway/src/web-handler.ts` answers a missing file with `index.html` and 200: the gap is verified |
| [09-desktop-tauri.md](09-desktop-tauri.md) L88, REQ-RUNTIME-05 | "report to Tauri an aggregate state ...;" | same, plus "through the stdout `status` events of [ADR-006]" | The sidecar contract is stdout NDJSON `status` events |
| [10-node-sea-distribution.md](10-node-sea-distribution.md) L51, REQ-SEA-05 | Repeated the base directory, `config.json`, permissions and strict-config sentences | One link to [REQ-CFG-05](04-configuration.md) plus the SEA base directory | One fact, one home |
| [03-file-structure.md](03-file-structure.md) L45 to L70, tree | `libs/shared-core/src/validation/`, `tsconfig.base.json`, no `service-registry`, no `db-migrations` | Current libs, scripts and `tools/vector`; CI workflow marked "not created yet" | Matches the repository |
| [09-desktop-tauri.md](09-desktop-tauri.md) and [11-nx-quality-testing.md](11-nx-quality-testing.md), diagrams | `--service gateway` | `--service api-gateway` | The service id is `api-gateway` (`apps/sea-runtime/src/services.ts`) |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L107, REQ-NET-06 | "**MUST** use `8443` by default, configurable from the singleton" | "**MUST** use the value in `config.example.json` (`8443`), configurable through `net.httpsPort`" | The persisted config has no defaults ([ADR-007](../architecture/adr/ADR-007-persistence-system.md)); `8443` lives in `libs/shared-core/config.example.json` |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L109, REQ-NET-08 | "listener on `8080` ... HTTPS `:8443`" | "listener on `net.httpPort` (`8080` in `config.example.json`) ... HTTPS on `net.httpsPort`" | Same reason; `apps/api-gateway/src/main.ts` reads both ports from `config.net` |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L55, REQ-DEV-01 | "(default HTTPS `127.0.0.1:8443`)" | "(the port in `config.example.json`, `net.httpsPort`)" | Same reason |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L177, REQ-PWA-03 | "`https://IP-or-hostname:8443/`" | "`https://IP-or-hostname:<net.httpsPort>/`" | Same reason |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L104, REQ-NET-04 note | "*Not met today: a missing `.js` returns `index.html` with 200 until POC-4 applies REQ-NET-07.*" | removed | `apps/api-gateway/src/web-handler.ts` answers a missing path with an extension with 404 |
| [06-web-gateway-https-pwa.md](06-web-gateway-https-pwa.md) L43, summary row "Today" | "The gateway listens on plain HTTP at `127.0.0.1:3000`. TLS, `8443` and `8080` arrive with POC-4" | "The gateway listens on HTTPS and redirects HTTP with `308` ... ports from `net.httpsPort` and `net.httpPort`" | `apps/api-gateway/src/main.ts` listens on both configured ports |
