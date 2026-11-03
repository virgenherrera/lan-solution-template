import { createInterface } from 'node:readline';
import { type Readable } from 'node:stream';
import { prefixed } from 'service-registry';

// Re-emits every complete line of a child stream with the service id prefix, on the given supervisor stream.
export function forwardLines(id: string, source: Readable, target: NodeJS.WritableStream): void {
  createInterface({ input: source }).on('line', (line) => target.write(`${prefixed(id, line)}\n`));
}
