import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import { configSchema, type AppConfig } from '../config.js';

// What AppConfigModule needs from a nestjs-zod DTO class: its zod schema, and the key of its part of the config.
export type ConfigClass = { new (): object; readonly isZodDto: true; readonly schema: z.ZodType; readonly namespace: string };

// One DTO per namespace of the persisted config (REQ-CFG-01). Each reuses its part of configSchema, so no schema is declared twice.
// `namespace` is the key of that part inside config.json.
export class NetConfig extends createZodDto(configSchema.shape.net) {
  static readonly namespace = 'net';
}

export class TlsConfig extends createZodDto(configSchema.shape.tls) {
  static readonly namespace = 'tls';
}

// The db part is a union, which a class cannot extend, so its base is typed as a plain object.
type DtoBase = { new (): object; readonly isZodDto: true; readonly schema: z.ZodType };

export const DbConfig = class DbConfig extends (createZodDto(configSchema.shape.db) as unknown as DtoBase) {
  static readonly namespace = 'db';
};
export type DbConfig = AppConfig['db'];
