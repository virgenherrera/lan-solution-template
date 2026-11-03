<!-- toon-meta
fmt: TOON
doc: docs/architecture/adr/ADR-007-persistence-system.md
title: "ADR-007 Persistence system"
type: architecture
summary: "Proposes a strict engine-keyed config that always throws, one base directory (cwd in dev, executable directory in prod), lazy engine loading, a barrel split and engine-keyed migration assets."
ids[0]:
related[7]: docs/architecture/adr/ADR-003-config-and-db-strategy.md,docs/architecture/adr/ADR-004-drizzle-build-time-migrations.md,docs/architecture/adr/ADR-005-live-schema-validation.md,docs/backlog/persistence-system.md,docs/requirements/04-configuration.md,docs/requirements/05-persistence.md,docs/requirements/amendments-2026-10-30.md
status: proposed
updated: 2026-11-03
-->

# ADR-007: Persistence system

[Overview](../overview.md) | [Roadmap](../../roadmap/PROPOSAL.md) | [ADR-004](ADR-004-drizzle-build-time-migrations.md) | [ADR-005](ADR-005-live-schema-validation.md) | [Persistence system backlog](../../backlog/persistence-system.md) | [Amendments 2026-10-30](../../requirements/amendments-2026-10-30.md)

## Navigation

