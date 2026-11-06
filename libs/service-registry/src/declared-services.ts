import { parse } from 'node:path';
import { z } from 'zod';
import { serviceIdSchema } from './dispatcher.js';
import { startupOrder } from './startup-order.js';

// One declared service, in the spirit of an Angular route: add an entry, the runtime supervises a new service.
export const declaredServiceSchema = z.strictObject({
  // Workspace path of the service package. The service name is the last segment.
  path: z.string().min(1),
  dependsOn: z.array(serviceIdSchema).default([]),
  enabled: z.boolean().default(true),
  // Deprecated: the service receives the embedded web bundle over IPC on every start.
  web: z.boolean().default(false),
});

// What a caller writes: z.input keeps the fields that have a default optional.
export type DeclaredService = Readonly<z.input<typeof declaredServiceSchema>>;
export type DeclaredServices = readonly DeclaredService[];

// The service name: the last segment of its path. It is the id the supervisor, the dispatcher and the assembler use.
export function serviceName(path: string): string {
  return parse(path).base;
}

// What the supervisor needs to start one service. Key order is the layout of the services asset.
export const serviceEntrySchema = z.strictObject({
  id: serviceIdSchema,
  dependsOn: z.array(serviceIdSchema).default([]),
  enabled: z.boolean().default(true),
  web: z.boolean().default(false),
});

export type ServiceEntry = Readonly<z.infer<typeof serviceEntrySchema>>;

// Shape of the services asset written by the assembler.
export const servicesAssetSchema = z.object({ services: z.array(serviceEntrySchema) });

function toEntry(service: z.output<typeof declaredServiceSchema>): ServiceEntry {
  return { id: serviceName(service.path), dependsOn: service.dependsOn, enabled: service.enabled, web: service.web };
}

const declaredServicesSchema = z.array(declaredServiceSchema).superRefine((services, ctx) => {
  const ids = new Set<string>();
  for (const [index, service] of services.entries()) {
    const id = serviceName(service.path);
    if (id === '') ctx.addIssue({ code: 'custom', path: [index, 'path'], message: `service path "${service.path}" has no name` });
    if (ids.has(id)) ctx.addIssue({ code: 'custom', path: [index, 'path'], message: `duplicate service id "${id}"` });
    ids.add(id);
  }
  for (const [index, service] of services.entries()) {
    for (const dependency of service.dependsOn) {
      if (!ids.has(dependency)) ctx.addIssue({ code: 'custom', path: [index, 'dependsOn'], message: `unknown dependency "${dependency}"` });
    }
  }
  if (ctx.issues.length > 0) return;
  try {
    startupOrder(services.map(toEntry));
  } catch (error) {
    ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : String(error) });
  }
});

// Validates the declared services (unique names, known dependencies, no cycle) and derives the entries.
export function serviceEntries(declared: DeclaredServices): readonly ServiceEntry[] {
  return declaredServicesSchema.parse(declared).map(toEntry);
}
