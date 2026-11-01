import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { CONTROL_KIND, shutdownMessageSchema, type SupervisorConfig } from 'service-registry';

const isWindows = (): boolean => process.platform === 'win32';

// A POSIX child leads its own process group (pgid = pid), so one signal reaches its descendants. Windows has no groups; the tree is killed by pid (REQ-RUNTIME-06).
export function treeSpawnOptions(): Pick<SpawnOptions, 'detached'> {
  return { detached: !isWindows() };
}

// Kills the child and every descendant. POSIX: SIGKILL to the process group. Windows: `taskkill /pid <pid> /T /F`, NOT VERIFIED (decision D3, REQ-TEST-09).
async function killTree(pid: number, config: SupervisorConfig): Promise<void> {
  if (isWindows()) {
    await new Promise<void>((resolve) => {
      const killer = spawn(config.windowsKillCommand, ['/pid', String(pid), '/T', '/F'], { shell: false, stdio: 'ignore' });
      killer.once('error', () => resolve());
      killer.once('close', () => resolve());
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // ESRCH: the group is already empty.
  }
}

const hasExited = (child: ChildProcess): boolean => child.exitCode !== null || child.signalCode !== null;

// Coordinated stop of one service: shutdown message over IPC, wait gracefulStopMs, then kill the tree. Descendants that outlive a clean exit are killed too.
export async function stopTree(id: string, child: ChildProcess, config: SupervisorConfig, log: (text: string) => void): Promise<void> {
  const { pid } = child;
  if (!hasExited(child)) {
    const exited = new Promise<boolean>((resolve) => child.once('exit', () => resolve(true)));
    if (child.connected) {
      child.send(shutdownMessageSchema.parse({ kind: CONTROL_KIND.shutdown }), () => undefined);
      log(`${CONTROL_KIND.shutdown} sent to service "${id}"`);
    }
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), config.gracefulStopMs);
    });
    const graceful = await Promise.race([exited, timeout]);
    clearTimeout(timer);
    if (graceful) {
      log(`service "${id}" exited ${Date.now() - started} ms after ${CONTROL_KIND.shutdown}`);
    } else {
      log(`service "${id}" did not exit within ${config.gracefulStopMs} ms; killing its process tree`);
      if (pid !== undefined) await killTree(pid, config);
      await exited;
      log(`service "${id}" killed ${Date.now() - started} ms after ${CONTROL_KIND.shutdown}`);
    }
  }
  if (pid !== undefined) await killTree(pid, config);
}
