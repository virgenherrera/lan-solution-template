import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { SidecarModule } from '../sidecar/sidecar.module.js';
import { SupervisorModule } from '../supervisor/supervisor.module.js';
import { WebBundleModule } from '../web/web-bundle.module.js';

@Module({
  imports: [PersistenceModule, WebBundleModule, SidecarModule, SupervisorModule],
})
export class RuntimeModule {}
