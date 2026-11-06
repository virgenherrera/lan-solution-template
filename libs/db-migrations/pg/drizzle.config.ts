import { defineConfig } from 'drizzle-kit';

// Paths resolve from pg/ (the `generate:pg` script runs there).
export default defineConfig({
  dialect: 'postgresql',
  schema: './schema.ts',
  out: './migrations',
});
