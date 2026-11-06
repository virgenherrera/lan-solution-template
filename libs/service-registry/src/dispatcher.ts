import { parseArgs } from 'node:util';
import { z } from 'zod';
import { DISPATCHER_CONFIG } from './schemas/dispatcher-config.js';

export const serviceIdSchema = z.string().min(1);

// Command line arguments that start one service in a child process.
export function serviceArgs(id: string): string[] {
  return [`--${DISPATCHER_CONFIG.serviceFlag}`, serviceIdSchema.parse(id)];
}

export type DispatchTarget =
  | { readonly kind: 'supervisor' }
  | { readonly kind: 'service'; readonly id: string }
  | { readonly kind: 'generate-certs' }
  | { readonly kind: 'rejected'; readonly message: string };

// The selector: absent means supervisor; present means exactly one non-empty id.
const selectorSchema = z.tuple([serviceIdSchema]);

// Reads only the service and generate-certs options from argv; any other option is left to the selected service.
// Never reads process.env and grants no privilege: the id only picks which registered bootstrap runs.
export function dispatch(argv: readonly string[], registeredIds: readonly string[]): DispatchTarget {
  const flag = DISPATCHER_CONFIG.serviceFlag;
  const certsFlag = DISPATCHER_CONFIG.certsFlag;
  const { values } = parseArgs({
    args: [...argv],
    options: { [flag]: { type: 'string', multiple: true }, [certsFlag]: { type: 'boolean' } },
    strict: false,
  });
  const selector: readonly unknown[] | undefined = values[flag] as readonly unknown[] | undefined;
  // The operation is a bare flag: any inline value (`--generate-certs=1`) is refused, never ignored.
  if (values[certsFlag] !== undefined && values[certsFlag] !== true) {
    return { kind: 'rejected', message: `--${certsFlag} takes no value` };
  }
  // The operation never starts a role, so it cannot be mixed with a selector.
  if (values[certsFlag] === true) {
    return selector === undefined
      ? { kind: 'generate-certs' }
      : { kind: 'rejected', message: `--${certsFlag} cannot be combined with --${flag}` };
  }
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
