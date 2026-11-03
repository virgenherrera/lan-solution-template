import { z } from 'zod';
import { ENGINES } from './engines.js';

// Manifest of the generated migrations (S8): the pack step writes it, the migrator verifies it.
export const migrationEntrySchema = z.object({
  id: z.number().int().nonnegative(),
  tag: z.string().min(1),
  file: z.string().min(1),
  // Checksum over the full file text (S8).
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const manifestSchema = z.object({
  // The engine the SQL was generated for; a manifest of an unknown engine fails here, one of another known engine fails in the reader.
  engine: z.enum(ENGINES),
  generator: z.literal('drizzle-kit@0.31.11'),
  migrations: z.array(migrationEntrySchema),
});

export type MigrationEntry = z.infer<typeof migrationEntrySchema>;
export type Manifest = z.infer<typeof manifestSchema>;
