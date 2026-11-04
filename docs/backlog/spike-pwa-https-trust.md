<!-- toon-meta
fmt: TOON
doc: docs/backlog/spike-pwa-https-trust.md
title: "SPIKE PWA HTTPS trust on phones"
type: backlog
summary: "Spike plan: close the open PWA, certificate and phone-trust gaps with Playwright, the iOS Simulator, the Android emulator and two phones."
ids[0]:
related[5]: docs/results/RESEARCH-pwa-https-trust.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/device-trust-guide.md,docs/backlog/poc-4-https-gateway-angular-pwa.md,docs/results/SPIKE-pwa-https-trust-Result.md
status: current
updated: 2026-11-03
-->

# SPIKE PWA HTTPS trust on phones

Branch: `minor/spike-pwa-https-trust` holds the harness and the three layers (`tools/spike/`). Evidence base: [RESEARCH-pwa-https-trust](../results/RESEARCH-pwa-https-trust.md).

## Question

With the gateway of [POC-4](poc-4-https-gateway-angular-pwa.md), what must a phone do so the PWA installs and its service worker works, and does the built-in CA of [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md) meet that on an iPhone 12 and a recent Android Chrome?

## Decision rule

The spike changes no requirement and no ADR while it runs. When every check has a result, the findings go into an ADR-008 amendment and the [device trust guide](../architecture/device-trust-guide.md). A check that contradicts the provisional recommendation reopens it.

## What each layer can prove

| Layer | Engine and trust store | Proves | Cannot prove |
|---|---|---|---|
| P. Playwright, Chromium (Chrome DevTools Protocol) | Blink, host test profile | Service worker registration, installability errors, manifest, offline reload, SAN reissue after an IP change | The trust store of iOS or Android. Playwright WebKit is not iOS Safari |
| S. iOS Simulator (Xcode) | The iOS stack and Safari | The iOS trust path, Add to Home Screen, service worker, `.local` | The iPhone 12 hardware and its exact iOS version |
| A. Android emulator (Android Studio) | Android and Chrome of the chosen image | Whether Chrome honors a user CA, the install flow, the Chrome install prompt | Vendor skins of real phones. mDNS from the emulator network |
| R. Real iPhone 12 and a real Android | The real devices | Everything, final word | Nothing automatic: a person runs these |

The tools are installed on the author's Mac (Simulator, Android Studio, Maestro 2.12.1 from the `mobile-dev-inc/tap` Homebrew tap, installed at the human's explicit request as an exception to the `pnpm`-only rule of AGENTS.md). Maestro is an optional driver for the Settings and install steps in layers S and A; it is not a repository dependency. Playwright comes through `pnpm`. Whether `playwright` becomes a dev dependency or stays a throwaway script is decided at implementation and recorded in the result page.

## Environment found on the author's Mac

Inspected on 2026-11-03. This is the state before the spike starts.

| Tool | State |
|---|---|
| Xcode | Installed. The Simulator has iOS 18.5 and iOS 26.4 runtimes and no simulator device created yet. The device types include the iPhone 15 and iPhone 16 families. No iPhone 12 device is needed: the spike needs the iOS stack, not the hardware. |
| Android SDK | `adb` and the emulator 36.4.9 are installed. No virtual device and no system image exist. The spike needs one image with Google Play (Chrome), downloaded through Android Studio. |
| Maestro | 2.12.1, optional. |
| Playwright | Not installed. It comes through `pnpm` when the spike starts. |

Creating the iOS simulator and the Android virtual device is the first step of layers S and A. It is a local setup, not a repository change.

## Checks

Each check records the device, OS version, browser version and the result. Expected results are the provisional hypotheses of the research, not facts.

| # | Check | Layers | Hypothesis | If different |
|---|---|---|---|---|
| D1 | Open `https://<LAN IP>:<net.httpsPort>` before trusting the CA. Read the service worker registration result. | P, S, A, R | Warning, and registration rejected | It registers: trust is optional for the service worker |
| D2 | iPhone: install `ca.crt` from the transferred file, then enable it in Certificate Trust Settings. | S, R | The CA appears under Certificate Trust Settings | The path differs: fix the iOS steps of the guide |
| D3 | iPhone: reload D1 after D2. | S, R | No warning, service worker registers | Warning stays: the certificate profile of ADR-008 is rejected by iOS |
| D4 | iPhone: Add to Home Screen, open it, go offline, reopen. | S, R | Standalone app, offline shell loads | Fails: the PWA scope or the service worker is wrong, not TLS |
| D5 | iPhone: the same on a plain HTTP page of the LAN. The gateway always redirects, so use another HTTP host. | S, R | The service worker never registers | It registers: the research premise is wrong |
| D6 | Android: install `ca.crt` as a CA certificate and record the exact menu names. | A, R | Listed under user credentials | Refused: Android has no route without MDM |
| D7 | Android: reload D1 in Chrome after D6. | A, R | No warning, service worker registers | Warning stays: Chrome ignores user CAs and the built-in CA cannot serve Android Chrome |
| D8 | Android: Install app from the Chrome menu, open it, go offline. | P (installability), A, R | Installed app, offline shell loads | No prompt: check the manifest fields |
| D9 | Open `https://<hostname>.local:<net.httpsPort>` with the name in the SAN. | S, A, R | Resolves or not, to be recorded | Resolves on both: a stable name in `tls.extraNames` can be the primary URL |
| D10 | Change the host IP, restart the gateway, reload the new IP. | P | New leaf, same CA, no new trust step | Prompt returns: the SAN or the reissue rule regressed |

Playwright details to confirm in the spike: Chromium started with `--ignore-certificate-errors-spki-list` for the CA key hash, the CDP method `Page.getInstallabilityErrors`, and whether a service worker registers under that flag. None of these was checked in this session.

Simulator detail to confirm: `xcrun simctl keychain booted add-root-cert <ca.crt>` as the way to install the CA. Not verified.

Emulator detail to confirm: the host is reachable from the emulator at `10.0.2.2`, so the SAN must cover the address the phone uses. Not verified.

## Order

1. P: D1, D8 (installability) and D10, against the packaged SEA binary. Automatic and repeatable.
2. S: D1 to D5 and D9.
3. A: D1, D6 to D9.
4. R: the same checks on the iPhone 12 and a real Android, only where S or A left a doubt, plus D2, D3, D6 and D7 once as the final word.

## Results

Observed results are in [SPIKE-pwa-https-trust-Result](../results/SPIKE-pwa-https-trust-Result.md). Checks not observed yet are listed there.

## Out of scope

- A host trust command, `tls.source`, name constraints and certificate transfer endpoints. They are decisions after the results.
- Windows and Linux desktop browsers.
- Installing the CA through MDM.
- Native shells of any kind.
