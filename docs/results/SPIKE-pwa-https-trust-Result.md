<!-- toon-meta
fmt: TOON
doc: docs/results/SPIKE-pwa-https-trust-Result.md
title: "SPIKE PWA HTTPS trust result"
type: backlog
summary: "Observed results of the phone-trust spike on Chromium, an iOS simulator and an Android emulator; real phones closed as not needed."
ids[0]:
related[5]: docs/backlog/spike-pwa-https-trust.md,docs/results/RESEARCH-pwa-https-trust.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/device-trust-guide.md,docs/results/POC-04-Result.md
status: current
updated: 2026-11-03
-->

# SPIKE PWA HTTPS trust result

Branch: `docs/phone-trust-and-dev-trust`. Plan: [spike plan](../backlog/spike-pwa-https-trust.md). Research: [RESEARCH-pwa-https-trust](RESEARCH-pwa-https-trust.md). The checks ran with a throwaway harness (an HTTPS diagnostic server and drivers for Playwright, `simctl`, Maestro and `adb`). It is not kept in the repository: it is not part of the template.

## Summary

- Question: does the built-in CA of [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md) let a PWA load over HTTPS and register its service worker on iOS Safari and Android Chrome?
- Answer on an iOS simulator and an Android emulator: yes, once the CA is installed. Without it both browsers show a certificate warning and the service worker does not register.
- Chrome on Android honors a user-installed CA. The research had marked this a contradiction.
- Not done (closed 2026-11-03, see Not observed): real phones, Add to Home Screen, installed-PWA behavior and an IP change. See [Not observed](#not-observed).

## Environment

| Layer | Setup |
|---|---|
| P | Playwright with Chromium 156.0.8078.4 on the Mac, LAN IP 192.168.1.124 |
| S | iOS 18.5 simulator `spike-iphone` (iPhone 16 device type), Mobile Safari, Maestro 2.12.1 |
| A | Android 15 emulator, Pixel 6, image `google_apis` arm64, Chrome 124.0.6367.219 |

The diag server of the harness serves the built-in CA identity over HTTPS and a plain HTTP twin. Its page prints `secure=` and `sw=`.

## Observed results

| Check | Layer | Observation |
|---|---|---|
| D1 CA not trusted | P | `net::ERR_CERT_AUTHORITY_INVALID` |
| D1 | S | Safari: "This Connection Is Not Private"; no page |
| D1 | A | Chrome: "Your connection is not private", `NET::ERR_CERT_AUTHORITY_INVALID`; no `sw=registered` |
| D2 CA install | S | `xcrun simctl keychain <udid> add-root-cert ca.crt` exit 0; the CA is listed in Certificate Trust Settings with full trust already on |
| D3 reload after trust | S | No warning; `secure=true`, `sw=registered` (screenshot read) |
| D6 CA install | A | Installed as a user CA through Settings, no screen lock needed; listed under User credentials |
| D7 reload after D6 | A | No warning; `secure=true`, `sw=registered` (screenshot read) |
| D5 plain HTTP on the LAN IP | P, S | `secure=false`; the service worker API is absent (`NoServiceWorkerApi`) |
| D9 `<hostname>.local` | S | Resolves and loads; `sw=registered`. The leaf SAN covered the name |
| D8 installability | P | Page installable: `Page.getInstallabilityErrors` returned no errors, with the leaf hash in `--ignore-certificate-errors-spki-list` |

Also observed:

- Chromium ignores certificate errors for the flag with the leaf public key hash. The flag with the CA hash had no effect. A page that loads under that flag is not evidence of trust.
- The leaf SAN did not cover `10.0.2.2`, the emulator address of the host.

## What changes in the research

| Research item | Before | After |
|---|---|---|
| Android Chrome honors a user-installed CA | contradiction | Observed yes, on Android 15 with Chrome 124, emulator only |
| iOS Home Screen and service worker over plain HTTP | not found | Observed in Safari: no service worker API over HTTP on a LAN IP |
| Untrusted certificate blocks the service worker | one source | Observed on all three layers: the page never loads, so no registration |
| Android install path for a user CA | one source | Observed on Android 15; steps in the [guide](../architecture/device-trust-guide.md#android) |

The provisional recommendation of the research stands: keep the built-in CA and trust it once per phone by hand.

## Decision

Closed with the sources above (decided 2026-11-03 under the human's delegation: a PWA of this template ships a manifest and a service worker, so a real phone adds no new information to the design). The findings are in [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md#phone-trust) and the [device trust guide](../architecture/device-trust-guide.md). The items below are checked at the first real deployment.

## Not observed

- A real iPhone 12 and a real Android phone. On the simulator the CA came out trusted at once; a real iPhone may still require the full-trust switch.
- D4 and D8 on phones: Add to Home Screen, the Chrome install prompt, offline reload and the installed PWA.
- D8 against the packaged gateway PWA (no packaged binary was available to the harness).
- D5 and D9 on Android. The emulator hit a system "isn't responding" dialog before they ran.
- D10, a changed host IP. The `tls.extraNames` reissue by `pnpm dev:certs` is covered by the packaged smoke; a real IP change was not run.
- Clicking through the certificate warning. No layer tested whether that enables the service worker.
- mDNS on a real phone. The simulator shares the Mac network.
- Name constraints, certificate lifetime on Android, and the blast radius of a stolen leaf key (research items that need no device).

## Tool notes

- Maestro cannot read Chrome page text on Android; the evidence there is the screenshot.
- Maestro matches text against a whole element, so a multi-line page needs `(?s).*TEXT.*`.
- A 2 GB emulator wedges after heavy Maestro and `uiautomator` use. A layer run needs a fresh boot and few automated steps.
- The diag server creates a new CA unless given a base directory, so a layer that installs the CA first must reuse the same base.
- State left on the author's machine: the Android emulator keeps the user CA and `ca.crt` in `/sdcard/Download`; the simulator keychain holds three "LAN Solution Local CA" entries. Neither is a repository change.
