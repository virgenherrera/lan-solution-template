import { Inject, type DynamicModule } from '@nestjs/common';
import { ConfigModule, getConfigToken, registerAs } from '@nestjs/config';
import { z } from 'zod';
import type { ConfigSource } from './config.js';
import type { ConfigClass } from './config-dtos.js';

// Injectable raw source, for providers that need the whole object (the namespaces are the normal way in).
export const CONFIG_SOURCE = Symbol('CONFIG_SOURCE');

export type AppConfigModuleOptions = {
  configClasses: [ConfigClass, ...ConfigClass[]];
  // Returns the raw config object; it is called once and validated per namespace. No process.env is read.
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
      providers: [{ provide: CONFIG_SOURCE, useFactory: source }],
      exports: [ConfigModule, CONFIG_SOURCE],
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

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// `constructor(@InjectConfig(DbConfig) db: DbConfig)`
export const InjectConfig = (cls: ConfigClass): ParameterDecorator => Inject(AppConfigModule.getToken(cls));
