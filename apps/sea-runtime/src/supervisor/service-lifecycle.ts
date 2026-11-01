import { type ChildProcess } from 'node:child_process';
import { SERVICE_STATUS, SUPERVISOR_CONFIG, readyMessageSchema, type ServiceStatus, type SupervisorConfig } from 'service-registry';

export interface LifecycleHooks {
  // Spawns one process of the service and wires its output. Called again on every restart.
  readonly spawn: () => ChildProcess;
  readonly onStatus: (status: ServiceStatus) => void;
  readonly log: (text: string) => void;
}

// Owns one service: spawn, exit handling and the restart budget (REQ-RUNTIME-05).
// Jitter source and clock are injectable so the delays can be driven and measured.
export class ServiceLifecycle {
  status: ServiceStatus = SERVICE_STATUS.starting;
  child?: ChildProcess;
  private spawnedAt = 0;
  private attempt = 0;
  private restartTimes: number[] = [];
  private stopped = false;
  private readyTimer?: NodeJS.Timeout;
  private restartTimer?: NodeJS.Timeout;

  constructor(
    readonly id: string,
    private readonly hooks: LifecycleHooks,
    private readonly config: SupervisorConfig = SUPERVISOR_CONFIG,
    private readonly random: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  start(): void {
    const child = this.hooks.spawn();
    this.child = child;
    this.spawnedAt = this.now();
    child.on('message', (message) => {
      if (this.child === child && readyMessageSchema.safeParse(message).success) this.setStatus(SERVICE_STATUS.ready);
    });
    child.on('exit', (code, signal) => {
      if (this.child === child) this.onExit(code, signal);
    });
    this.readyTimer = setTimeout(() => {
      if (this.status === SERVICE_STATUS.ready) return;
      this.hooks.log(`service "${this.id}" not ready within ${this.config.readinessTimeoutMs} ms`);
      // The kill ends in the exit handler, so a startup failure counts against the same budget.
      child.kill('SIGKILL');
    }, this.config.readinessTimeoutMs);
  }

  // A requested stop: no further restart, no pending timer.
  stop(): void {
    this.stopped = true;
    clearTimeout(this.readyTimer);
    clearTimeout(this.restartTimer);
  }

  private setStatus(status: ServiceStatus): void {
    if (status === SERVICE_STATUS.ready || status === SERVICE_STATUS.failed) clearTimeout(this.readyTimer);
    this.status = status;
    this.hooks.onStatus(status);
  }

  private onExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.stopped) return;
    clearTimeout(this.readyTimer);
    this.hooks.log(`service "${this.id}" exited (code ${code}, signal ${signal})`);
    const now = this.now();
    if (now - this.spawnedAt >= this.config.stableResetMs) {
      this.attempt = 0;
      this.restartTimes = [];
    }
    this.restartTimes = this.restartTimes.filter((time) => now - time < this.config.restartWindowMs);
    if (this.restartTimes.length >= this.config.maxRestarts) {
      this.hooks.log(
        `service "${this.id}" restart budget exhausted: ${this.restartTimes.length} restarts in ${this.config.restartWindowMs} ms; no further spawn`,
      );
      this.setStatus(SERVICE_STATUS.failed);
      return;
    }
    const delay = this.delay();
    this.attempt += 1;
    this.restartTimes.push(now);
    this.hooks.log(`service "${this.id}" restart ${this.restartTimes.length}/${this.config.maxRestarts} in ${delay} ms`);
    this.setStatus(SERVICE_STATUS.restarting);
    this.restartTimer = setTimeout(() => this.start(), delay);
  }

  // min(initial * factor^attempt, max), then spread by +-jitterRatio. The cap applies before the jitter.
  private delay(): number {
    const base = Math.min(this.config.backoffInitialMs * this.config.backoffFactor ** this.attempt, this.config.backoffMaxMs);
    return Math.round(base * (1 + this.config.jitterRatio * (2 * this.random() - 1)));
  }
}
