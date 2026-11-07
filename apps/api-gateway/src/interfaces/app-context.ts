import type { INestApplication } from '@nestjs/common';
import type { NetConfig } from 'shared-core';
import type { TlsIdentity } from 'shared-core/tls';
import type { ServerConfig } from '../schemas/server-config.js';

export interface AppContext {
  app: INestApplication;
  netConfig: NetConfig;
  serverConfig: ServerConfig;
  identity: TlsIdentity;
}
