// Thrown by commands and by the commander error hook. Only ToolsCliMain turns it into a process exit.
// The code is an EXIT_CODE value, or the status of a child process a command forwards unchanged.
export class ExitError extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}
