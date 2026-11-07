import { Inject } from '@nestjs/common';
import { AppConfigModule } from './modules/app-config.module.js';
import type { ConfigClass } from './schemas/config-dtos.js';

// `constructor(@InjectConfig(DbConfig) db: DbConfig)`
export const InjectConfig = (cls: ConfigClass): ParameterDecorator => Inject(AppConfigModule.getToken(cls));
