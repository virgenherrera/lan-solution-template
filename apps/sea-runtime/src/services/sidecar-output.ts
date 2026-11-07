import { Injectable } from '@nestjs/common';
import { encodeSidecarEvent, type SidecarEvent } from 'service-registry';

// The only writer of stdout. The line is validated by the contract before it is written.
@Injectable()
export class SidecarOutput {
  emit(event: SidecarEvent): void {
    process.stdout.write(encodeSidecarEvent(event));
  }
}
