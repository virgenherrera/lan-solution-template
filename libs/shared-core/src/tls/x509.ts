import {
  X509Certificate,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  type KeyObject,
} from 'node:crypto';
import { isIP, isIPv4 } from 'node:net';
import { z } from 'zod';
import {
  derBitString,
  derBoolean,
  derChildren,
  derContextConstructed,
  derContextPrimitive,
  derOctetString,
  derOid,
  derPositiveInteger,
  derSequence,
  derSet,
  derSmallInteger,
  derTime,
  derUtf8String,
} from './der.js';

const OID_COMMON_NAME = '2.5.4.3';
const OID_ECDSA_SHA256 = '1.2.840.10045.4.3.2';
const OID_SUBJECT_KEY_IDENTIFIER = '2.5.29.14';
const OID_KEY_USAGE = '2.5.29.15';
const OID_SUBJECT_ALT_NAME = '2.5.29.17';
const OID_BASIC_CONSTRAINTS = '2.5.29.19';
const OID_AUTHORITY_KEY_IDENTIFIER = '2.5.29.35';
const OID_EXT_KEY_USAGE = '2.5.29.37';
const OID_SERVER_AUTH = '1.3.6.1.5.5.7.3.1';

// GeneralName context tags inside subjectAltName.
const GENERAL_NAME_DNS = 2;
const GENERAL_NAME_IP = 7;

// X.509 version 3 is encoded as the integer 2.
const X509_VERSION_3 = 2;
const TAG_EXTENSIONS = 3;
const TAG_VERSION = 0;
const TAG_AUTHORITY_KEY_ID = 0;

// keyUsage bit strings: bits count from the most significant bit, trailing zero bits are dropped (DER).
const KEY_USAGE_CERT_SIGN_AND_CRL_SIGN = { byte: 0x06, unusedBits: 1 };
const KEY_USAGE_DIGITAL_SIGNATURE = { byte: 0x80, unusedBits: 7 };

// A serial is 0x01 followed by 15 random bytes: always positive, 128 bits, never a leading-zero edge case.
const SERIAL_RANDOM_BYTES = 15;
// Back-date notBefore so a client with a slightly slow clock still accepts a fresh certificate.
const CLOCK_SKEW_MS = 60_000;
const DAY_MS = 86_400_000;

const hostNamePattern =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i;

const commonNameSchema = z.string().min(1).max(64);
const hostNameSchema = z.string().max(253).regex(hostNamePattern);
const ipAddressSchema = z.custom<string>(
  (value) => typeof value === 'string' && isIP(value) !== 0,
  'Expected an IPv4 or IPv6 address',
);
const nowSchema = z.date();

const pemPairSchema = z.object({
  certPem: z.string().min(1),
  keyPem: z.string().min(1),
});

const createCaSchema = z.object({
  commonName: commonNameSchema,
  years: z.number().int().positive(),
  now: nowSchema,
});

const issueLeafSchema = z.object({
  ca: pemPairSchema,
  commonName: commonNameSchema,
  dnsNames: z.array(hostNameSchema),
  ipAddresses: z.array(ipAddressSchema),
  days: z.number().positive().finite(),
  now: nowSchema,
});

const needsReissueSchema = z.object({
  certPem: z.string().min(1),
  wantedNames: z.array(z.union([hostNameSchema, ipAddressSchema])),
  now: nowSchema,
  renewBeforeDays: z.number().nonnegative().finite(),
});

export interface PemPair {
  readonly certPem: string;
  readonly keyPem: string;
}

export interface CreateCaInput {
  readonly commonName: string;
  readonly years: number;
  readonly now: Date;
}

export interface IssueLeafInput {
  readonly ca: PemPair;
  readonly commonName: string;
  readonly dnsNames: readonly string[];
  readonly ipAddresses: readonly string[];
  readonly days: number;
  readonly now: Date;
}

export interface ReissueDecision {
  readonly reissue: boolean;
  readonly reasons: string[];
}

interface BuildCertificateInput {
  readonly subjectCommonName: string;
  readonly issuerName: Buffer;
  readonly subjectPublicKey: KeyObject;
  readonly signingKey: KeyObject;
  readonly notBefore: Date;
  readonly notAfter: Date;
  readonly extensions: Buffer[];
}

