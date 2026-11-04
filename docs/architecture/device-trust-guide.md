<!-- toon-meta
fmt: TOON
doc: docs/architecture/device-trust-guide.md
title: "Device trust guide"
type: architecture
summary: "How an operator makes a device trust the local CA of the gateway on iOS, Android, Windows and macOS."
ids[0]:
related[5]: docs/architecture/adr/ADR-008-tls-trust-model.md,docs/requirements/06-web-gateway-https-pwa.md,docs/results/POC-04-Result.md,docs/standards/README.md,docs/results/SPIKE-pwa-https-trust-Result.md
status: current
updated: 2026-11-03
-->

# Device trust guide

[Overview](overview.md) | [ADR-008](adr/ADR-008-tls-trust-model.md) | [Web gateway requirements](../requirements/06-web-gateway-https-pwa.md) | [POC-4 result](../results/POC-04-Result.md)

This page meets [REQ-TLS-02](../requirements/06-web-gateway-https-pwa.md) and [REQ-TLS-04](../requirements/06-web-gateway-https-pwa.md). It lives under `docs/architecture/` because the metadata `type` list has no guide value ([Metadata block v1](../standards/README.md#metadata-block-v1)).

Status: no step below was run on a device. Each OS section says what the vendor page confirms. Vendor pages were fetched on 2026-11-03.

## Navigation

- [The CA file](#the-ca-file)
- [What trust means](#what-trust-means)
- [iOS and iPadOS](#ios-and-ipados)
- [Android](#android)
- [Windows](#windows)
- [macOS](#macos)
- [After the network changes](#after-the-network-changes)

## The CA file

The gateway creates the CA on its first start. The file is `<base>/certs/ca.crt`. `<base>` is the directory of the executable, or the working directory in a dev run ([ADR-007](adr/ADR-007-persistence-system.md#one-base-directory)).

- Copy only `ca.crt` to the device by a channel you control (USB, file share). No gateway endpoint serves it.
- Never copy or share `ca.key` or `leaf.key`. Whoever holds `ca.key` can issue a certificate that a trusting device accepts.

## What trust means

A device that trusts `ca.crt` accepts every certificate that this CA signs. The gateway leaf is one of them. The CA carries no name restriction in its profile ([ADR-008](adr/ADR-008-tls-trust-model.md#certificate-profile)). A stolen `ca.key` therefore lets an attacker on the network impersonate any site to that device.

- Trust only a CA file that you copied from your own host.
- Remove the CA from a device when the gateway is retired.
- The CA lasts 10 years. The leaf lasts 397 days and the gateway renews it. A trusting device keeps trusting the new leaf.

## iOS and iPadOS

Not verified on a device. Observed on an iOS 18.5 simulator ([spike result](../results/SPIKE-pwa-https-trust-Result.md)): without the CA, Safari shows "This Connection Is Not Private"; after the CA was installed, the HTTPS page loaded with a registered service worker. In the simulator the CA appeared in Certificate Trust Settings with full trust already on. A real iPhone may differ; not verified.

Confirmed by Apple ([Apple Support 102390](https://support.apple.com/en-us/102390)):

1. Install the certificate as a profile. Apple says a profile can arrive by email or from a website. The page gives no install steps; not verified.
2. Open **Settings > General > About > Certificate Trust Settings**.
3. Under **Enable full trust for root certificates**, turn on trust for the certificate.

If the section is missing, no additional certificate is installed. Apple states that trust must be turned on by hand after a profile install.

## Android

Observed on an Android 15 emulator with Chrome 124, not on a phone ([spike result](../results/SPIKE-pwa-https-trust-Result.md)). The vendor pages give no path for a CA used by a browser. The observed path, with the CA file on the device:

1. Open **Settings > Security & privacy > More security & privacy > Encryption & credentials**.
2. Tap **Install a certificate**, then **CA certificate**, then **Install anyway**.
3. Pick the CA file. It is then listed under **User credentials**.
4. Reload the HTTPS page in Chrome: no warning, and the service worker registered.

The emulator asked for no screen lock. Menu names vary by vendor.

Confirmed by Google ([Pixel Help 2844832](https://support.google.com/pixelphone/answer/2844832)) for the Wi-Fi certificate option only:

1. Open **Settings > Security & privacy > More security settings > Encryption & credentials**.
2. Tap **Install a certificate**.
3. Browse to the file and tap it.

Google writes that some steps need Android 14 or later and that the device asks for a screen lock if none is set. The page names the **Wi-Fi certificate** option. It does not say that this stores a CA for HTTPS browsing; not verified.

Confirmed by Android developers ([Network security configuration](https://developer.android.com/privacy-and-security/security-config)): apps that target Android 6.0 (API 23) or lower trust user-added CAs by default. The page states no default for browsers or for apps that target newer levels. Chrome accepted the user-added CA on the emulator. Whether the installed PWA and other Android browsers accept it: not verified.

## Windows

For the machine that runs the gateway, `pnpm dev:trust` runs `certutil -user -addstore Root` on the CA file ([`tools/scripts/trust-ca.ts`](../../tools/scripts/trust-ca.ts), not verified on Windows). The manual route below applies to other Windows machines.

Not verified on a device.

Confirmed by Microsoft ([Trusted Root Certification Authorities store](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/trusted-root-certification-authorities-certificate-store)):

1. Press **Windows key + R**, type `mmc`, press **Enter** and accept the UAC prompt.
2. Choose **File > Add/Remove Snap-in**, select **Certificates**, **Add**, **Computer account**, **Next**, **Local computer**, **Finish**, **OK**.
3. Expand **Certificates (Local Computer) > Trusted Root Certification Authorities** and select **Certificates**.
4. From this store you can import trusted certificates. The page names no import menu entry; not verified.

Microsoft states that the store needs administrator rights and that a change can affect system security.

Command line ([certutil](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil)): `certutil -addstore Root ca.crt`. The page gives the form `certutil [options] -addstore CertificateStoreName InFile` and the options `-user` and `-Enterprise`. The store name `Root` comes from the first page above, which says the store is named *root*. Running the command: not verified.

## macOS

For the machine that runs the gateway, `pnpm dev:trust` adds the CA to the login keychain with `security add-trusted-cert -p basic -p ssl`, the same call `dotnet dev-certs https --trust` makes ([`tools/scripts/trust-ca.ts`](../../tools/scripts/trust-ca.ts)). The dry run and the refusal paths were run; the system trust change itself was not run by the author of the script. The manual route below applies to other Macs.

Not verified on a device.

Confirmed by Apple ([Keychain Access, change trust settings](https://support.apple.com/guide/keychain-access/change-the-trust-settings-of-a-certificate-kyca11871/mac)):

1. Open **Keychain Access** (search it in Spotlight).
2. Select a keychain and double-click the certificate.
3. Next to **Trust**, click **Show**.
4. Choose the trust settings in the pop-up menus.

The page does not say how to add the file to the keychain or which menu value makes a root trusted for TLS; not verified.

## After the network changes

The gateway reissues the leaf when the hostname or an address changes, and logs the reason ([REQ-TLS-04](../requirements/06-web-gateway-https-pwa.md)). The CA stays. A device that trusts the CA needs no action. Add a stable name to `tls.extraNames` in `config/config.json` if clients use one.
