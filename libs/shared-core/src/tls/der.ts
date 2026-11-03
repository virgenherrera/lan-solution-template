// Minimal ASN.1 DER encoder (and a tiny reader), only what an X.509 v3 certificate needs.

const TAG_BOOLEAN = 0x01;
const TAG_INTEGER = 0x02;
const TAG_BIT_STRING = 0x03;
const TAG_OCTET_STRING = 0x04;
const TAG_OID = 0x06;
const TAG_UTF8_STRING = 0x0c;
const TAG_UTC_TIME = 0x17;
const TAG_GENERALIZED_TIME = 0x18;
const TAG_SEQUENCE = 0x30;
const TAG_SET = 0x31;
const CLASS_CONTEXT = 0x80;
const FLAG_CONSTRUCTED = 0x20;

// RFC 5280 requires UTCTime for years before 2050 and GeneralizedTime from 2050.
const UTC_TIME_LAST_YEAR = 2049;

export interface DerNode {
  readonly tag: number;
  readonly value: Buffer;
  // The full tag-length-value bytes, handy to copy a field verbatim.
  readonly raw: Buffer;
}

// DER lengths use the shortest form: one byte below 128, else 0x80|count followed by big-endian bytes.
function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) {
    bytes.unshift(rest % 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

export function derTlv(tag: number, ...parts: Buffer[]): Buffer {
  const content = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

// INTEGER is two's complement: strip redundant leading zeros, then add one 0x00 only when the high bit is set so the value stays positive.
export function derPositiveInteger(magnitude: Buffer): Buffer {
  let start = 0;
  while (start < magnitude.length - 1 && magnitude[start] === 0) start += 1;
  const trimmed = magnitude.subarray(start);
  const needsPadding = (trimmed[0] ?? 0) & 0x80;
  return derTlv(TAG_INTEGER, needsPadding ? Buffer.from([0]) : Buffer.alloc(0), trimmed);
}

export function derSmallInteger(value: number): Buffer {
  return derPositiveInteger(Buffer.from([value]));
}

// DER encodes BOOLEAN true as 0xFF (BER allows any non-zero value, DER does not).
export function derBoolean(value: boolean): Buffer {
  return derTlv(TAG_BOOLEAN, Buffer.from([value ? 0xff : 0x00]));
}

// The first two arcs share one byte (40*a + b); every later arc is base-128, high bit set on all but its last byte.
export function derOid(dotted: string): Buffer {
  const arcs = dotted.split('.').map(Number);
  const first = arcs[0] ?? 0;
  const second = arcs[1] ?? 0;
  const bytes: number[] = [first * 40 + second];
  for (const arc of arcs.slice(2)) {
    const groups = [arc & 0x7f];
    for (let rest = Math.floor(arc / 128); rest > 0; rest = Math.floor(rest / 128)) {
      groups.unshift((rest & 0x7f) | 0x80);
    }
    bytes.push(...groups);
  }
  return derTlv(TAG_OID, Buffer.from(bytes));
}

export function derSequence(...parts: Buffer[]): Buffer {
  return derTlv(TAG_SEQUENCE, ...parts);
}

// SET OF has to be sorted in DER; callers here only pass single-element sets, so the order is moot.
export function derSet(...parts: Buffer[]): Buffer {
  return derTlv(TAG_SET, ...parts);
}

export function derUtf8String(text: string): Buffer {
  return derTlv(TAG_UTF8_STRING, Buffer.from(text, 'utf8'));
}

export function derOctetString(content: Buffer): Buffer {
  return derTlv(TAG_OCTET_STRING, content);
}

// The first content byte counts the unused bits of the last byte.
export function derBitString(content: Buffer, unusedBits = 0): Buffer {
  return derTlv(TAG_BIT_STRING, Buffer.from([unusedBits]), content);
}

// Whole seconds only: DER time carries no fraction, and the format switches at 2050.
export function derTime(date: Date): Buffer {
  const iso = date.toISOString();
  const digits = iso.replace(/[-:T]/g, '').slice(0, 14);
  if (date.getUTCFullYear() <= UTC_TIME_LAST_YEAR) {
    return derTlv(TAG_UTC_TIME, Buffer.from(`${digits.slice(2)}Z`, 'ascii'));
  }
  return derTlv(TAG_GENERALIZED_TIME, Buffer.from(`${digits}Z`, 'ascii'));
}

// Explicit context tag, a wrapper around another encoded element, e.g. [0] version.
export function derContextConstructed(tagNumber: number, ...parts: Buffer[]): Buffer {
  return derTlv(CLASS_CONTEXT | FLAG_CONSTRUCTED | tagNumber, ...parts);
}

// Implicit context tag over a primitive value, e.g. a SAN dNSName.
export function derContextPrimitive(tagNumber: number, content: Buffer): Buffer {
  return derTlv(CLASS_CONTEXT | tagNumber, content);
}

// Splits the content of a constructed element into its direct children.
export function derChildren(content: Buffer): DerNode[] {
  const nodes: DerNode[] = [];
  let offset = 0;
  while (offset < content.length) {
    const tag = content[offset] ?? 0;
    const lengthByte = content[offset + 1] ?? 0;
    let length = lengthByte;
    let headerSize = 2;
    if (lengthByte & 0x80) {
      const count = lengthByte & 0x7f;
      length = 0;
      for (let index = 0; index < count; index += 1) {
        length = length * 256 + (content[offset + 2 + index] ?? 0);
      }
      headerSize = 2 + count;
    }
    const end = offset + headerSize + length;
    if (end > content.length) throw new Error('Malformed DER: element overruns its container');
    nodes.push({
      tag,
      value: content.subarray(offset + headerSize, end),
      raw: content.subarray(offset, end),
    });
    offset = end;
  }
  return nodes;
}
