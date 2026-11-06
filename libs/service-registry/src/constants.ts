import { z } from 'zod';
import { EXIT_CODE } from './exit-code.js';

// Every literal of the dispatcher contract lives here, with its default. Nothing else in the lib or its callers repeats these values.
export const dispatcherConfigSchema = z.object({
  // Command line option that selects one service: `--service <id>`.
  serviceFlag: z.string().min(1).default('service'),
  // Command line operation that creates the TLS files of the install and exits: `--generate-certs`.
  certsFlag: z.string().min(1).default('generate-certs'),
  // Exit code of a rejected selector (unknown, empty, repeated or missing id).
  rejectExitCode: z.number().int().min(1).max(255).default(EXIT_CODE.argumentRejected),
  // SEA asset that lists the ids of every registered service.
  servicesAsset: z.string().min(1).default('services.json'),
});

export type DispatcherConfig = Readonly<z.infer<typeof dispatcherConfigSchema>>;

export const DISPATCHER_CONFIG: DispatcherConfig = Object.freeze(dispatcherConfigSchema.parse({}));
