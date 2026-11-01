import { getAsset, getRawAsset } from 'node:sea';
import { createHash } from 'node:crypto';
import { z } from 'zod';

// Written by compile-sea at build time: relative path to sha256 hex. Each file is embedded as the SEA asset "web/<path>".
const WEB_MANIFEST_ASSET = 'web-manifest.json';
const WEB_PREFIX = 'web/';
const manifestSchema = z.object({ files: z.record(z.string().min(1), z.string().regex(/^[0-9a-f]{64}$/)) });

export interface WebFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

// True when the build embedded a web bundle.
export const hasWebBundle = (): boolean => getAsset(WEB_MANIFEST_ASSET, 'utf8') !== undefined;

// Loads every embedded web file and checks each sha256 once against the manifest. Writes nothing to disk.
export function loadWebBundle(): WebFile[] {
  const raw = getAsset(WEB_MANIFEST_ASSET, 'utf8');
  if (raw === undefined) throw new Error(`SEA asset "${WEB_MANIFEST_ASSET}" is missing`);
  const { files } = manifestSchema.parse(JSON.parse(raw));
  return Object.entries(files).map(([path, want]) => {
    const bytes = new Uint8Array(getRawAsset(WEB_PREFIX + path));
    if (createHash('sha256').update(bytes).digest('hex') !== want) {
      throw new Error(`embedded web file hash mismatch: ${path}`);
    }
    return { path, bytes };
  });
}
