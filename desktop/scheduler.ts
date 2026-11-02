export type Job = { name: string; everyMs: number; run: (now: Date) => Promise<unknown> | unknown };

/**
 * One timer for all periodic work. Each job runs when its interval has passed, one at a time, and a failing
 * job is reported without stopping the others. After the Mac wakes up, `tick` catches up immediately.
 */
export const createScheduler = (jobs: Job[], onError: (name: string, error: unknown) => void) => {
  const lastRun = new Map<string, number>();
  const busy = new Set<string>();
  let timer: NodeJS.Timeout | null = null;

  const tick = async (now = new Date()) => {
    for (const job of jobs) {
      if (busy.has(job.name) || now.getTime() - (lastRun.get(job.name) ?? -Infinity) < job.everyMs) continue;
      lastRun.set(job.name, now.getTime());
      busy.add(job.name);
      try { await job.run(now); } catch (error) { onError(job.name, error); } finally { busy.delete(job.name); }
    }
  };

  return {
    tick,
    start: (intervalMs: number) => { timer = setInterval(() => { void tick(); }, intervalMs); },
    stop: () => { if (timer) clearInterval(timer); timer = null; },
  };
};
