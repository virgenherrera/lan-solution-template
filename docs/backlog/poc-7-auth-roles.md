<!-- toon-meta
fmt: TOON
doc: docs/backlog/poc-7-auth-roles.md
title: "POC-7 Auth and roles"
type: backlog
summary: "Backlog item for authentication and roles."
related[3]: docs/backlog/README.md,docs/backlog/poc-6-postgresql-adapter-parity.md,docs/backlog/poc-8-msi-matrix-versioning.md
status: current
updated: 2026-10-30
-->

# POC-7: Auth and roles

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Previous](poc-6-postgresql-adapter-parity.md) | [Up](README.md) | [Next](poc-8-msi-matrix-versioning.md)

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
| Status | Cycle 3 (planned) |
| Appetite | 1-2 weeks, small batch |
| Depends on | POC-4, POC-5 |
| Branch | `minor/poc-07-auth-roles` |
| Requirements | 10 REQ ids |
| Acceptance criteria | AC-06 |

---

## Goal

[Back to navigation](#navigation)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles).

- Enforce user:password auth in NestJS, not only in Angular.
- Roles: public, employee and admin.
- Add a protected UI.

| No-gos |
|---|
| No insecure demo credentials. |
| No fake `auth-ms`. |
| No secrets in browser bundles. |
| No security through hidden JS only. |
| No bootstrap account in release builds. |

---

## Requirements

[Back to navigation](#navigation)

Pitch Acceptance criteria line ([PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles)):

- [REQ-SEC-01](../requirements/07-security.md)
- [REQ-SEC-02](../requirements/07-security.md)
- [REQ-SEC-03](../requirements/07-security.md)
- [REQ-SEC-04](../requirements/07-security.md)
- [REQ-SEC-06](../requirements/07-security.md)
- [REQ-WEB-02](../requirements/08-web-angular.md)
- [REQ-WEB-03](../requirements/08-web-angular.md)
- [REQ-WEB-04](../requirements/08-web-angular.md)
- [REQ-TEST-05](../requirements/11-nx-quality-testing.md)

Cited elsewhere in the pitch:

- [REQ-CFG-03](../requirements/04-configuration.md)

---

## Acceptance criteria

[Back to navigation](#navigation)

- [AC-06](../requirements/11-nx-quality-testing.md)

Source: [PROPOSAL pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles).

---

## Tasks

[Back to navigation](#navigation)

- [ ] Dependency task, first: wait for the POC-5 spike on the first-run setup wizard. POC-7 consumes its result and depends on it. Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions), [REQ-SEC-02](../requirements/07-security.md).
  - Use the chosen path as input for the initial-credential flow. Use it for the dev super user hand-off.
  - Inputs: the POC-5 spike output and the list in Decision Log item 13. Security claims are not verified.
  - Output: the path recorded in ADR-006 (auth mechanism) and in `POC-07-Result`.
  - No own spike time. If the POC-5 spike hit its 2-day breaker, use the MSI credential dialog on Windows. Use the CLI `setup` command on Linux and macOS.
  - Source: [decision 13](../roadmap/PROPOSAL.md#decision-log), [OQ5](../roadmap/PROPOSAL.md#open-questions)
- [ ] Server-side sessions in SQLite with the cookie `__Host-sid`. Scrypt hashing. 15+ character policy with blocklist. Exponential throttle per account and IP. CSRF via SameSite plus Origin check. The design notes are an unreviewed research summary. Source: [REQ-SEC-02](../requirements/07-security.md), [REQ-SEC-04](../requirements/07-security.md) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))
- [ ] The user creates the first admin in the setup wizard (POC-5 spike). The MSI credential dialog (POC-8) is only the fallback. See [decision 13](../roadmap/PROPOSAL.md#decision-log) and [OQ5](../roadmap/PROPOSAL.md#open-questions). No permanent default credentials exist. Source: [REQ-SEC-02](../requirements/07-security.md), [OQ5](../roadmap/PROPOSAL.md#open-questions) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))
- [ ] Dev super user seed (decision 12): at startup, after migrations ([REQ-DB-06](../requirements/05-persistence.md) order). Run it only in development. Run it only if no real admin exists. Account `dev-admin`, random password of 15+ characters shown once, created through the production user-creation path. Source: [REQ-SEC-02](../requirements/07-security.md), [OQ2](../roadmap/PROPOSAL.md#open-questions) (human decision 12)
- [ ] Expiry and purge (decision 12): the row carries `expires_at` and a bootstrap mark. A startup purge deletes it. It is also deleted when the first real admin is created. It is also deleted after the first login with a forced password change. Source: [REQ-SEC-02](../requirements/07-security.md), human decision 12
- [ ] Reseed command for the dev super user (decision 12). Source: [REQ-SEC-02](../requirements/07-security.md), human decision 12
- [ ] Smoke test: the DB of a release build contains no bootstrap account (decision 12). Source: [REQ-SEC-02](../requirements/07-security.md), human decision 12
- [ ] Test: authentication rejects an expired bootstrap account (decision 12). Source: [REQ-SEC-02](../requirements/07-security.md), [REQ-SEC-01](../requirements/07-security.md), human decision 12
- [ ] Roles public, employee and admin; Nest guards return 401 or 403. Source: [REQ-SEC-01](../requirements/07-security.md), [AC-06](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))
- [ ] Retro ARPANET terminal public page, a logon page, and minimal protected employee and admin routes. Source: [REQ-WEB-02](../requirements/08-web-angular.md) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))
- [ ] Lazy-load role routes. Unauthorized views are not rendered in the DOM. The API still blocks them. Source: [REQ-WEB-03](../requirements/08-web-angular.md), [REQ-SEC-03](../requirements/07-security.md), [AC-06](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))
- [ ] Strict payload validation, size limits and auth-abuse defenses. Source: [REQ-SEC-04](../requirements/07-security.md), [REQ-CFG-03](../requirements/04-configuration.md) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))
- [ ] Run Playwright on dev :4200 and distributed :8443. Source: [REQ-TEST-05](../requirements/11-nx-quality-testing.md), [AC-06](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))
- [ ] Publish `POC-07-Result` and `ADR-006` (auth mechanism) under `docs/`. Source: [REQ-SEC-01](../requirements/07-security.md), [AC-06](../requirements/11-nx-quality-testing.md) ([pitch](../roadmap/PROPOSAL.md#poc-7-auth-and-roles))

Ids with no pitch task (none invented): [REQ-SEC-06](../requirements/07-security.md), [REQ-WEB-04](../requirements/08-web-angular.md).

---

## Open questions

[Back to navigation](#navigation)

Source: `docs/roadmap/PROPOSAL.md`, Open questions. The POC-5 spike decides the OQ5 mechanism.

| OQ | Topic | Status |
|---|---|---|
| [OQ2](../roadmap/PROPOSAL.md#open-questions) | dev super user vs REQ-SEC-02 | decided (human decision 12) |
| [OQ5](../roadmap/PROPOSAL.md#open-questions) | first-run setup without MSI | decided (human decision 13): pending spike |
