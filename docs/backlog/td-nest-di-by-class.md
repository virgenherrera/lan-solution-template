<!-- toon-meta
fmt: TOON
doc: docs/backlog/td-nest-di-by-class.md
title: "Technical debt: Nest DI by class"
type: backlog
summary: "Resolved technical debt: the supervisor providers CLOCK, RANDOM and SERVICE_ROUTES became the abstract classes Clock, Random and ServiceRoutes. Verified."
ids[0]:
related[3]: docs/backlog/README.md,docs/results/POC-06-Result.md,docs/backlog/persistence-system.md
status: current
updated: 2026-11-05
-->

# Technical debt: Nest DI by class (resolved)

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
| Status | Resolved and verified. |
| Appetite | none |
| Depends on | a refactor branch |
| Requirements | none new. No id is invented here. |
| Origin | The POC-6 config migration, see [POC-06-Result](../results/POC-06-Result.md) |

---

## Debt items

[Back to navigation](#navigation)

Resolved and verified.

- [x] `CLOCK`, `RANDOM` and `SERVICE_ROUTES` are now the abstract classes `Clock`, `Random` and `ServiceRoutes`, with the implementations `SystemClock`, `SystemRandom` and `SeaServiceRoutes` injected with `useClass` (strategy pattern). `ServiceLifecycle` is unchanged. Verified (build, lint, test:static, test:dynamic, smoke-pg; `smoke-sea` 30 checks in 2 of 3 runs, the other hit an unrelated flake).
- [x] [persistence-system](persistence-system.md) (line 88, task T3) no longer names `DATABASE_ADAPTER`.

---

## Not verified

[Back to navigation](#navigation)

- Nothing pending for this item. The `smoke-sea` flake seen during verification is tracked in [POC-06-Result](../results/POC-06-Result.md#debt).
