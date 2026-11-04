<!-- toon-meta
fmt: TOON
doc: docs/results/RESEARCH-pwa-https-trust.md
title: "RESEARCH PWA HTTPS trust on a LAN"
type: backlog
summary: "Source-backed research on why a LAN PWA needs HTTPS and how a private CA reaches phones; open gaps go to a spike."
ids[0]:
related[5]: docs/backlog/spike-pwa-https-trust.md,docs/architecture/adr/ADR-008-tls-trust-model.md,docs/architecture/device-trust-guide.md,docs/results/POC-04-Result.md,docs/results/SPIKE-pwa-https-trust-Result.md
status: current
updated: 2026-11-03
-->

# RESEARCH PWA HTTPS trust on a LAN

Branch: `docs/phone-trust-and-dev-trust`. Follow-up of [POC-04-Result](POC-04-Result.md). Next step: [Spike plan](../backlog/spike-pwa-https-trust.md); its observed results are in [SPIKE-pwa-https-trust-Result](SPIKE-pwa-https-trust-Result.md), which resolves several rows of Not verified. No requirement or ADR changes here: the spike decides first.

## Question

The only reason this template serves HTTPS is to deploy mobile LAN apps as a PWA. Which minimum lets a PWA install and run its service worker on an iPhone 12 (Safari) and a recent Android (Chrome), on a closed LAN with no public domain and no MDM, and who should provide the certificate?

## Method

Three collectors read primary sources, three verifiers re-opened every citation and filled gaps, one synthesis stage wrote the recommendation, and a QC reviewer checked every claim against the evidence. The QC failed three overstated claims once. They were corrected and a second QC passed. Access date of all sources: 2026-11-03. A claim with one source, a contradiction or no source is never a premise.

## Verified premises

Each row has two or more primary sources, or one authoritative specification.

| Claim | Source |
|---|---|
| A secure context is HTTPS or a loopback address (`127.0.0.0/8`, `::1`, `localhost`). A LAN IP over plain HTTP is not in that list. | [MDN Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) |
| Only secure contexts may register service workers. | [MDN Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), [W3C Service Workers](https://w3c.github.io/ServiceWorker/) |
| Android Chrome installs a PWA only when it is served over HTTPS. | [web.dev install criteria](https://web.dev/articles/install-criteria), [MDN Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) |
| On iOS, service workers run in Safari and in web apps saved to the Home Screen. | [WebKit: Workers at your service](https://webkit.org/blog/8090/workers-at-your-service/), [WebKit in Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) |
| A public CA must not issue a certificate for an Internal Name or a Reserved IP Address. A `.local` name is link-local. A private CA is the only route on this LAN. | [CA/B Forum BR](https://github.com/cabforum/servercert/blob/main/docs/BR.md), [RFC 6762](https://www.rfc-editor.org/rfc/rfc6762.txt) |
| A manually installed iOS profile is not trusted for SSL until it is enabled in Settings > General > About > Certificate Trust Settings. Automatic full trust needs a device management service. | [Apple Support 102390](https://support.apple.com/en-ca/102390), [Apple certificates payload](https://support.apple.com/guide/deployment/certificates-payload-settings-dep91d2eb26/web) |
| Android apps that target API 24 or higher ignore user-installed CAs unless they opt in. | [Android security config](https://developer.android.com/privacy-and-security/security-config), [Android Developers Blog 2016](https://android-developers.googleblog.com/2016/07/changes-to-trusted-certificate.html) |
| `dotnet dev-certs https --trust` runs `security add-trusted-cert -p basic -p ssl` on macOS and writes to the CurrentUser Root store on Windows. On Linux the result can be partial. | [dotnet-dev-certs](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-dev-certs), [aspnetcore source](https://github.com/dotnet/aspnetcore/tree/main/src/Shared/CertificateGeneration) |
| `mkcert -install` covers the host trust stores. A phone gets the CA by AirDrop, email or an HTTP server. | [mkcert README](https://github.com/FiloSottile/mkcert/blob/master/README.md) |
| The 398-day certificate cap does not apply to certificates issued from user-added or administrator-added roots. | [Apple Support 102028](https://support.apple.com/en-qa/102028), [Chromium certificate lifetimes](https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/certificate_lifetimes.md) |
| The Chrome flag `unsafely-treat-insecure-origin-as-secure` needs a device with root or dev mode on Android and ChromeOS. | [Chromium security](https://chromium.org/Home/chromium-security/deprecating-powerful-features-on-insecure-origins) |
| Name constraints are defined for CA certificates. | [RFC 5280](https://www.rfc-editor.org/rfc/rfc5280.txt) |

## Not verified

| Claim | Status | What is missing |
|---|---|---|
| iOS service workers need HTTPS. | not found | No WebKit page states it. The platform rule above is the only basis. |
| iOS "Add to Home Screen" needs HTTPS. | not found | No source. |
| Clicking through a certificate warning enables the service worker. | not found | No primary source. |
| An untrusted certificate blocks service worker registration. | one source | The W3C text covers a non-secure client only. |
| Android Chrome honors a user-installed CA. | contradiction | A Chromium issue snippet says yes. A user report says no since Android 7. |
| Android 11 or later install path (Security > Encryption and credentials > Install from storage > CA certificate). | one source | A blog post. No Google page. |
| iOS differences between versions for the trust steps. | not found | The Apple pages name none. |
| Android validity cap for certificates from user roots. | not found | No source. |
| iOS Safari resolves `.local` names. | not found | No source. |
| Android browsers resolve `.local` names. | one source | A forum post. |
| `dotnet dev-certs` trust does not reach a phone. | not found | The docs say "on the local machine" and nothing more. |
| Chrome, Apple and Android enforce name constraints. | mixed | Chrome and Apple one source each, Firefox contradicts, Android has none. |
| Android Chrome needs a service worker to install. | contradiction | MDN says no, an old summary says yes. |
| Stolen CA key versus stolen leaf key. | one source | The mkcert README says the root key "gives complete power to intercept secure requests". No source covers the leaf. |
| A changed server IP invalidates a certificate that names the old IP. | one source | RFC 9525 octet match. The consequence is inferred. |

## Provisional recommendation

Provisional until the [spike](../backlog/spike-pwa-https-trust.md) closes the gaps above.

- Keep the built-in CA of [ADR-008](../architecture/adr/ADR-008-tls-trust-model.md). Each phone trusts `ca.crt` once, by hand.
- Keep the leaf at 397 days. The caps do not apply to a user root and no Android cap is known.
- A host trust command in the style of `dotnet dev-certs --trust` reaches only the host browser. It is an optional extra, not the trust model.
- Add `tls.source: generated | provided` only when a requirement asks for a provided certificate.
- Do not recommend the Chrome flag or anything that disables certificate validation.
- Name constraints stay deferred: client support is not verified.

Rejected: a public CA (the BR forbids it), MDM auto-trust (out of scope), `mkcert` and `openssl` (ADR-008).

## Key custody

- A device that trusts the CA accepts every certificate that CA signs, so `ca.key` is the critical file. The current protection is the `0600` file mode ([ADR-008](../architecture/adr/ADR-008-tls-trust-model.md)).
- Embedding a private key in the SEA artifact is not a protection: every installation would share the key and it can be extracted from the binary. Public material, such as a corporate root as a trust anchor, can be embedded.
- A previous conversation about embedding certificates in the SEA is not recorded in the docs or the memory of this project. Not verified.
