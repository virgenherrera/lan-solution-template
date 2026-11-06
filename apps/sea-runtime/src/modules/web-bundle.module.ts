import { Module } from '@nestjs/common';
import { SidecarModule } from './sidecar.module.js';
import { WebBundleService } from '../services/web-bundle.service.js';

@Module({
  imports: [SidecarModule],
  providers: [WebBundleService],
  exports: [WebBundleService],
})
export class WebBundleModule {}
