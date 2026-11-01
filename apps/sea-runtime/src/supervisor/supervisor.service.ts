import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import { getAsset, isSea } from 'node:sea';
import {
  AGGREGATE_STATE,
  CONTROL_KIND,
  DISPATCHER_CONFIG,
  SUPERVISOR_CONFIG,
  aggregateState,
  serviceArgs,
  servicesAssetSchema,
  startupOrder,
  stateMessageSchema,
  type AggregateState,
} from 'service-registry';
import { hasWebBundle, loadWebBundle, type WebFile } from '../web/web-bundle.js';
import { forwardLines, prefixed } from './log-lines.js';
import { ServiceLifecycle } from './service-lifecycle.js';

@Injectable()
export class SupervisorService implements OnModuleInit, OnModuleDestroy {
  private readonly services: ServiceLifecycle[] = [];
  private stopping = false;
  private state?: AggregateState;
  private readonly onSignal = (signal: NodeJS.Signals): void => {
    void this.shutdown(signal, 0);
  };

  // Every supervisor line carries the supervisor id as prefix.
  private log(text: string): void {
    process.stdout.write(`${prefixed(SUPERVISOR_CONFIG.id, text)}\n`);
  }

  onModuleInit(): void {
    if (!isSea()) {
      this.log('not running as a SEA executable; spawning no services');
      return;
    }

    const raw = getAsset(DISPATCHER_CONFIG.servicesAsset, 'utf8');
    if (raw === undefined) {
      throw new Error(`SEA asset "${DISPATCHER_CONFIG.servicesAsset}" is missing`);
    }
    const { services } = servicesAssetSchema.parse(JSON.parse(raw));

    // The web bundle is read from the executable and sent to the api-gateway child over IPC; nothing is written to disk. No web bundle in the build means no --web flag.
    const web = hasWebBundle() ? loadWebBundle() : undefined;
    this.log(web === undefined ? 'no web bundle embedded' : `web bundle loaded in memory: ${web.length} files`);

    process.once('SIGINT', this.onSignal);
    process.once('SIGTERM', this.onSignal);

    // The asset lists ids only, so no dependency is known yet; the order is the registry order.
    const order = startupOrder(services.map((id) => ({ id, dependsOn: [], enabled: true })));
    for (const id of order) {
      const lifecycle = new ServiceLifecycle(id, {
        spawn: () => this.spawnChild(id, id === 'api-gateway' ? web : undefined),
        onStatus: () => this.update(),
        log: (text) => this.log(text),
      });
      this.services.push(lifecycle);
      lifecycle.start();
    }
    this.update();
  }

  // Spawns one process with the IPC control channel. Its output is piped and re-emitted with the id prefix. The web bundle is sent again on every restart, from memory.
  private spawnChild(id: string, web: readonly WebFile[] | undefined): ChildProcess {
    const args = web === undefined ? serviceArgs(id) : [...serviceArgs(id), '--web', 'ipc'];
    const child = spawn(process.execPath, args, {
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      serialization: 'advanced',
    });
    if (child.stdout) forwardLines(id, child.stdout, process.stdout);
    if (child.stderr) forwardLines(id, child.stderr, process.stderr);
    this.log(`spawned service "${id}" as pid ${child.pid}`);
    if (web !== undefined) {
      child.send({ kind: 'web-bundle', files: web }, (error) => {
        if (error) this.log(`web bundle handoff failed: ${error.message}`);
      });
    }
    return child;
  }

  // Recomputes the aggregate state; on a change logs it, prints one JSON line for the desktop shell and forwards it to the children.
  private update(): void {
    const next = aggregateState(this.services.map(({ status }) => status), this.stopping);
    if (next === this.state) return;
    this.state = next;
    const message = stateMessageSchema.parse({ kind: CONTROL_KIND.state, state: next });
    this.log(`state ${next}`);
    // Design for POC-5: one JSON line per change, never prefixed, so the shell can tell it from log lines. Not verified against Tauri.
    process.stdout.write(`${JSON.stringify(message)}\n`);
    for (const { child } of this.services) {
      if (child?.connected) child.send(message, () => undefined);
    }
    if (next === AGGREGATE_STATE.error) void this.shutdown('SIGTERM', SUPERVISOR_CONFIG.errorExitCode);
  }

  onModuleDestroy(): void {
    process.off('SIGINT', this.onSignal);
    process.off('SIGTERM', this.onSignal);
  }

  // Kills every child, waits until each has exited, then ends the supervisor with the given exit code.
  private async shutdown(signal: NodeJS.Signals, exitCode: number): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.log(`received ${signal}; stopping ${this.services.length} service(s)`);
    this.update();
    await Promise.all(
      this.services.map(
        (service) =>
          new Promise<void>((resolve) => {
            service.stop();
            const { child } = service;
            if (child === undefined || child.exitCode !== null || child.signalCode !== null) {
              resolve();
              return;
            }
            child.once('exit', () => resolve());
            child.kill(signal);
          }),
      ),
    );
    process.exit(exitCode);
  }
}
