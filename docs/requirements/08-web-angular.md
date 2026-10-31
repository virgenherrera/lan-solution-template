<!-- toon-meta
fmt: TOON
doc: docs/requirements/08-web-angular.md
title: Web Angular
type: requirement
summary: "Defines Angular web app baseline, lazy protected routes and minimal UI requirements."
ids[4]: REQ-WEB-01,REQ-WEB-02,REQ-WEB-03,REQ-WEB-04
related[3]: docs/requirements/README.md,docs/requirements/07-security.md,docs/requirements/09-desktop-tauri.md
status: current
updated: 2026-10-30
-->

# 8. Web Angular

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](07-security.md) | [Up](README.md) | [Next](09-desktop-tauri.md)

## Navigation

- [At a glance](#at-a-glance)
- [8. Web Angular](#8-web-angular)

## At a glance

[Back to navigation](#navigation)

| Topic | Point |
|---|---|
| Stack | Angular 22, strict TypeScript, Signals, zoneless, Tailwind |
| Pages | Retro ARPANET public page, sign-in, `employee` and `admin` routes |
| Routes | Protected routes lazy-load; API blocks unauthorized actions |
| Federation | Prepare only; no fictitious remotes |
| Next | [desktop Tauri](09-desktop-tauri.md) |

## 8. Web Angular

[Back to navigation](#navigation)

**REQ-WEB-01.** Angular 22 **MUST** operate with strict TypeScript, Signals, zoneless and Tailwind.

**REQ-WEB-02.** Initial UI is minimalist. It has a public page in a **retro ARPANET terminal** style (monospaced, green/amber on black). It also has a sign-in/logon page and minimal protected routes `employee` and `admin`.

**REQ-WEB-03.** Protected routes **MUST** use lazy loading/code-splitting. Unauthorized views **MUST NOT** be rendered in the DOM. The API **MUST** also block unauthorized actions.

**REQ-WEB-04.** Prepare for a future split into Module/Native Federation, **without implementing fictitious remotes** in the baseline. Add real federation when a derived application has several independently deployable units. **Independent frontend SPA, always located in `apps/web-angular/`.**
