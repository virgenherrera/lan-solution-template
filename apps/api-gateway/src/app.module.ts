import { Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { createZodValidationPipe, ZodSerializerInterceptor } from 'nestjs-zod';
import { AppConfigModule, DbConfig, type ConfigSource } from 'shared-core';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { HealthState } from './health-state.js';
import { ServerConfig } from './server-config.js';

@Module({
  controllers: [HealthController],
  providers: [
    HealthState,
    // nestjs-zod injects the reflector by the string 'Reflector'; the SEA bundle is minified, so the class name no longer matches. This alias keeps that token valid.
    { provide: 'Reflector', useExisting: Reflector },
    // Every body, query and param declares a nestjs-zod DTO; one without it is a startup-time error, not a silent pass-through.
    { provide: APP_PIPE, useClass: createZodValidationPipe({ strictSchemaDeclaration: true }) },
    // Responses declared with @ZodSerializerDto are validated and stripped to their schema.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {
  // `source` is the config main.ts already validated (the TLS identity needs it before Nest builds the server); `origin` names it in errors.
  static register(source: ConfigSource, origin: string): DynamicModule {
    return {
      module: AppModule,
      imports: [AppConfigModule.forRoot({ 
        // A new config namespace is registered by adding its class here (and exporting it from shared-core).
        configClasses: [DbConfig, ServerConfig],
        source,
        origin,
      }), DatabaseModule],
    };
  }
}
