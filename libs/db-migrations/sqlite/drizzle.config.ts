import { defineConfig } from 'drizzle-kit';

// Paths resolve from sqlite/ (the `generate` script runs there).
export default defineConfig({
  dialect: 'sqlite',
  schema: './schema.ts',
  out: './migrations',
});