// 64-char base64 lines are the PEM convention (RFC 7468) and what OpenSSL expects.
function derToPem(label: string, der: Buffer): string {
  const lines = der.toString('base64').match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

function commonNameDer(commonName: string): Buffer {
  return derSequence(
    derSet(derSequence(derOid(OID_COMMON_NAME), derUtf8String(commonName))),
  );
}

// extnValue is an OCTET STRING wrapping the extension's own DER; critical is omitted when false (DER default).
function extension(oid: string, critical: boolean, value: Buffer): Buffer {
  return derSequence(
    derOid(oid),
    ...(critical ? [derBoolean(true)] : []),
    derOctetString(value),
  );
}

function keyUsageExtension(usage: { byte: number; unusedBits: number }): Buffer {
  return extension(
    OID_KEY_USAGE,
    true,
    derBitString(Buffer.from([usage.byte]), usage.unusedBits),
  );
}

// RFC 5280 method 1: SHA-1 of the subjectPublicKey bits (not of the whole SPKI), only an identifier, not a security hash.
function keyIdentifier(publicKey: KeyObject): Buffer {
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const algorithmAndKey = derChildren(derChildren(spki)[0]?.value ?? Buffer.alloc(0));
  const bitString = algorithmAndKey[1]?.value ?? Buffer.alloc(0);
  // Drop the leading "unused bits" byte of the BIT STRING.
  return createHash('sha1').update(bitString.subarray(1)).digest();
}

function newSerial(): Buffer {
  return derPositiveInteger(
    Buffer.concat([Buffer.from([1]), randomBytes(SERIAL_RANDOM_BYTES)]),
  );
}

function buildCertificate(input: BuildCertificateInput): Buffer {
  const signatureAlgorithm = derSequence(derOid(OID_ECDSA_SHA256));
  const subjectPublicKeyInfo = input.subjectPublicKey.export({
    type: 'spki',
    format: 'der',
  });
  const toBeSigned = derSequence(
    derContextConstructed(TAG_VERSION, derSmallInteger(X509_VERSION_3)),
    newSerial(),
    signatureAlgorithm,
    input.issuerName,
    derSequence(derTime(input.notBefore), derTime(input.notAfter)),
    commonNameDer(input.subjectCommonName),
    subjectPublicKeyInfo,
    derContextConstructed(TAG_EXTENSIONS, derSequence(...input.extensions)),
  );
  // dsaEncoding 'der' makes Node return the ECDSA signature as the ASN.1 SEQUENCE X.509 expects, not raw r||s.
  const signature = sign('sha256', toBeSigned, {
    key: input.signingKey,
    dsaEncoding: 'der',
  });
  return derSequence(
    toBeSigned,
    signatureAlgorithm,
    derBitString(signature),
  );
}

function generateKeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' });
}

function exportPrivateKeyPem(key: KeyObject): string {
  return key.export({ type: 'pkcs8', format: 'pem' }).toString();
}

// Four bytes for IPv4, sixteen for IPv6, the sizes iPAddress requires in a SAN.
function ipToBytes(address: string): Buffer {
  if (isIPv4(address)) return Buffer.from(address.split('.').map(Number));
  const [head = '', tail] = address.split('::');
  const toGroups = (part: string): number[] => {
    if (part === '') return [];
    return part.split(':').flatMap((group) => {
      if (!group.includes('.')) return [parseInt(group, 16)];
      // An embedded IPv4 tail (::ffff:1.2.3.4) fills the last two 16-bit groups.
      const [a = 0, b = 0, c = 0, d = 0] = group.split('.').map(Number);
      return [a * 256 + b, c * 256 + d];
    });
  };
  const headGroups = toGroups(head);
  const tailGroups = tail === undefined ? [] : toGroups(tail);
  const zeroCount = 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...new Array<number>(zeroCount).fill(0), ...tailGroups];
  const bytes = Buffer.alloc(16);
  groups.forEach((group, index) => bytes.writeUInt16BE(group, index * 2));
  return bytes;
}

function subjectAltNameExtension(
  dnsNames: readonly string[],
  ipAddresses: readonly string[],
): Buffer {
  const entries = [
    ...dnsNames.map((name) => derContextPrimitive(GENERAL_NAME_DNS, Buffer.from(name, 'ascii'))),
    ...ipAddresses.map((address) => derContextPrimitive(GENERAL_NAME_IP, ipToBytes(address))),
  ];
  return extension(OID_SUBJECT_ALT_NAME, false, derSequence(...entries));
}

export function createCa(input: CreateCaInput): PemPair {
  const { commonName, years, now } = createCaSchema.parse(input);
  const { publicKey, privateKey } = generateKeyPair();
  const notAfter = new Date(now);
  notAfter.setUTCFullYear(notAfter.getUTCFullYear() + years);
  const name = commonNameDer(commonName);
  const der = buildCertificate({
    subjectCommonName: commonName,
    issuerName: name,
    subjectPublicKey: publicKey,
    signingKey: privateKey,
    notBefore: new Date(now.getTime() - CLOCK_SKEW_MS),
    notAfter,
    extensions: [
      // pathLenConstraint is left out: the CA only ever signs leaves.
      extension(OID_BASIC_CONSTRAINTS, true, derSequence(derBoolean(true))),
      keyUsageExtension(KEY_USAGE_CERT_SIGN_AND_CRL_SIGN),
      extension(
        OID_SUBJECT_KEY_IDENTIFIER,
        false,
        derOctetString(keyIdentifier(publicKey)),
      ),
    ],
  });
  return {
    certPem: derToPem('CERTIFICATE', der),
    keyPem: exportPrivateKeyPem(privateKey),
  };
}

