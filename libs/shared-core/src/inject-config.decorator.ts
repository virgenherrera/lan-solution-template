import { Inject } from '@nestjs/common';
import { AppConfigModule } from './app-config.module.js';
import type { ConfigClass } from './config-dtos.js';

// `constructor(@InjectConfig(DbConfig) db: DbConfig)`
export const InjectConfig = (cls: ConfigClass): ParameterDecorator => Inject(AppConfigModule.getToken(cls));
