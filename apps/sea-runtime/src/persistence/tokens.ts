// Persistence collaborators enter through these tokens, so each one is built once by its provider and nothing reads config files elsewhere. The config namespaces come from AppConfigModule.
export const APP_PATHS = Symbol('APP_PATHS');
export const DATABASE_ADAPTER = Symbol('DATABASE_ADAPTER');
