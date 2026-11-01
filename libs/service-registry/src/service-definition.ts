import { z } from 'zod';
import { DISPATCHER_CONFIG } from './constants.js';

export const serviceIdSchema = z.string().min(1);

// Contract of one registered service. `entry` is the path of its built bootstrap (dist/main.js).
export const serviceDefinitionSchema = z.object({
  id: serviceIdSchema,
  entry: z.string().min(1),
  dependsOn: z.array(serviceIdSchema).default([]),
  enabled: z.boolean().default(true),
});

export type ServiceDefinition = Readonly<z.infer<typeof serviceDefinitionSchema>>;

// Closed registry: ids are unique and a service may only depend on a registered one.
export const serviceRegistrySchema = z
  .array(serviceDefinitionSchema)
  .superRefine((services, ctx) => {
    const ids = new Set<string>();
    for (const [index, service] of services.entries()) {
      if (ids.has(service.id)) {
        ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `duplicate service id "${service.id}"` });
      }
      ids.add(service.id);
    }
    for (const [index, service] of services.entries()) {
      for (const dependency of service.dependsOn) {
        if (!ids.has(dependency)) {
          ctx.addIssue({ code: 'custom', path: [index, 'dependsOn'], message: `unknown dependency "${dependency}"` });
        }
      }
    }
  });

export type ServiceRegistry = readonly ServiceDefinition[];

// Shape of the services asset written by the assembler.
export const servicesAssetSchema = z.object({
  services: z.array(serviceIdSchema),
});

// Command line arguments that start one service in a child process.
export function serviceArgs(id: string): string[] {
  return [`--${DISPATCHER_CONFIG.serviceFlag}`, serviceIdSchema.parse(id)];
}