- [Status](#status)
- [Context](#context)
- [Decision](#decision)
- [Options rejected](#options-rejected)
- [Consequences](#consequences)
- [Not verified](#not-verified)

## Status

Proposed, 2026-11-03. The human asked for the direction and decided the base directory rule. The other details below are agent proposals and the code does not exist yet. This page is written first, so the docs say what the code will do. The slices are on the [backlog page](../../backlog/persistence-system.md).

Numbering note: the [architecture overview](../overview.md#architecture-decisions) listed an older placeholder set in which "ADR-007" meant "Release flow". That placeholder is now ADR-011. The file number of this record is the one in its file name.

## Context

The human asked for a tightly bounded persistence system. In the human's words, if something is not validated, "boom, truena". The config is validated with Zod, and the database answers a handshake.

The human also said the config "SIEMPRE TRUENA si esta invalida o falta". The cases are: a config that names sqlite and pg, a half config, or one engine and nothing else. That rule allows lazy loading of the selected engine, so both engines are not loaded in memory.

Facts found before this decision:

- `paths.ts` resolves the root through a chain. It is replaced by one base directory (see below).
- `ensureConfigFile` in `config.ts` creates the file when it is absent.
- `z.object` strips unknown keys.
- The barrel `libs/shared-core/src/index.ts` re-exports `sqlite-adapter`, so any import of the barrel pulls the engine in.

## Decision

### Strict config: one engine or nothing

The config is a discriminated union on `engine`. Each variant is a strict object.

```ts
z.discriminatedUnion('engine', [
  z.strictObject({ engine: z.literal('sqlite'), sqlite: /* sqlite block */ }),
])
```

- No `.default`, no `.prefault`, no `superRefine`.
- The union has one variant today (sqlite). PostgreSQL is TBD and joins as one more variant later. No pg config block exists in this work.
- Probe on zod 4.6.7: all of these fail. A missing engine block. Extra keys. Both blocks. An unknown engine. An empty object. `null`.
- `sqlite.file` is a plain file name: `z.string().regex(/^(?!\.+$)[\w.-]+$/)`. A path separator, an absolute path or `..` fails, so the database cannot leave the data directory. It is a regex, not a `refine`.
- The pg variant is not declared yet. A declared variant would make an `engine: "pg"` config valid while the runtime still has no adapter for it. Until PG is in scope, `engine: "pg"` fails with `Invalid discriminator value. Expected 'sqlite'`.

### Always throws, never auto-created

- A missing config file throws. An invalid config throws.
- The `ensureConfigFile` auto-create path is removed. The code never writes a config on its own.
- The installer assistant will create the valid `config.json`. Where and how is TBD until the installer work ([OQ24](../../roadmap/PROPOSAL.md#open-questions)).
- A service or a migration script that needs the database throws without a valid config.
- JSON text is parsed inside the zod pipeline with one helper, `jsonText(schema)` in `service-registry`: `z.string().transform(JSON.parse in try/catch, addIssue).pipe(schema)`. A JSON error and a schema error come out of the same `safeParse`, so `loadConfig` has one error path. `JSON.parse` appears nowhere else in the repo code.

### Lazy engine selection

The database provider is an async `useFactory`. It reads the validated config. It then runs `await import()` of the selected engine only.

Measured on rspack 2.3.0 and Node 26.13:

- Only the selected engine module is evaluated.
- Heap grows about 5 MB for each 5 MB engine that is loaded.
- Both engines stay in the single-file SEA blob (one file, 10.4 MiB). Lazy loading saves memory, not binary size.
- The `import()` argument must be a literal, or a ternary of literals, so the bundler sees every target.
- `LazyModuleLoader` is not used.
- `LimitChunkCountPlugin(1)` inlines the `import()` targets into the one file.
- Node SEA cannot `import()` file-system modules unless `useVfs` is set. `useVfs` excludes `useCodeCache`. So the engines stay bundled and the code cache option is kept.

### Barrel split of shared-core

The root of `libs/shared-core` stops re-exporting `sqlite-adapter` and `sqlite-vector`. Engine code lives behind a subpath export. `SqliteVector` moves into the sqlite engine. A consumer of the root cannot pull an engine in by accident.

### Engine-keyed migration assets

Migration assets move to `db-migrations/<engine>/...`. Only `sqlite` exists. No pg folder is created. [REQ-DB-03](../../requirements/05-persistence.md) already says each engine keeps its own schemas and migrations.

### One base directory

Decided by the human (2026-11-03, [OQ23](../../roadmap/PROPOSAL.md#open-questions)). The human said: "lo unico que cambia entre dev y prod es el CWD en dev (es lo que diga pnpm) y en built/prod/deploy es el installPath que haya definido el asistente de instalacion".

One parameter changes between dev and prod: the base directory.

| Run | Base directory |
|---|---|
| Dev | `process.cwd()`, whatever pnpm gives |
| Built, prod, deploy | the install path: the directory of the executable, defined by the installer assistant |

Under the base directory the layout is identical in dev and prod:

- `config/config.json`
- `data/`
- `logs/`
- `certs/`

Rules:

- There is no `--root` flag, no `APP_HOME`, no marker file, no OS default root, no `.local/` folder and no `dev:config` script.
- `config/config.json` MUST exist. A missing file throws. Nothing creates it.
- A `config.example.json` documents the file. A developer copies it to `<cwd>/config/config.json`. The human said: "bastaria un .example file (sin scripts, solo documentando que ese archivo TIENE que existir y dejar que truene sino)".
- The packaged smoke writes a valid config into its scratch base directory before it starts the binary.

Why:

- Occam: one parameter changes, the rest is equal. Fewer switches means fewer states to test and to explain.
- Professional layouts do the same: a program finds its config, data and logs relative to one base.

Consequence, stated plainly:

- In dev, each app started with its own cwd resolves its own base. `pnpm --filter` changes the cwd to the app folder.
- To share one dev base, start every app from the same cwd.

### Install path and the default copy

[REQ-CFG-05](../../requirements/04-configuration.md) says the install path holds only read-only defaults. Strict config has no defaults. So the shipped `config.default.json` copy path is removed. The install path is now the base directory. The installer assistant creates `config/config.json` there ([OQ24](../../roadmap/PROPOSAL.md#open-questions)). The removal needs a requirement text change. It is a proposed amendment in [Amendments 2026-10-30](../../requirements/amendments-2026-10-30.md#proposed-amendment-req-cfg-05-no-default-config-copy). It waits for the human. The REQ text is not edited here.

The amendment also notes a conflict: REQ-CFG-05 forbids the current working directory as an anchor. This decision uses the cwd as the dev base. That point waits for the human too.

## Options rejected

- A flat object with optional `sqlite` and `pg` blocks and a `superRefine` to check that one is set: it allows an in-between state. The human asked for one or the other, never anything in the middle.
- `.default()` or `.prefault()` on the engine or the block: a missing config would silently get a value. That is the opposite of "truena".
- `z.object` instead of `z.strictObject`: it strips unknown keys without an error.
- `LazyModuleLoader`: the logbook decision is not to use it. A plain async factory with `import()` gave the measured result.
- `import()` of engine files at runtime from disk: Node SEA refuses it unless `useVfs` is on, and `useVfs` excludes `useCodeCache`.
- Auto-create of the config on first start: it hides a missing install step. The installer assistant owns that step.

## Consequences

- A start without a valid config exits with an error. A developer copies `config.example.json` to `<cwd>/config/config.json` once.
- [REQ-CFG-04](../../requirements/04-configuration.md) still holds. Persistence initialization depends on the validated config through async DI.
- [REQ-DB-02](../../requirements/05-persistence.md) still holds. The engine comes from the config singleton.
- [REQ-CFG-05](../../requirements/04-configuration.md) conflicts with the removed default copy until the human decides on the amendment.
- Adding PostgreSQL later means: one union variant, one engine module, one more literal in the `import()` ternary, one migrations folder.
- The schema gate of [ADR-005](ADR-005-live-schema-validation.md) and the migrator of [ADR-004](ADR-004-drizzle-build-time-migrations.md) do not change.

## Not verified

- The zod probe and the lazy-load measurements come from the task logbook, taken on a scratch setup. They were not re-run for this page.
- That the heap and blob numbers hold on other Node versions, on other rspack versions, or on Windows.
- That `process.cwd()` is the same for every app in a dev run: it depends on how pnpm starts each app.
- How the installer assistant defines the install path and creates `config/config.json` there, and with which tool: TBD.
- Any PostgreSQL behavior: no pg engine, driver or config block exists in this work.
