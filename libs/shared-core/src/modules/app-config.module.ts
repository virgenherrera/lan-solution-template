import type { DynamicModule } from '@nestjs/common';
import { ConfigModule, getConfigToken, registerAs } from '@nestjs/config';
import { z } from 'zod';
import { deepFreeze, type ConfigSource } from '../config.js';
import type { ConfigClass } from '../schemas/config-dtos.js';

export type AppConfigModuleOptions = {
  configClasses: [ConfigClass, ...ConfigClass[]];
  // Returns the config object; it is called once and each namespace validates its own part. Unknown root keys are the source's to reject (configFileSource does). No process.env is read.
  source: ConfigSource;
  // Names the config in errors, normally the file path.
  origin: string;
  isGlobal?: boolean;
};

export class AppConfigModule {
  static forRoot(options: AppConfigModuleOptions): DynamicModule {
    if (!options.configClasses?.length) throw new TypeError('AppConfigModule.forRoot requires at least one config class.');
    // One read for all namespaces.
    let raw: Promise<unknown> | undefined;
    const source = (): Promise<unknown> => (raw ??= Promise.resolve().then(options.source));
    const configModule = ConfigModule.forRoot({
      ignoreEnvFile: true,
      ignoreEnvVars: true,
      expandVariables: false,
      cache: false,
      isGlobal: options.isGlobal ?? true,
      load: options.configClasses.map((cls) => this.createFactory(cls, source, options.origin)),
    });
    return {
      module: AppConfigModule,
      imports: [configModule],
      exports: [ConfigModule],
    };
  }

  // The injection token of a namespace class.
  static getToken(cls: ConfigClass): string {
    return getConfigToken(cls.name);
  }

  private static createFactory(cls: ConfigClass, source: () => Promise<unknown>, origin: string) {
    return registerAs(cls.name, async () => {
      const whole = await source();
      // Wrapping in the namespace key makes every issue path start with it (for example db.pg.port).
      const result = z.looseObject({ [cls.namespace]: cls.schema }).safeParse(whole);
      if (!result.success) throw new Error(`config ${origin} is invalid: ${z.prettifyError(result.error)}`);
      return deepFreeze(result.data[cls.namespace]);
    });
  }
}
