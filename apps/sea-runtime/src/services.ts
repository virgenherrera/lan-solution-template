import { type DeclaredServices } from 'service-registry';

// Every service the supervisor runs. Add an entry to supervise a new one; the name is the last segment of its path.
export const SERVICES: DeclaredServices = [{ path: 'apps/api-gateway', web: true }];
