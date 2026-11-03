// Time and randomness enter the supervisor through these tokens, so the restart delays can be driven and measured.
export const CLOCK = Symbol('CLOCK');
export const RANDOM = Symbol('RANDOM');
// The routes the supervisor runs: the services asset in a SEA build, the typed array in dev.
export const SERVICE_ROUTES = Symbol('SERVICE_ROUTES');
