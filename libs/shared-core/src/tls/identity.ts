import { X509Certificate, createPrivateKey } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wantedNames } from './san.js';
import type { WantedNames, WantedNamesInput } from './san.js';
import { createCa, issueLeaf, needsReissue } from './x509.js';
import type { PemPair } from './x509.js';

const CA_COMMON_NAME = 'LAN Solution Local CA';
const LEAF_COMMON_NAME = 'lan-gateway';
const CA_YEARS = 10;
const LEAF_DAYS = 397;
const RENEW_BEFORE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const DIR_MODE = 0o700;
const PRIVATE_MODE = 0o600;
const PUBLIC_MODE = 0o644;

export interface TlsIdentityInput {
  readonly paths: { readonly certDir: string };
  readonly config: { readonly tls: { readonly extraNames: readonly string[] } };
  readonly now: Date;
  readonly log: (message: string) => void;
  readonly hostname: WantedNamesInput['hostname'];
  readonly interfaces: WantedNamesInput['interfaces'];
}

export interface TlsIdentity {
  // PEM of the leaf private key, the leaf certificate and the CA certificate.
  readonly key: string;
  readonly cert: string;
  readonly ca: string;
  readonly reissued: boolean;
  readonly names: WantedNames;
}

interface Files {
  readonly caKey: string;
  readonly caCrt: string;
  readonly leafKey: string;
  readonly leafCrt: string;
}

// Same-directory temp file + rename: a crash never leaves a half-written key or certificate.
function writeAtomic(file: string, data: string, mode: number): void {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, data, { mode });
  renameSync(temp, file);
  // The umask can strip bits at creation: set the mode explicitly.
  chmodSync(file, mode);
}

function parseCertificate(file: string, pem: string, problems: string[]): X509Certificate | undefined {
  try {
    return new X509Certificate(pem);
  } catch {
    problems.push(`${file} is not a valid PEM certificate`);
    return undefined;
  }
}

function checkKey(file: string, pem: string, certificate: X509Certificate | undefined, certFile: string, problems: string[]): void {
  let key;
  try {
    key = createPrivateKey(pem);
  } catch {
    problems.push(`${file} is not a valid PEM private key`);
    return;
  }
  if (certificate !== undefined && !certificate.checkPrivateKey(key)) {
    problems.push(`${file} does not belong to ${certFile}`);
  }
}

// Reads what is on disk and returns every inconsistency, one per line, never repairing anything by itself.
function inspect(files: Files, present: Record<keyof Files, boolean>, now: Date): { problems: string[]; ca?: PemPair; leaf?: PemPair } {
  const problems: string[] = [];
  const pairs: [keyof Files, keyof Files][] = [
    ['caCrt', 'caKey'],
    ['leafCrt', 'leafKey'],
  ];
  for (const [crt, key] of pairs) {
    if (present[crt] && !present[key]) problems.push(`${files[key]} is missing while ${files[crt]} exists`);
    if (!present[crt] && present[key]) problems.push(`${files[crt]} is missing while ${files[key]} exists`);
  }
  if (present.leafCrt && !present.caCrt) problems.push(`${files.leafCrt} exists but its issuer ${files.caCrt} is missing`);
  if (problems.length > 0) return { problems };

  let ca: PemPair | undefined;
  let caCertificate: X509Certificate | undefined;
  if (present.caCrt) {
    ca = { certPem: readFileSync(files.caCrt, 'utf8'), keyPem: readFileSync(files.caKey, 'utf8') };
    caCertificate = parseCertificate(files.caCrt, ca.certPem, problems);
    checkKey(files.caKey, ca.keyPem, caCertificate, files.caCrt, problems);
    if (caCertificate !== undefined) {
      if (!caCertificate.ca) problems.push(`${files.caCrt} is not a CA certificate`);
      const notAfter = new Date(caCertificate.validTo);
      if (now < new Date(caCertificate.validFrom)) {
        problems.push(`${files.caCrt} is not valid yet`);
      } else if (notAfter.getTime() - now.getTime() <= RENEW_BEFORE_DAYS * DAY_MS) {
        // A new CA changes the trust the user already installed, so it is never replaced silently.
        problems.push(
          `${files.caCrt} expired or expires within ${RENEW_BEFORE_DAYS} days (${caCertificate.validTo}): delete ${files.caKey}, ${files.caCrt}, ${files.leafKey} and ${files.leafCrt} to create a new CA, then trust the new ${files.caCrt} again on every device`,
        );
      }
    }
  }

  let leaf: PemPair | undefined;
  if (present.leafCrt) {
    leaf = { certPem: readFileSync(files.leafCrt, 'utf8'), keyPem: readFileSync(files.leafKey, 'utf8') };
    const leafCertificate = parseCertificate(files.leafCrt, leaf.certPem, problems);
    checkKey(files.leafKey, leaf.keyPem, leafCertificate, files.leafCrt, problems);
    if (leafCertificate !== undefined && caCertificate !== undefined && !leafCertificate.verify(caCertificate.publicKey)) {
      problems.push(`${files.leafCrt} was not issued by ${files.caCrt}`);
    }
  }
  return { problems, ...(ca === undefined ? {} : { ca }), ...(leaf === undefined ? {} : { leaf }) };
}

