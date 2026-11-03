import { Module } from '@nestjs/common';
import { SidecarModule } from '../sidecar/sidecar.module.js';
import { WebBundleService } from './web-bundle.service.js';

@Module({
  imports: [SidecarModule],
  providers: [WebBundleService],
  exports: [WebBundleService],
})
export class WebBundleModule {}
