import { Service, signal } from '@angular/core';

// PLACEHOLDER: in-memory flag only. No credentials and no real authentication (POC-7).
@Service()
export class Session {
  readonly entered = signal(false);

  enter(): void {
    this.entered.set(true);
  }

  leave(): void {
    this.entered.set(false);
  }
}
