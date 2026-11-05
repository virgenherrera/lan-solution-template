// Builds the macOS installer `.pkg` with the tools macOS ships: pkgbuild and productbuild. It never installs anything.
// Payload = the install directory ROOT: the host executable and the sidecar sit side by side so the base directory is the directory of the executable (ADR-007).
// config/ , data/ , logs/ , certs/ are created by scripts/postinstall, never shipped: the payload holds no certificate, key or user data. postinstall runs `sea-runtime --generate-certs` as the console user (U4b) and records the CA fingerprint in a root-owned <base>/.installer/ca.sha256, which the trust script requires.
// uninstall.sh sits in the payload root (mode 0755, U5): the human runs `sudo <install>/uninstall.sh`. It keeps data/ and logs/.
// A second component without payload (identifier + `.trust`) holds trust-scripts/postinstall. Its choice is NOT selected by default in the Distribution XML, so the System keychain is touched only when the user ticks it.
// No `.app` is installed: writing config/ and data/ inside a bundle breaks its code seal (odd/spikes/M0-result.md section 5, option c).
// Output: apps/desktop/src-tauri/target/release/lan-solution-desktop-<version>-<triple>.pkg
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const desktop = join(root, 'apps', 'desktop');
const release = join(desktop, 'src-tauri', 'target', 'release');
const resources = join(desktop, 'installer', 'macos');
const DEFAULT_LOCATION = '/usr/local/lan-solution';
const HOST_NAME = 'app';
const SIDECAR_NAME = 'sea-runtime';

// Architecture -> Rust target triple (as compile-sea.ts / verify-platform.ts) and the Distribution `hostArchitectures` value.
const ARCHES: Readonly<Record<string, { triple: string; hostArchitectures: string }>> = {
  arm64: { triple: 'aarch64-apple-darwin', hostArchitectures: 'arm64' },
  x64: { triple: 'x86_64-apple-darwin', hostArchitectures: 'x86_64' },
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const tool = (name: string, args: string[]): void => {
  execFileSync(name, args, { stdio: 'inherit' });
};

export const buildMacosPkg = (): string => {
  const arch = ARCHES[process.arch];
  if (arch === undefined) throw new Error(`installer: no macOS architecture mapping for ${process.arch}`);

  const { version } = readJson<{ version: string }>(join(desktop, 'package.json'));
  const { identifier, productName } = readJson<{ identifier: string; productName: string }>(join(desktop, 'src-tauri', 'tauri.conf.json'));
  const inputs = {
    host: join(release, HOST_NAME),
    sidecar: join(release, SIDECAR_NAME),
    template: join(root, 'libs', 'shared-core', 'config.example.json'),
    postinstall: join(resources, 'scripts', 'postinstall'),
    uninstall: join(resources, 'uninstall.sh'),
    trustPostinstall: join(resources, 'trust-scripts', 'postinstall'),
    distribution: join(resources, 'distribution.xml'),
    welcome: join(resources, 'resources', 'welcome.html'),
    trustNotice: join(resources, 'resources', 'trust.html'),
  };
  for (const [label, path] of Object.entries(inputs)) {
    if (!existsSync(path)) throw new Error(`installer: ${label} is missing: ${path} (run "pnpm exec nx run desktop:package" for the host and sidecar)`);
  }

  const work = mkdtempSync(join(tmpdir(), 'lan-installer-'));
  try {
    const payload = join(work, 'payload');
    mkdirSync(join(payload, 'config'), { recursive: true });
    copyFileSync(inputs.host, join(payload, HOST_NAME));
    copyFileSync(inputs.sidecar, join(payload, SIDECAR_NAME));
    copyFileSync(inputs.template, join(payload, 'config', 'config.example.json'));

    // The script needs the package identifier (receipts) and the product name (autostart LaunchAgent file name).
    writeFileSync(
      join(payload, 'uninstall.sh'),
      readFileSync(inputs.uninstall, 'utf8').replaceAll('@IDENTIFIER@', identifier).replaceAll('@PRODUCT@', productName),
      { mode: 0o755 },
    );
    chmodSync(join(payload, 'uninstall.sh'), 0o755); // the mode above is subject to the umask

    const scripts = join(work, 'scripts');
    mkdirSync(scripts);
    copyFileSync(inputs.postinstall, join(scripts, 'postinstall'));

    const component = `${identifier}.pkg`;
    tool('pkgbuild', [
      '--root', payload,
      '--identifier', identifier,
      '--version', version,
      '--install-location', DEFAULT_LOCATION,
      '--scripts', scripts,
      join(work, component),
    ]);

    const trustIdentifier = `${identifier}.trust`;
    const trustComponent = `${trustIdentifier}.pkg`;
    const trustScripts = join(work, 'trust-scripts');
    mkdirSync(trustScripts);
    // The trust script finds the install location in the receipt of the main package, so it needs that identifier.
    const trustScript = join(trustScripts, 'postinstall');
    writeFileSync(trustScript, readFileSync(inputs.trustPostinstall, 'utf8').replaceAll('@IDENTIFIER@', identifier), { mode: 0o755 });
    tool('pkgbuild', [
      '--nopayload',
      '--identifier', trustIdentifier,
      '--version', version,
      '--scripts', trustScripts,
      join(work, trustComponent),
    ]);

    const distribution = readFileSync(inputs.distribution, 'utf8')
      .replaceAll('@IDENTIFIER@', identifier)
      .replaceAll('@VERSION@', version)
      .replaceAll('@TRUST_IDENTIFIER@', trustIdentifier)
      .replaceAll('@TRUST_COMPONENT@', trustComponent)
      .replaceAll('@COMPONENT@', component)
      .replaceAll('@HOST_ARCH@', arch.hostArchitectures);
    const distributionPath = join(work, 'distribution.xml');
    writeFileSync(distributionPath, distribution);

    const resourcesDir = join(work, 'resources');
    mkdirSync(resourcesDir);
    copyFileSync(inputs.welcome, join(resourcesDir, 'welcome.html'));
    copyFileSync(inputs.trustNotice, join(resourcesDir, 'trust.html'));

    const output = join(release, `lan-solution-desktop-${version}-${arch.triple}.pkg`);
    tool('productbuild', ['--distribution', distributionPath, '--resources', resourcesDir, '--package-path', work, output]);
    console.log(`installer: ${output} (${statSync(output).size} bytes)`);
    return output;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
};
