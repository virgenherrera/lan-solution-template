import { X509Certificate, createPrivateKey } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { CERTS_COMMAND, RENEW_BEFORE_DAYS, tlsFiles } from './identity.js';
import { wantedNames } from './san.js';
import type { WantedNamesInput } from './san.js';
import { createCa, issueLeaf, needsReissue } from './x509.js';
import type { PemPair } from './x509.js';

const CA_COMMON_NAME = 'LAN Solution Local CA';
const LEAF_COMMON_NAME = 'lan-gateway';
const CA_YEARS = 10;
const LEAF_DAYS = 397;

const DIR_MODE = 0o700;
const PRIVATE_MODE = 0o600;
const PUBLIC_MODE = 0o644;

export interface GenerateTlsInput {
  readonly certDir: string;
  readonly extraNames: readonly string[];
  readonly now: Date;
  readonly hostname: WantedNamesInput['hostname'];
  readonly interfaces: WantedNamesInput['interfaces'];
}

export interface GenerateTlsResult {
  // True when this run created the CA: devices that trust an older CA must trust this one.
  readonly caCreated: boolean;
  readonly caFingerprint256: string;
  readonly leaf: 'kept' | 'issued';
  // Why the leaf was issued, empty when it was kept.
  readonly reasons: readonly string[];
}

// Same-directory temp file + rename: a crash never leaves a half-written key or certificate.
function writeAtomic(file: string, data: string, mode: number): void {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, data, { mode });
  renameSync(temp, file);
  // The umask can strip bits at creation: set the mode explicitly.
  chmodSync(file, mode);
}

function parse(pem: string): X509Certificate | undefined {
  try {
    return new X509Certificate(pem);
  } catch {
    return undefined;
  }
}

function keyBelongs(keyPem: string, certificate: X509Certificate): boolean {
  try {
    return certificate.checkPrivateKey(createPrivateKey(keyPem));
  } catch {
    return false;
  }
}

// An existing CA is never replaced: it must be usable as it is, or the command stops and says why.
function existingCa(caCrt: string, caKey: string, now: Date): { pair: PemPair; certificate: X509Certificate } {
  const pair = { certPem: readFileSync(caCrt, 'utf8'), keyPem: readFileSync(caKey, 'utf8') };
  const certificate = parse(pair.certPem);
  const facts = z
    .strictObject({
      isCertificate: z.literal(true, `${caCrt} is not a valid PEM certificate`),
      isCa: z.literal(true, `${caCrt} is not a CA certificate`),
      started: z.date().max(now, `${caCrt} is not valid yet`),
      notExpired: z.date().min(now, `${caCrt} has expired: delete ${caCrt} and ${caKey} (and the leaf) to create a new CA, then trust the new one on every device`),
      keyMatches: z.literal(true, `${caKey} does not belong to ${caCrt}`),
    })
    .safeParse({
      isCertificate: certificate !== undefined,
      isCa: certificate?.ca ?? true,
      started: certificate === undefined ? now : new Date(certificate.validFrom),
      notExpired: certificate === undefined ? now : new Date(certificate.validTo),
      keyMatches: certificate === undefined ? true : keyBelongs(pair.keyPem, certificate),
    });
  if (!facts.success) throw new Error(`the existing CA is not usable:\n${z.prettifyError(facts.error)}`);
  return { pair, certificate: new X509Certificate(pair.certPem) };
}

// Why the leaf must be issued again, empty when it can stay. A broken leaf is replaced too: only the CA is sacred.
function leafReasons(leafCrt: string, leafKey: string, ca: X509Certificate, wanted: readonly string[], now: Date): string[] {
  if (!existsSync(leafCrt) || !existsSync(leafKey)) return ['leaf certificate or key missing'];
  const pem = readFileSync(leafCrt, 'utf8');
  const certificate = parse(pem);
  if (certificate === undefined) return [`${leafCrt} is not a valid PEM certificate`];
  if (!keyBelongs(readFileSync(leafKey, 'utf8'), certificate)) return [`${leafKey} does not belong to ${leafCrt}`];
  if (!certificate.verify(ca.publicKey)) return [`${leafCrt} was not issued by the CA`];
  return needsReissue(pem, wanted, now, RENEW_BEFORE_DAYS).reasons;
}

// Creates the CA only when neither of its files exists, and reissues only the leaf (REQ-TLS-01, REQ-TLS-04). The gateway never calls this: only `${CERTS_COMMAND}` does.
export function generateTlsIdentity(input: GenerateTlsInput): GenerateTlsResult {
  const { certDir, now } = input;
  const files = tlsFiles(certDir);
  const hasCrt = existsSync(files.caCrt);
  const hasKey = existsSync(files.caKey);
  if (hasCrt !== hasKey) {
    throw new Error(`${hasCrt ? files.caKey : files.caCrt} is missing while ${hasCrt ? files.caCrt : files.caKey} exists: restore it, or delete the other file to create a new CA (devices must then trust the new one)`);
  }

  mkdirSync(certDir, { recursive: true, mode: DIR_MODE });
  chmodSync(certDir, DIR_MODE);

  let caCreated = false;
  let ca: PemPair;
  let caCertificate: X509Certificate;
  if (hasCrt) {
    ({ pair: ca, certificate: caCertificate } = existingCa(files.caCrt, files.caKey, now));
  } else {
    ca = createCa({ commonName: CA_COMMON_NAME, years: CA_YEARS, now });
    writeAtomic(files.caKey, ca.keyPem, PRIVATE_MODE);
    writeAtomic(files.caCrt, ca.certPem, PUBLIC_MODE);
    caCertificate = new X509Certificate(ca.certPem);
    caCreated = true;
  }

  const names = wantedNames({ hostname: input.hostname, interfaces: input.interfaces, extraNames: input.extraNames });
  const reasons = leafReasons(files.leafCrt, files.leafKey, caCertificate, [...names.dnsNames, ...names.ipAddresses], now);
  if (reasons.length > 0) {
    const leaf = issueLeaf({ ca, commonName: LEAF_COMMON_NAME, dnsNames: names.dnsNames, ipAddresses: names.ipAddresses, days: LEAF_DAYS, now });
    writeAtomic(files.leafKey, leaf.keyPem, PRIVATE_MODE);
    writeAtomic(files.leafCrt, leaf.certPem, PUBLIC_MODE);
  }
  return { caCreated, caFingerprint256: caCertificate.fingerprint256, leaf: reasons.length > 0 ? 'issued' : 'kept', reasons };
}
