import type { ExitCode } from 'service-registry';

// Thrown by commands and by the commander error hook. Only ToolsCliMain turns it into a process exit.
export class ExitError extends Error {
  constructor(readonly code: ExitCode) {
    super(`exit ${code}`);
  }
}
