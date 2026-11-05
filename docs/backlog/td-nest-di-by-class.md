<!-- toon-meta
fmt: TOON
doc: docs/backlog/td-nest-di-by-class.md
title: "Technical debt: Nest DI by class"
type: backlog
summary: "Technical debt: the supervisor providers CLOCK, RANDOM and SERVICE_ROUTES use Symbol tokens and should become injectable classes like nest-base. Nothing verified."
ids[0]:
related[3]: docs/backlog/README.md,docs/results/POC-06-Result.md,docs/backlog/persistence-system.md
status: proposed
updated: 2026-11-05
-->

# Technical debt: Nest DI by class

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

## Navigation

- [At a glance](#at-a-glance)
- [Debt items](#debt-items)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Technical debt. No design. Every item is not verified. |
| Appetite | none |
| Depends on | a refactor branch |
| Requirements | none new. No id is invented here. |
| Origin | The POC-6 config migration, see [POC-06-Result](../results/POC-06-Result.md) |

---

## Debt items

[Back to navigation](#navigation)

Every item is not verified.

- [ ] `CLOCK`, `RANDOM` and `SERVICE_ROUTES` in `apps/sea-runtime/src/supervisor/tokens.ts` are `Symbol` tokens bound with `useValue` or `useFactory` in `supervisor.module.ts`. Turn them into injectable classes, as in nest-base. A `TD:` comment marks the spot in `supervisor.module.ts`.
- [ ] [persistence-system](persistence-system.md) (line 88, task T3) mentions `DATABASE_ADAPTER`, which no longer exists. Only listed here; that page is not edited.

---

## Not verified

[Back to navigation](#navigation)

- Every item above.
