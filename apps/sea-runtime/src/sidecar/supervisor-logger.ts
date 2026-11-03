import { Injectable } from '@nestjs/common';
import { SUPERVISOR_CONFIG, prefixed } from 'service-registry';

// Every human line of the supervisor goes to stderr with its id prefix. stdout belongs to the sidecar events (see SidecarOutput).
@Injectable()
export class SupervisorLogger {
  log(text: string): void {
    process.stderr.write(`${prefixed(SUPERVISOR_CONFIG.id, text)}\n`);
  }
}
