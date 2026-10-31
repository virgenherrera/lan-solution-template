import { getAsset, getRawAsset } from 'node:sea';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';

// Written by compile-sea at build time: relative path to sha256 hex. Each file is embedded as the SEA asset "web/<path>".
const MANIFEST_ASSET = 'web-manifest.json';
const WEB_PREFIX = 'web/';
const manifestSchema = z.object({ files: z.record(z.string().min(1), z.string().regex(/^[0-9a-f]{64}$/)) });

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

// Extracts the embedded web tree to a versioned cache directory and returns its absolute path.
// The directory name is derived from the manifest, so a new build never reuses an older tree.
export function extractWebTree(): string {
  const raw = getAsset(MANIFEST_ASSET, 'utf8');
  if (raw === undefined) throw new Error(`SEA asset "${MANIFEST_ASSET}" is missing`);
  const { files } = manifestSchema.parse(JSON.parse(raw));
  const dir = join(tmpdir(), 'lan-web-tree', sha256(Buffer.from(raw)).slice(0, 16));
  const marker = join(dir, '.complete');

  if (existsSync(marker)) {
    for (const [rel, want] of Object.entries(files)) {
      if (sha256(readFileSync(join(dir, rel))) !== want) {
        throw new Error(`cached web tree is corrupt: ${rel}; remove ${dir}`);
      }
    }
    return dir;
  }

  // Write into a staging directory, then rename: a half-written tree is never visible under the final name.
  const staging = `${dir}.tmp-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  for (const [rel, want] of Object.entries(files)) {
    const bytes = Buffer.from(getRawAsset(WEB_PREFIX + rel));
    if (sha256(bytes) !== want) throw new Error(`embedded web file hash mismatch: ${rel}`);
    const out = join(staging, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, bytes);
  }
  writeFileSync(join(staging, '.complete'), '');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dirname(dir), { recursive: true });
  renameSync(staging, dir);
  return dir;
}
