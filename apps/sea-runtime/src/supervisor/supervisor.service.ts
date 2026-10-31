import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import { getAsset, isSea } from 'node:sea';
import { z } from 'zod';

// Asset written by the assembler: the ids of every service that is not the supervisor itself.
const SERVICES_ASSET = 'services.json';

const servicesAssetSchema = z.object({
  services: z.array(z.string().min(1)),
});

@Injectable()
export class SupervisorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SupervisorService');
  private readonly children: ChildProcess[] = [];
  private readonly onSignal = (signal: NodeJS.Signals): void => {
    void this.shutdown(signal);
  };

  onModuleInit(): void {
    if (!isSea()) {
      this.logger.log('not running as a SEA executable; spawning no services');
      return;
    }

    const raw = getAsset(SERVICES_ASSET, 'utf8');
    if (raw === undefined) {
      throw new Error(`SEA asset "${SERVICES_ASSET}" is missing`);
    }
    const { services } = servicesAssetSchema.parse(JSON.parse(raw));

    process.once('SIGINT', this.onSignal);
    process.once('SIGTERM', this.onSignal);

    for (const id of services) {
      const child = spawn(process.execPath, ['--service', id], {
        shell: false,
        stdio: 'inherit',
      });
      this.children.push(child);
      this.logger.log(`spawned service "${id}" as pid ${child.pid}`);
    }
  }

  onModuleDestroy(): void {
    process.off('SIGINT', this.onSignal);
    process.off('SIGTERM', this.onSignal);
  }

  // Kills every child, waits until each has exited, then ends the supervisor.
  private async shutdown(signal: NodeJS.Signals): Promise<void> {
    this.logger.log(
      `received ${signal}; stopping ${this.children.length} service(s)`,
    );
    await Promise.all(
      this.children.map(
        (child) =>
          new Promise<void>((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) {
              resolve();
              return;
            }
            child.once('exit', () => resolve());
            child.kill(signal);
          }),
      ),
    );
    process.exit(0);
  }
}
