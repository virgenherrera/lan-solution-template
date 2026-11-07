import { getAsset, isSea } from 'node:sea';
import { DISPATCHER_CONFIG, jsonText, serviceEntries, servicesAssetSchema, type ServiceEntry } from 'service-registry';
import { SERVICES } from '../services.js';

// The services asset is the source of truth in a SEA build: it was written from SERVICES at build time.
export function loadServiceRoutes(): readonly ServiceEntry[] {
  if (!isSea()) return serviceEntries(SERVICES);
  const raw = getAsset(DISPATCHER_CONFIG.servicesAsset, 'utf8');
  if (raw === undefined) throw new Error(`SEA asset "${DISPATCHER_CONFIG.servicesAsset}" is missing`);
  return jsonText(servicesAssetSchema).parse(raw).services;
}
