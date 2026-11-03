import { z } from 'zod';

// JSON text, then the schema, in one pipeline: a syntax error and the schema issues come out of the same safeParse.
export const jsonText = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((text, ctx): unknown => {
      try {
        return JSON.parse(text);
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: `not valid JSON: ${(error as Error).message}` });
        return z.NEVER;
      }
    })
    .pipe(schema);
