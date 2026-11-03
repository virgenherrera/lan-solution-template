# sea-runtime-nest

Objective: make all of `apps/sea-runtime` real Nest (services, zod, rxjs where they fit) and give Tauri the sidecar contract it expects. Branch: `chore/workspace-cleanup` (PR #15). Delivery: `ask-on-risk`, one PR. Runner: `pnpm` + `nx` (`pnpm build`, `pnpm --filter sea-runtime test:static`, `pnpm exec nx run sea-runtime:package`, `node tools/scripts/smoke-sea.ts`). No unit or integration suites (REQ-TEST-01).

## Specs

- S1. "hacer que todo sea-runtime sea sealmente nest (servicios, zod y rxjs donde toque)"
- S2. "perfomant, LEGIBLE, mantenible y sin codigo que parecen parches (export const STATUS_PATH = '/status'; !?!?!?)"
- S3. "no veo porque esta app deba ser http, en serio" → the supervisor opens no HTTP listener. `StatusServer`, `STATUS_PATH` and `supervisor.statusPort` are removed.
- S4. "el status que sea-runtime debe pasar a tauri DEBE SER lo que tauri espera de su sidecar y este es totalmente independiente del /api/health que entrega el api gateway". Verified Tauri v2 sidecar surface: `CommandEvent::{Stdout, Stderr, Error, Terminated{code, signal}}`, one line per event, `child.write` to stdin. `/api/health` is untouched.
- S5. "no seas taca;o con las validaciones de zod (especialemnte en Stdin y Stdout (todo se debe validar))". Every line the supervisor writes to stdout and every line it reads from stdin passes a zod schema. Other boundaries (assets, config, IPC) validate too.
- S6. "una manera "sencilla" para registrar nuevas apps (eg, microservicios, o asi) (pienso en un arreglo tipado estilo el router de angular)". One typed array declares the services; adding a service means adding one entry.
- S7. "re proponer, arquitectar, documentar, hacer (como lo hacen los ingenieros)". ADR + docs before code.
- S8. "en el mismo pr ira toda la limpieza". Same branch, PR #15.
- S9. (assumption) stdout carries only NDJSON `status` events; every human log line goes to stderr.
- S10. (assumption) stdin carries NDJSON commands, one kind for now: `shutdown`. stdin EOF also shuts down.
- S11. Rxjs for the restart backoff and window, same numbers as REQ-RUNTIME-05 (`SUPERVISOR_CONFIG`).

## Contract names (shared by all tasks)

`libs/service-registry/src`: `sidecar-protocol.ts` exports `sidecarEventSchema`, `sidecarCommandSchema`, `encodeSidecarEvent(event): string`, `decodeSidecarCommand(line): SidecarCommand`. `service-routes.ts` exports `defineServices(routes)`, type `ServiceRoute`. `log-lines.ts` moves here from `apps/sea-runtime`.

## Tasks

- T1 (S3,S4,S5,S7,S9,S10) docs: ADR-006, indicator page, architecture overview, ADR-002, traceability, `docs/meta.toon`. Route: delegated (worktree). Status: pending.
- T2 (S4,S5,S6,S9,S10) contract in `libs/service-registry`. Route: inline. Status: pending.
- T3 (S6) `tools/scripts/compile-sea.ts` reads the typed array; `smoke-sea.ts` follows the new log channels and checks stdout NDJSON. Route: delegated (worktree). Status: pending, after T2.
- T4 (S1,S2,S3,S5,S6) Nest modules, logger, tokens, stdio adapters, shutdown hooks in `apps/sea-runtime`. Route: delegated (worktree). Status: pending, after T2.
- T5 (S11) `service-lifecycle.ts` in rxjs, same public surface. Route: delegated (worktree). Status: pending, after T2.
- T6 integration, leftover deletion, full checks, independent verifier. Route: inline + verifier. Status: pending.

## Log

- L1 (2026-11-03) user: "hacer que todo sea-runtime sea sealmente nest (servicios, zod y rxjs donde toque) / se que puedes y que puedes hacer que sea perfomant, LEGIBLE, mantenible y sin codigo que parecen parches (export const STATUS_PATH = '/status'; !?!?!?)"
- L2 (2026-11-03) user: "no, aqui mismo (tambien es limpieza) … que esspera tauri? … no veo porque esta app deba ser http, en serio, investiga bien a bien … re proponer, arquitectar, documentar, hacer (como lo hacen los ingenieros) … no, en el mismo pr ira toda la limpieza"
- L3 (2026-11-03) user: "el status que sea-runtime debe pasar a tauri DEBE SER lo que tauri espera de su sidecar y este es totalmente independiente del /api/health que entrega el api gateway"
- L4 (2026-11-03) user: "procede; usa gittee si estimas que puedes paralelizar trabajo, no seas taca;o con las validaciones de zod (especialemnte en Stdin y Stdout (todo se debe validar)) / tambien considera una manera "sencilla" para registrar nuevas apps (eg, microservicios, o asi) (pienso en un arreglo tipado estilo el router de angular)"
- L5 evidence: Tauri docs (`v2.tauri.app/develop/sidecar`, docs.rs `tauri-plugin-shell` `CommandEvent`, `TerminatedPayload{code:Option<i32>, signal:Option<i32>}`).
- L6 route declaration: T1, T3, T4, T5 have disjoint edit surfaces and each needs several minutes (parallelism writer trigger). T2 is inline because the others read it.
