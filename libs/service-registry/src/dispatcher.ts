import { parseArgs } from 'node:util';
import { z } from 'zod';
import { DISPATCHER_CONFIG } from './constants.js';
import { serviceIdSchema } from './service-definition.js';

export type DispatchTarget =
  | { readonly kind: 'supervisor' }
  | { readonly kind: 'service'; readonly id: string }
  | { readonly kind: 'rejected'; readonly message: string };

// The selector: absent means supervisor; present means exactly one non-empty id.
const selectorSchema = z.tuple([serviceIdSchema]);

// Reads only the service option from argv; any other option is left to the selected service.
// Never reads process.env and grants no privilege: the id only picks which registered bootstrap runs.
export function dispatch(argv: readonly string[], registeredIds: readonly string[]): DispatchTarget {
  const flag = DISPATCHER_CONFIG.serviceFlag;
  const { values } = parseArgs({
    args: [...argv],
    options: { [flag]: { type: 'string', multiple: true } },
    strict: false,
  });
  const selector: readonly unknown[] | undefined = values[flag] as readonly unknown[] | undefined;
  if (selector === undefined) return { kind: 'supervisor' };

  const parsed = selectorSchema.safeParse(selector);
  if (!parsed.success) {
    return { kind: 'rejected', message: `--${flag} needs exactly one non-empty service id; registered: ${registeredIds.join(', ')}` };
  }
  const [id] = parsed.data;
  if (!registeredIds.includes(id)) {
    return { kind: 'rejected', message: `unknown service "${id}"; registered: ${registeredIds.join(', ')}` };
  }
  return { kind: 'service', id };
}
