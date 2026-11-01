import { z } from 'zod';

// Every literal of the dispatcher contract lives here, with its default. Nothing else in the lib or its callers repeats these values.
export const dispatcherConfigSchema = z.object({
  // Command line option that selects one service: `--service <id>`.
  serviceFlag: z.string().min(1).default('service'),
  // Exit code of a rejected selector (unknown, empty, repeated or missing id).
  rejectExitCode: z.number().int().min(1).max(255).default(2),
  // SEA asset that lists the ids of every registered service.
  servicesAsset: z.string().min(1).default('services.json'),
});

export type DispatcherConfig = Readonly<z.infer<typeof dispatcherConfigSchema>>;

export const DISPATCHER_CONFIG: DispatcherConfig = Object.freeze(dispatcherConfigSchema.parse({}));
