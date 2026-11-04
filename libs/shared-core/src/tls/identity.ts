import { X509Certificate, createPrivateKey } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { wantedNames } from './san.js';
import type { WantedNames, WantedNamesInput } from './san.js';
import { needsReissue } from './x509.js';

export const RENEW_BEFORE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// The command that creates and renews the files. The gateway itself never writes in certs/.
export const CERTS_COMMAND = 'pnpm dev:certs';

export interface TlsFiles {
  readonly caKey: string;
  readonly caCrt: string;
  readonly leafKey: string;
  readonly leafCrt: string;
}

export function tlsFiles(certDir: string): TlsFiles {
  return {
    caKey: join(certDir, 'ca.key'),
    caCrt: join(certDir, 'ca.crt'),
    leafKey: join(certDir, 'leaf.key'),
    leafCrt: join(certDir, 'leaf.crt'),
  };
}

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
  // The names the leaf certificate really covers (its SAN), not the names wanted today.
  readonly names: WantedNames;
}

function parseCertificate(pem: string | undefined): X509Certificate | undefined {
  if (pem === undefined) return undefined;
  try {
    return new X509Certificate(pem);
  } catch {
    return undefined;
  }
}

function keyMatches(pem: string | undefined, certificate: X509Certificate | undefined): boolean | undefined {
  if (pem === undefined || certificate === undefined) return undefined;
  try {
    return certificate.checkPrivateKey(createPrivateKey(pem));
  } catch {
    return false;
  }
}

function readIfPresent(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

// A fact whose input is unreadable gets a neutral value: the unreadable input is reported once, by its own fact, and nothing else piles up on it.
const neutral = (fact: boolean | undefined): boolean => fact ?? true;

function factsSchema(files: TlsFiles, now: Date) {
  return z.strictObject({
    caCrtPresent: z.literal(true, `${files.caCrt} is missing`),
    leafCrtPresent: z.literal(true, `${files.leafCrt} is missing`),
    leafKeyPresent: z.literal(true, `${files.leafKey} is missing`),
    caIsCertificate: z.literal(true, `${files.caCrt} is not a valid PEM certificate`),
    caIsCa: z.literal(true, `${files.caCrt} is not a CA certificate`),
    caStarted: z.date().max(now, `${files.caCrt} is not valid yet`),
    caNotExpired: z.date().min(now, `${files.caCrt} has expired: delete the certs/ folder and run ${CERTS_COMMAND} to create a new CA, then trust it again on every device`),
    leafIsCertificate: z.literal(true, `${files.leafCrt} is not a valid PEM certificate`),
    leafKeyIsKey: z.literal(true, `${files.leafKey} is not a valid PEM private key`),
    leafKeyMatchesCert: z.literal(true, `${files.leafKey} does not belong to ${files.leafCrt}`),
    leafSignedByCa: z.literal(true, `${files.leafCrt} was not issued by ${files.caCrt}`),
    leafStarted: z.date().max(now, `${files.leafCrt} is not valid yet`),
    leafNotExpired: z.date().min(now, `${files.leafCrt} has expired`),
  });
}

// Node prints the SAN as "DNS:a, IP Address:1.2.3.4". IPv6 comes expanded, so it is rewritten in the compact form the Host header carries.
function sanNames(certificate: X509Certificate): WantedNames {
  const dnsNames: string[] = [];
  const ipAddresses: string[] = [];
  for (const entry of (certificate.subjectAltName ?? '').split(', ')) {
    if (entry.startsWith('DNS:')) dnsNames.push(entry.slice('DNS:'.length).toLowerCase());
    else if (entry.startsWith('IP Address:')) {
      const address = entry.slice('IP Address:'.length);
      ipAddresses.push(address.includes(':') ? new URL(`http://[${address}]`).hostname.slice(1, -1) : address);
    }
  }
  return { dnsNames: dnsNames.sort(), ipAddresses: ipAddresses.sort() };
}

// Reads <certDir>/{ca.crt, leaf.crt, leaf.key} and validates them (REQ-TLS-01). It never creates, renews or deletes a file and never reads ca.key: `pnpm dev:certs` owns the files.
// A problem with the files throws one error that lists every problem. A leaf that does not cover the current host names, or is close to expiry, is only logged (REQ-TLS-04).
export function loadTlsIdentity(input: TlsIdentityInput): TlsIdentity {
  const { paths, config, now, log } = input;
  const files = tlsFiles(paths.certDir);
  const caPem = readIfPresent(files.caCrt);
  const leafPem = readIfPresent(files.leafCrt);
  const leafKeyPem = readIfPresent(files.leafKey);

  const caCertificate = parseCertificate(caPem);
  const leafCertificate = parseCertificate(leafPem);
  const leafKeyObject = (() => {
    if (leafKeyPem === undefined) return undefined;
    try {
      return createPrivateKey(leafKeyPem);
    } catch {
      return null;
    }
  })();
  const never = new Date(now);
  const startOf = (certificate: X509Certificate | undefined): Date => (certificate === undefined ? never : new Date(certificate.validFrom));
  const endOf = (certificate: X509Certificate | undefined): Date => (certificate === undefined ? never : new Date(certificate.validTo));

  const facts = factsSchema(files, now).safeParse({
    caCrtPresent: caPem !== undefined,
    leafCrtPresent: leafPem !== undefined,
    leafKeyPresent: leafKeyPem !== undefined,
    caIsCertificate: caPem === undefined ? true : caCertificate !== undefined,
    caIsCa: caCertificate === undefined ? true : caCertificate.ca,
    caStarted: startOf(caCertificate),
    caNotExpired: endOf(caCertificate),
    leafIsCertificate: leafPem === undefined ? true : leafCertificate !== undefined,
    leafKeyIsKey: leafKeyPem === undefined ? true : leafKeyObject !== null,
    leafKeyMatchesCert: neutral(keyMatches(leafKeyPem, leafCertificate)),
    leafSignedByCa: caCertificate === undefined || leafCertificate === undefined ? true : leafCertificate.verify(caCertificate.publicKey),
    leafStarted: startOf(leafCertificate),
    leafNotExpired: endOf(leafCertificate),
  });
  if (!facts.success) {
    throw new Error(
      `TLS files in ${paths.certDir} are missing or invalid:\n${z.prettifyError(facts.error)}\ncreate or renew them with: ${CERTS_COMMAND} (the installer creates them in a packaged install)`,
    );
  }
  if (caPem === undefined || leafPem === undefined || leafKeyPem === undefined || leafCertificate === undefined) {
    throw new Error('TLS files could not be read');
  }

  const names = sanNames(leafCertificate);
  const wanted = wantedNames({ hostname: input.hostname, interfaces: input.interfaces, extraNames: config.tls.extraNames });
  const decision = needsReissue(leafPem, [...wanted.dnsNames, ...wanted.ipAddresses], now, RENEW_BEFORE_DAYS);
  if (decision.reissue) {
    log(`tls: leaf certificate ${files.leafCrt} does not match the current host names or is close to expiry (${decision.reasons.join('; ')}): the gateway keeps using it, run ${CERTS_COMMAND} to renew it`);
  } else {
    log(`tls: using leaf certificate ${files.leafCrt} (names and validity are current, ${Math.floor((new Date(leafCertificate.validTo).getTime() - now.getTime()) / DAY_MS)} days left)`);
  }
  return { key: leafKeyPem, cert: leafPem, ca: caPem, names };
}
