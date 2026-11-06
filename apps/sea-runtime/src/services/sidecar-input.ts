import { Injectable, Logger } from '@nestjs/common';
import { createInterface } from 'node:readline';
import { Observable } from 'rxjs';
import { SUPERVISOR_CONFIG, decodeSidecarCommand, type SidecarCommand } from 'service-registry';
import { z } from 'zod';

// The only reader of stdin: one validated command per line.
@Injectable()
export class SidecarInput {
  private readonly logger = new Logger(SUPERVISOR_CONFIG.id);

  // Completes when stdin ends, which means the host is gone. An invalid line is logged and dropped.
  listen(): Observable<SidecarCommand> {
    return new Observable((subscriber) => {
      const lines = createInterface({ input: process.stdin });
      lines.on('line', (line) => {
        if (line.trim() === '') return;
        const command = decodeSidecarCommand(line);
        if (command.success) subscriber.next(command.data);
        else this.logger.log(`ignored invalid stdin line: ${z.prettifyError(command.error)}`);
      });
      lines.on('close', () => subscriber.complete());
      return () => lines.close();
    });
  }
}
