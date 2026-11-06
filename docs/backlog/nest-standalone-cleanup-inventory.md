<!-- toon-meta
fmt: TOON
doc: docs/backlog/nest-standalone-cleanup-inventory.md
title: "Nest standalone cleanup inventory"
type: backlog
summary: "Evidence table of dead code candidates for the Nest standalone refactor; two symbols confirmed by mapping, the rest to verify."
ids[0]:
related[6]: docs/backlog/nest-standalone-refactor.md,docs/architecture/adr/ADR-013-nest-standalone-architecture.md,docs/architecture/declared-services.md,docs/architecture/nest-standalone-boot.md,docs/backlog/README.md,docs/results/POC-02c-assembler-registry.md
status: proposed
updated: 2026-11-06
-->

# Nest standalone cleanup inventory

[Home](../../README.md) | [Requirements](../requirements/README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](../requirements/traceability.md) | [Backlog](README.md)

[Up](README.md)

See also: [ADR-013](../architecture/adr/ADR-013-nest-standalone-architecture.md) | [Declared services](../architecture/declared-services.md) | [Nest standalone boot](../architecture/nest-standalone-boot.md)

## Navigation

- [At a glance](#at-a-glance)
- [Inventory](#inventory)
- [Barrels hide usage](#barrels-hide-usage)
- [Stale documentation](#stale-documentation)
- [Not verified](#not-verified)

---

## At a glance

[Back to navigation](#navigation)

| Item | Value |
|---|---|
| Status | Proposed. Nothing is deleted. |
| Used by | Slice 4 of [Epic: Nest standalone refactor](nest-standalone-refactor.md) |
| Requirements | none. No REQ or AC id is invented here. |
| Rule | Delete only what has zero references in source, tests, tools, scripts and non-TypeScript files. No test or smoke is edited by the refactor. If a deletion needs a test edit, the symbol is not dead. |

The counts below come from a mapping report (symbol search and the code graph). They are reported by mapping, not verified by the author of this page. Runtime behavior was not executed.

---

## Inventory

[Back to navigation](#navigation)

Action values: `delete` (confirmed dead by mapping, awaits QC), `verify` (unsure, QC decides), `keep` (live today).

Evidence columns read as: references in source, tests, tools, and non-TypeScript files.

| Symbol | File | Line | Evidence | Action | QC status |
|---|---|---|---|---|---|
| `ControlMessage` | `libs/service-registry/src/control-channel.ts` | 25 | 0 source, 0 tests, 0 tools, 0 non-TypeScript. Verdict dead. | delete | pending |
| `StatusSnapshot` | `libs/service-registry/src/status-snapshot.ts` | 13 | 0 source, 0 tests, 0 tools, 0 non-TypeScript. Verdict dead. | delete | pending |
| `sharedCoreName` | `libs/shared-core/src/index.ts` | 1 | 0 source, 0 tests, 0 tools, 1 non-TypeScript. Verdict unsure; the non-TypeScript hit is not identified. | verify | pending |
| `SPAWNED_PATTERN` | `libs/service-registry/src/supervisor-log.ts` | 9 | 0 source, 0 tests, 0 tools, 7 non-TypeScript. Verdict unsure; the hits are not identified. | verify | pending |
| `serviceRegistrySchema` | `libs/service-registry/src/service-definition.ts` | 17 | 0 source, 0 tests, 0 tools, 1 non-TypeScript (a documentation claim, see below). Verdict unsure. | verify | pending |
| `ServiceRegistry` | `libs/service-registry/src/service-definition.ts` | 36 | 0 source, 0 tests, 0 tools, 6 non-TypeScript. Verdict unsure. | verify | pending |
| `serviceDefinitionSchema` | `libs/service-registry/src/service-definition.ts` | not recorded | Mapping reports zero code readers outside its own file. Line not recorded. | verify | pending |
| `ServiceDefinition` | `libs/service-registry/src/service-definition.ts` | not recorded | Used only as a `Pick` type at `libs/service-registry/src/startup-order.ts` lines 1 and 7. Live today. | keep | pending |
| field `entry` | `libs/service-registry/src/service-definition.ts` | 9 | No reader found. `ServiceRoute` has no `entry` field. | verify | pending |

Only `ControlMessage` and `StatusSnapshot` are confirmed dead by mapping. The `ServiceDefinition` family (`serviceDefinitionSchema`, `serviceRegistrySchema`, `ServiceRegistry`, `ServiceDefinition`) and the `entry` field are reported with zero code readers, and the QC step must verify that before any delete. `ServiceDefinition` stays until slice 3 of the [epic](nest-standalone-refactor.md) replaces its `Pick` use in `startup-order.ts`.

QC status values: `pending` (not checked), `confirmed` (QC re-ran the search and found zero references), `rejected` (QC found a reference; the row becomes `keep`). Every row starts as `pending`.

---

## Barrels hide usage

[Back to navigation](#navigation)

The barrel files `libs/service-registry/src/index.ts` and `libs/shared-core/src/index.ts` re-export symbols. A symbol that only a barrel mentions looks used to a text search and looks unused to a search for importers. QC must search for the symbol and for the barrel path, and must check that no other package imports it through the barrel. Mapping did not report which symbols pass through a barrel (not verified).

---

## Stale documentation

[Back to navigation](#navigation)

`docs/results/POC-02c-assembler-registry.md`, line 20, says `compile-sea` validates with `serviceRegistrySchema`. Mapping found no such use in the code. This page only records the mismatch. It does not edit that document. Whoever deletes `serviceRegistrySchema` decides how to correct the sentence.

---

## Not verified

[Back to navigation](#navigation)

- Every count and line number above is reported by mapping and was not re-checked here.
- The non-TypeScript references to `sharedCoreName`, `SPAWNED_PATTERN` and `ServiceRegistry` are not identified. They may be documentation text.
- The lines of `serviceDefinitionSchema` and `ServiceDefinition` were not recorded.
- No dynamic reference (string lookup, reflection) was searched for.
