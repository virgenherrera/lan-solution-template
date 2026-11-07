import { join } from 'node:path';
import { AppPathsService, CONFIG_FILE, configFileSource } from 'shared-core';
import { ServerConfig } from '../schemas/server-config.js';

// The config of this process, read once. The TLS identity is needed before Nest builds the HTTPS server (`httpsOptions` is read while the app is created, and the config namespaces only exist inside the app),
// so AppBootstrap reads `file()` first and AppConfigModule takes the same memoized, frozen object as its source: one read, one instance.
export class GatewayConfigSource {
  // A plain class with no dependencies, built here because the source is needed when the module is declared; Nest provides its own instance to the injectors.
  static readonly paths = new AppPathsService().paths;

  // Names the config in errors.
  static readonly origin = join(this.paths.configDir, CONFIG_FILE);

  // Nothing is read until the first call.
  static readonly file = configFileSource(this.paths);

  // The persisted blocks plus the `server` block from argv. The file stays strict: a `server` key in it is an unknown root key.
  static readonly read = (): unknown => ({ ...this.file(), server: ServerConfig.fromArgv(process.argv) });
}
