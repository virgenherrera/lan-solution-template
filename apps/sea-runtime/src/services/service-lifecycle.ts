import { type ChildProcess } from 'node:child_process';
import { EMPTY, Subscription, concatMap, defer, expand, filter, fromEvent, ignoreElements, map, merge, of, take, takeUntil, tap, timer, type Observable } from 'rxjs';
import { SERVICE_STATUS, SUPERVISOR_CONFIG, readyMessageSchema, type ServiceStatus, type SupervisorConfig } from 'service-registry';

export interface LifecycleHooks {
  // Spawns one process of the service and wires its output. Called again on every restart.
  readonly spawn: () => ChildProcess;
  readonly onStatus: (status: ServiceStatus) => void;
  readonly log: (text: string) => void;
}

// What the restart budget remembers between two spawns.
interface RestartPolicy {
  readonly attempt: number;
  readonly restarts: readonly number[];
}

// `delay` is undefined when the budget is exhausted. `policy` is the one to carry into the next spawn.
interface RestartPlan {
  readonly policy: RestartPolicy;
  readonly delay?: number;
}

// Node's 'exit' passes (code, signal) and 'message' passes (message, handle); fromEvent packs both into a tuple.
type ExitArgs = [code: number | null, signal: NodeJS.Signals | null];
type MessageArgs = [message: unknown, handle: unknown];

// min(initial * factor^attempt, max), then spread by +-jitterRatio. The cap applies before the jitter.
function backoffDelay(attempt: number, config: SupervisorConfig, random: () => number): number {
  const base = Math.min(config.backoffInitialMs * config.backoffFactor ** attempt, config.backoffMaxMs);
  return Math.round(base * (1 + config.jitterRatio * (2 * random() - 1)));
}

// A process that ran stableResetMs resets the policy; then only restarts inside the window count against maxRestarts.
function planRestart(policy: RestartPolicy, ranMs: number, now: number, config: SupervisorConfig, random: () => number): RestartPlan {
  const stable = ranMs >= config.stableResetMs;
  const attempt = stable ? 0 : policy.attempt;
  const restarts = (stable ? [] : policy.restarts).filter((time) => now - time < config.restartWindowMs);
  if (restarts.length >= config.maxRestarts) return { policy: { attempt, restarts } };
  return { policy: { attempt: attempt + 1, restarts: [...restarts, now] }, delay: backoffDelay(attempt, config, random) };
}

// Owns one service: spawn, exit handling and the restart budget (REQ-RUNTIME-05).
// The jitter source and the clock default to Math.random and Date.now.
export class ServiceLifecycle {
  status: ServiceStatus = SERVICE_STATUS.starting;
  child?: ChildProcess;
  // Holds the whole run, so stop() cancels the watchdog and any pending restart in one call.
  private readonly lifetime = new Subscription();

  constructor(
    readonly id: string,
    private readonly hooks: LifecycleHooks,
    private readonly config: SupervisorConfig = SUPERVISOR_CONFIG,
    private readonly random: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  start(): void {
    // expand feeds each restart policy back in, so every emission spawns the next child.
    const run$ = of<RestartPolicy>({ attempt: 0, restarts: [] }).pipe(expand((policy) => this.runChild$(policy)));
    this.lifetime.add(run$.subscribe());
  }

  // A requested stop: no further restart, no pending timer.
  stop(): void {
    this.lifetime.unsubscribe();
  }

  private setStatus(status: ServiceStatus): void {
    this.status = status;
    this.hooks.onStatus(status);
  }

  // One child, from spawn to exit. Emits the policy for the next spawn after the backoff, or nothing when the service is failed.
  private runChild$(policy: RestartPolicy): Observable<RestartPolicy> {
    return defer(() => {
      const child = this.hooks.spawn();
      this.child = child;
      const spawnedAt = this.now();
      // Every listener ends with this child, so its late events cannot touch the next one.
      const exit$ = fromEvent(child, 'exit', (...args): ExitArgs => args as ExitArgs).pipe(take(1));
      const ready$ = fromEvent(child, 'message', (...args): MessageArgs => args as MessageArgs).pipe(
        filter(([message]) => readyMessageSchema.safeParse(message).success),
        takeUntil(exit$),
      );

      const markReady$ = ready$.pipe(
        tap(() => this.setStatus(SERVICE_STATUS.ready)),
        ignoreElements(),
      );
      const watchdog$ = timer(this.config.readinessTimeoutMs).pipe(
        takeUntil(merge(ready$, exit$)),
        tap(() => {
          this.hooks.log(`service "${this.id}" not ready within ${this.config.readinessTimeoutMs} ms`);
          // The kill ends in the exit handler, so a startup failure counts against the same budget.
          child.kill('SIGKILL');
        }),
        ignoreElements(),
      );
      const restart$ = exit$.pipe(concatMap(([code, signal]) => this.afterExit$(policy, spawnedAt, code, signal)));

      return merge(markReady$, watchdog$, restart$);
    });
  }

  private afterExit$(policy: RestartPolicy, spawnedAt: number, code: number | null, signal: NodeJS.Signals | null): Observable<RestartPolicy> {
    this.hooks.log(`service "${this.id}" exited (code ${code}, signal ${signal})`);
    const now = this.now();
    const plan = planRestart(policy, now - spawnedAt, now, this.config, this.random);
    const count = plan.policy.restarts.length;
    if (plan.delay === undefined) {
      this.hooks.log(`service "${this.id}" restart budget exhausted: ${count} restarts in ${this.config.restartWindowMs} ms; no further spawn`);
      this.setStatus(SERVICE_STATUS.failed);
      return EMPTY;
    }
    this.hooks.log(`service "${this.id}" restart ${count}/${this.config.maxRestarts} in ${plan.delay} ms`);
    this.setStatus(SERVICE_STATUS.restarting);
    return timer(plan.delay).pipe(map(() => plan.policy));
  }
}
