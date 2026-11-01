import { z } from 'zod';

// Every literal of the SEA assembler lives here, with its default (REQ-SEA-03). Nothing else repeats these values.
export const assemblerConfigSchema = z.object({
  // Built bootstrap of a service, relative to the project root.
  serviceEntry: z.string().min(1).default('dist/main.js'),
  // SEA baseline flags. Literal types: a different value is a contract change, not a setting.
  mainFormat: z.literal('module').default('module'),
  useVfs: z.literal(false).default(false),
  useSnapshot: z.literal(false).default(false),
  execArgvExtension: z.literal('none').default('none'),
});

export type AssemblerConfig = Readonly<z.infer<typeof assemblerConfigSchema>>;

export const ASSEMBLER_CONFIG: AssemblerConfig = Object.freeze(assemblerConfigSchema.parse({}));

// REQ-SEA-03: the V8 code cache is valid only for the Node binary that produced it, so it is on only for a native build.
// A cross build (target triple differs from the host triple) must disable it.
export function useCodeCache(hostTriple: string, targetTriple: string): boolean {
  return hostTriple === targetTriple;
}
