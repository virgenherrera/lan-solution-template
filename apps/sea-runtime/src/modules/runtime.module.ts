import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence.module.js';
import { SidecarModule } from './sidecar.module.js';
import { SupervisorModule } from './supervisor.module.js';
import { WebBundleModule } from './web-bundle.module.js';

@Module({
  imports: [PersistenceModule, WebBundleModule, SidecarModule, SupervisorModule],
})
export class RuntimeModule {}
