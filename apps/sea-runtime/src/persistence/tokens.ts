// Persistence collaborators enter through these tokens, so each one is built once by its provider and nothing reads config files elsewhere.
export const APP_PATHS = Symbol('APP_PATHS');
export const APP_CONFIG = Symbol('APP_CONFIG');
export const DATABASE_ADAPTER = Symbol('DATABASE_ADAPTER');
