import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { isSea } from 'node:sea';
import { SUPERVISOR_CONFIG } from 'service-registry';
import { hasWebBundle, loadWebBundle, webBundleMessageSchema, type WebBundleMessage } from './web-bundle.js';

// Reads the web bundle from the executable once and keeps the validated message in memory. Nothing is written to disk.
@Injectable()
export class WebBundleService implements OnModuleInit {
  // Undefined when the build embeds no bundle: the services then start without the --web flag.
  message?: WebBundleMessage;

  private readonly logger = new Logger(SUPERVISOR_CONFIG.id);

  onModuleInit(): void {
    if (!isSea()) return;
    if (!hasWebBundle()) {
      this.logger.log('no web bundle embedded');
      return;
    }
    const files = loadWebBundle();
    this.message = webBundleMessageSchema.parse({ kind: 'web-bundle', files });
    this.logger.log(`web bundle loaded in memory: ${files.length} files`);
  }
}
