import { z } from 'zod';
import { serviceIdSchema } from './service-definition.js';

// One entry of the typed service array, in the spirit of an Angular route: add an entry, the runtime supervises a new service.
export const serviceRouteSchema = z.strictObject({
  id: serviceIdSchema,
  // Workspace package that holds the service bootstrap (its dist/main.js). Defaults to the id.
  project: z.string().min(1).optional(),
  dependsOn: z.array(serviceIdSchema).default([]),
  enabled: z.boolean().default(true),
  // The service receives the embedded web bundle over IPC on every start.
  web: z.boolean().default(false),
});

export type ServiceRoute = Readonly<z.infer<typeof serviceRouteSchema>>;

const routesSchema = z.array(serviceRouteSchema).superRefine((routes, ctx) => {
  const ids = new Set<string>();
  for (const [index, route] of routes.entries()) {
    if (ids.has(route.id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `duplicate service id "${route.id}"` });
    ids.add(route.id);
  }
  for (const [index, route] of routes.entries()) {
    for (const dependency of route.dependsOn) {
      if (!ids.has(dependency)) ctx.addIssue({ code: 'custom', path: [index, 'dependsOn'], message: `unknown dependency "${dependency}"` });
    }
  }
});

// What a caller writes. The id is the only place `Id` is inferred from, so a `dependsOn` entry that names no declared id is a compile error.
interface RouteInput<Id extends string> {
  readonly id: Id;
  readonly project?: string;
  readonly dependsOn?: readonly NoInfer<Id>[];
  readonly enabled?: boolean;
  readonly web?: boolean;
}

// The schema repeats the dependency check at run time, for arrays that do not come from literals.
export function defineServices<const Id extends string>(routes: readonly RouteInput<Id>[]): readonly ServiceRoute[] {
  return routesSchema.parse(routes);
}
