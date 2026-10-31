<!-- toon-meta
fmt: TOON
doc: docs/requirements/10-node-sea-distribution.md
title: Node SEA and distribution
type: requirement
summary: Node SEA build rules and per-platform distribution validation requirements.
ids[6]: REQ-SEA-01,REQ-SEA-02,REQ-SEA-03,REQ-SEA-04,REQ-SEA-05,REQ-SEA-06
related[3]: docs/requirements/README.md,docs/requirements/09-desktop-tauri.md,docs/requirements/11-nx-quality-testing.md
status: current
updated: 2026-10-31
-->

# 10. Node SEA and distribution

[Home](../../README.md) | [Requirements](README.md) | [Architecture](../architecture/overview.md) | [Standards](../standards/README.md) | [Roadmap](../roadmap/PROPOSAL.md) | [Traceability](traceability.md) | [Backlog](../backlog/README.md)

[Previous](09-desktop-tauri.md) | [Up](README.md) | [Next](11-nx-quality-testing.md)

## Navigation

- [At a glance](#at-a-glance)
- [10. Node SEA and distribution](#10-node-sea-and-distribution)

## At a glance

[Back to navigation](#navigation)

| Topic | Point |
|---|---|
| Entry | One dispatcher bundles supervisor, gateway and later services |
| Build | `node --build-sea`, not `postject` |
| Flags | `useVfs: false`, `useSnapshot: false`, `useCodeCache: true` on compatible native builds only |
| Assets | SQL migrations and `dist/web-angular`; manifest lists paths and hashes |
| Data | Data, config, logs and certificates stay outside the executable |
| Proof | Build success is not runtime proof; validate each platform |
| Next | [Nx, quality and testing](11-nx-quality-testing.md) |

## 10. Node SEA and distribution

[Back to navigation](#navigation)

**REQ-SEA-01.** `tools/scripts/compile-sea.ts` **MUST** bundle a **single JavaScript dispatcher**. The bundle holds the entrypoints of the `sea-runtime` supervisor and the `api-gateway` gateway. It also holds those of all enabled services registered later. The bundle also holds the JavaScript dependencies of all entrypoints. It runs without external `node_modules`. **Role registration is resolved at build time and in the dispatcher. Extracting `.js` files to launch them is not required.**

**REQ-SEA-02.** Generate the SEA configuration and invoke the native mechanism **`node --build-sea`**. It **MUST NOT** introduce `postject` unless a specific, documented limitation requires it.

**REQ-SEA-03.** SEA baseline: `useVfs: false`, `useSnapshot: false`, `useCodeCache: true` **only for compatible native builds**. In any cross build with an incompatible code cache, it **MUST** be disabled and documented. The release configuration **SHOULD** set `execArgvExtension: "none"` so that `NODE_OPTIONS` cannot alter runtime flags. If an extension is needed for diagnostics, it must be explicit. It must not ship as an insecure default.

**REQ-SEA-04.** SQL migrations and **the compiled output `dist/web-angular`** **MUST** be embedded as SEA assets. Never embed its sources. The embedding uses `node:sea` and a manifest of paths/hashes. The **`sea-runtime` supervisor (not the backend)** **MUST** safely extract the web tree to a versioned physical cache. Do it before it spawns `api-gateway` with `--web-root`. It **MUST NOT** treat `getAsset()` as a path/directory.
  *Human decision 17: the supervisor extracts the tree and passes its path to the gateway. The spike result is in [SPIKE-spa-serving](../results/SPIKE-spa-serving.md).*

**REQ-SEA-05.** Databases, configurations, logs, certificates, extracted native extensions and models **MUST** reside outside the read-only executable. The install path holds only read-only defaults. The defaults contain no secrets. The paths library resolves the root once (see [REQ-CFG-05](04-configuration.md)). The real `config.json` **MUST** reside under that root, with `0700` directories and `0600` secrets. The code uses paths relative to that root (human decision 11). In a SEA the root anchor is the directory of `process.execPath`. The distribution **MUST** work without a connection at runtime.

**REQ-SEA-06.** It **MUST** validate, per platform/architecture, both the standalone SEA binary and the Tauri package that contains it; a successful build **does not equal** a verified runtime. The builder **MUST** preserve `index.html`, hashed chunks, CSS, fonts, manifest, icons and the service worker as separate assets within the SEA manifest, with correct MIME types.
