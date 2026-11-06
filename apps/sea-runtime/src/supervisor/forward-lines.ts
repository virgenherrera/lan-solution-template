import { Logger } from '@nestjs/common';
import { createInterface } from 'node:readline';
import { type Readable } from 'node:stream';

// Re-emits every complete line of a child stream through the Nest logger under the service id; the logger writes the id prefix.
export function forwardLines(id: string, source: Readable): void {
  const logger = new Logger(id);
  createInterface({ input: source }).on('line', (line) => logger.log(line));
}
