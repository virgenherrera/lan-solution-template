import { z } from 'zod';

// Manifest of the generated migrations (S8): the pack step writes it, the migrator verifies it.
export const migrationEntrySchema = z.object({
  id: z.number().int().nonnegative(),
  tag: z.string().min(1),
  file: z.string().min(1),
  // Checksum over the full file text (S8).
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const manifestSchema = z.object({
  generator: z.literal('drizzle-kit@0.31.11'),
  migrations: z.array(migrationEntrySchema),
});

export type MigrationEntry = z.infer<typeof migrationEntrySchema>;
export type Manifest = z.infer<typeof manifestSchema>;
