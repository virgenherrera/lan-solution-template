// The text of the supervisor's own log lines. They go to stderr, never to stdout (see sidecar-protocol.ts).
// The real-binary smoke check reads them back, so the format lives next to the contract.

// One line of output with its source prefix: "[id] text".
export const prefixed = (id: string, text: string): string => `[${id}] ${text}`;

export const spawnedMessage = (id: string, pid: number | undefined): string => `spawned service "${id}" as pid ${pid}`;
export const stateMessage = (state: string): string => `state ${state}`;
