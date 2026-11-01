import { createInterface } from 'node:readline';
import { type Readable } from 'node:stream';

// One line of output with its source prefix: "[id] text". Keeps stdout line-oriented.
export const prefixed = (id: string, text: string): string => `[${id}] ${text}`;

// Re-emits every complete line of a child stream with the service id prefix, on the given supervisor stream.
export function forwardLines(id: string, source: Readable, target: NodeJS.WritableStream): void {
  createInterface({ input: source }).on('line', (line) => target.write(`${prefixed(id, line)}\n`));
}
