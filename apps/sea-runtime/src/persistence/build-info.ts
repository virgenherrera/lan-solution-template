import { z } from 'zod';
import { BUILD_INFO_ASSET, readTextAsset } from './assets.js';

// `name@exactVersion`: the pack step already rejects ranges, this guards a hand-edited asset.
const versionedName = z.string().regex(/^@?[^@\s]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/);

const buildInfoSchema = z.strictObject({
  runtime_version: versionedName,
  gateway_version: versionedName,
  web_version: versionedName,
  vector_lib_version: versionedName,
  drizzle_version: versionedName,
});

export type BuildInfo = z.infer<typeof buildInfoSchema>;

export function readBuildInfo(): BuildInfo {
  return buildInfoSchema.parse(JSON.parse(readTextAsset(BUILD_INFO_ASSET)));
}
