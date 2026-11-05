import { Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
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
    // Every body, query and param declares a nestjs-zod DTO; one without it is a startup-time error, not a silent pass-through.
    { provide: APP_PIPE, useClass: createZodValidationPipe({ strictSchemaDeclaration: true }) },
    // Responses declared with @ZodSerializerDto are validated against their schema. A z.object schema strips extra fields; a z.strictObject schema (as HealthResponseDto) rejects them with a 500.
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