// Creates or reuses the CA and the leaf under certDir (REQ-TLS-01). The leaf is reissued when the wanted names change or it nears expiry (REQ-TLS-04); the CA is never regenerated silently.
export function ensureTlsIdentity(input: TlsIdentityInput): TlsIdentity {
  const { paths, config, now, log } = input;
  const dir = paths.certDir;
  mkdirSync(dir, { recursive: true, mode: DIR_MODE });
  chmodSync(dir, DIR_MODE);

  const files: Files = {
    caKey: join(dir, 'ca.key'),
    caCrt: join(dir, 'ca.crt'),
    leafKey: join(dir, 'leaf.key'),
    leafCrt: join(dir, 'leaf.crt'),
  };
  const present = {
    caKey: existsSync(files.caKey),
    caCrt: existsSync(files.caCrt),
    leafKey: existsSync(files.leafKey),
    leafCrt: existsSync(files.leafCrt),
  };

  const state = inspect(files, present, now);
  if (state.problems.length > 0) {
    throw new Error(`TLS identity in ${dir} is not usable:\n${state.problems.map((problem) => `- ${problem}`).join('\n')}`);
  }

  const names = wantedNames({ hostname: input.hostname, interfaces: input.interfaces, extraNames: config.tls.extraNames });
  const wanted = [...names.dnsNames, ...names.ipAddresses];

  let ca = state.ca;
  if (ca === undefined) {
    ca = createCa({ commonName: CA_COMMON_NAME, years: CA_YEARS, now });
    writeAtomic(files.caKey, ca.keyPem, PRIVATE_MODE);
    writeAtomic(files.caCrt, ca.certPem, PUBLIC_MODE);
    log(`tls: created a new CA at ${files.caCrt} (valid ${CA_YEARS} years): no CA existed`);
  }

  let leaf = state.leaf;
  let reissued = false;
  if (leaf === undefined) {
    log(`tls: no leaf certificate in ${dir}: issuing one for ${wanted.join(', ')}`);
    reissued = true;
  } else {
    const decision = needsReissue(leaf.certPem, wanted, now, RENEW_BEFORE_DAYS);
    if (decision.reissue) {
      log(`tls: leaf certificate does not match the wanted names or validity (${decision.reasons.join('; ')}): reissuing it, the CA is unchanged`);
      reissued = true;
    } else {
      log(`tls: reusing leaf certificate ${files.leafCrt} (names and validity are current)`);
    }
  }
  if (reissued || leaf === undefined) {
    leaf = issueLeaf({
      ca,
      commonName: LEAF_COMMON_NAME,
      dnsNames: names.dnsNames,
      ipAddresses: names.ipAddresses,
      days: LEAF_DAYS,
      now,
    });
    writeAtomic(files.leafKey, leaf.keyPem, PRIVATE_MODE);
    writeAtomic(files.leafCrt, leaf.certPem, PUBLIC_MODE);
  }

  return { key: leaf.keyPem, cert: leaf.certPem, ca: ca.certPem, reissued, names };
}
