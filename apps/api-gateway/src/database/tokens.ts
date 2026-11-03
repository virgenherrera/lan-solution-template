// The gateway is its own process (REQ-CFG-06): it builds its own paths and config, never the supervisor's.
export const APP_PATHS = Symbol('APP_PATHS');
export const APP_CONFIG = Symbol('APP_CONFIG');
export const DB_ADAPTER = Symbol('DB_ADAPTER');
