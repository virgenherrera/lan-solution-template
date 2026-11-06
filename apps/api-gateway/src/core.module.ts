import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { createZodValidationPipe, ZodSerializerInterceptor } from 'nestjs-zod';
import { AppConfigModule, DbConfig, NetConfig, TlsConfig } from 'shared-core';
import { GatewayConfigSource } from './config-source.js';
import { DatabaseModule } from './database/database.module.js';
import { ServerConfig } from './server-config.js';

@Module({
  imports: [
    AppConfigModule.forRoot({
      // A new config namespace is registered by adding its class here (and exporting it from shared-core).
      configClasses: [DbConfig, NetConfig, TlsConfig, ServerConfig],
      source: GatewayConfigSource.read,
      origin: GatewayConfigSource.origin,
    }),
    DatabaseModule,
  ],
  providers: [
    // Every body, query and param declares a nestjs-zod DTO; one without it is a startup-time error, not a silent pass-through.
    { provide: APP_PIPE, useClass: createZodValidationPipe({ strictSchemaDeclaration: true }) },
    // Responses declared with @ZodSerializerDto are validated against their schema. A z.object schema strips extra fields; a z.strictObject schema (as HealthResponseDto) rejects them with a 500.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class CoreModule {}