export function issueLeaf(input: IssueLeafInput): PemPair {
  const parsed = issueLeafSchema.parse(input);
  if (parsed.dnsNames.length + parsed.ipAddresses.length === 0) {
    throw new Error('A leaf certificate needs at least one DNS name or IP address');
  }
  const caCertificate = new X509Certificate(parsed.ca.certPem);
  const caPrivateKey = createPrivateKey(parsed.ca.keyPem);
  const caPublicKey = createPublicKey(caPrivateKey);
  // Reuse the CA subject bytes as the leaf issuer so the names match bit for bit.
  const certificateFields = derChildren(derChildren(caCertificate.raw)[0]?.value ?? Buffer.alloc(0));
  const tbsChildren = derChildren(certificateFields[0]?.value ?? Buffer.alloc(0));
  const subjectIndex = tbsChildren[0]?.tag === 0xa0 ? 5 : 4;
  const issuerName = tbsChildren[subjectIndex]?.raw;
  if (issuerName === undefined) throw new Error('The CA certificate has no subject');

  const { publicKey, privateKey } = generateKeyPair();
  const der = buildCertificate({
    subjectCommonName: parsed.commonName,
    issuerName,
    subjectPublicKey: publicKey,
    signingKey: caPrivateKey,
    notBefore: new Date(parsed.now.getTime() - CLOCK_SKEW_MS),
    notAfter: new Date(parsed.now.getTime() + parsed.days * DAY_MS),
    extensions: [
      extension(OID_BASIC_CONSTRAINTS, true, derSequence()),
      keyUsageExtension(KEY_USAGE_DIGITAL_SIGNATURE),
      extension(OID_EXT_KEY_USAGE, false, derSequence(derOid(OID_SERVER_AUTH))),
      subjectAltNameExtension(
        [...new Set(parsed.dnsNames)],
        [...new Set(parsed.ipAddresses)],
      ),
      extension(
        OID_AUTHORITY_KEY_IDENTIFIER,
        false,
        derSequence(derContextPrimitive(TAG_AUTHORITY_KEY_ID, keyIdentifier(caPublicKey))),
      ),
    ],
  });
  return {
    certPem: derToPem('CERTIFICATE', der),
    keyPem: exportPrivateKeyPem(privateKey),
  };
}

// One comparable key per SAN entry: DNS names are case-insensitive, IPs compare by bytes (so ::1 equals 0:0:0:0:0:0:0:1).
function nameKey(name: string): string {
  return isIP(name) !== 0
    ? `ip:${ipToBytes(name).toString('hex')}`
    : `dns:${name.toLowerCase()}`;
}

// Node prints the SAN as "DNS:a, IP Address:1.2.3.4"; only those two kinds are ever issued here.
function certificateNames(certificate: X509Certificate): string[] {
  return (certificate.subjectAltName ?? '')
    .split(', ')
    .map((entry) => entry.replace(/^(DNS|IP Address):/, ''))
    .filter((entry) => entry !== '');
}

export function needsReissue(
  certPem: string,
  wantedNames: readonly string[],
  now: Date,
  renewBeforeDays: number,
): ReissueDecision {
  const parsed = needsReissueSchema.parse({ certPem, wantedNames, now, renewBeforeDays });
  const certificate = new X509Certificate(parsed.certPem);
  const reasons: string[] = [];

  const present = new Set(certificateNames(certificate).map(nameKey));
  const wanted = new Set(parsed.wantedNames.map(nameKey));
  for (const name of parsed.wantedNames) {
    if (!present.has(nameKey(name))) reasons.push(`missing name: ${name}`);
  }
  for (const name of certificateNames(certificate)) {
    if (!wanted.has(nameKey(name))) reasons.push(`unexpected name: ${name}`);
  }

  const notBefore = new Date(certificate.validFrom);
  const notAfter = new Date(certificate.validTo);
  if (parsed.now < notBefore) {
    reasons.push('not valid yet');
  } else if (parsed.now >= notAfter) {
    reasons.push('expired');
  } else if (notAfter.getTime() - parsed.now.getTime() <= parsed.renewBeforeDays * DAY_MS) {
    reasons.push(`expires within ${parsed.renewBeforeDays} days`);
  }

  return { reissue: reasons.length > 0, reasons };
}
