import { readFileSync } from 'node:fs';
import { jsonText } from 'service-registry';
import { z } from 'zod';

// JSON text, then the schema, in one pipeline: a syntax error and the schema issues come out of the same safeParse.
export function parseJson<S extends z.ZodType>(
  label: string,
  text: string,
  schema: S,
): z.output<S> {
  const parsed = jsonText(schema).safeParse(text);
  if (!parsed.success)
    throw new Error(`${label}: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

export function readJson<S extends z.ZodType>(
  path: string,
  schema: S,
): z.output<S> {
  return parseJson(path, readFileSync(path, 'utf8'), schema);
}
