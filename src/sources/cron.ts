/**
 * Cron Source — emits signals on a schedule.
 *
 * Portable implementation using croner (lightweight, no native deps).
 * Can be swapped with platform-specific implementations.
 */

import { Cron } from "croner";
import type { BaseSignal, Source } from "../types.js";

export interface CronJob {
  /** Unique job identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Cron expression (e.g., "0 8 * * *" = 8am daily) */
  expr: string;
  /** Timezone (e.g., "America/New_York") */
  tz?: string;
  /** Whether job is enabled (default: true) */
  enabled?: boolean;
}

export interface CronSourceOptions<S extends BaseSignal> {
  /** Jobs to schedule */
  jobs: CronJob[];

  /**
   * Factory to create signal when job fires.
   * Receives job info and returns the signal to emit.
   */
  toSignal: (job: CronJob, firedAt: number) => S;

  /** Called when a job fires (for logging/debugging) */
  onFire?: (job: CronJob) => void;

  /** Called on cron parse error */
  onError?: (job: CronJob, error: Error) => void;
}

interface ActiveJob {
  job: CronJob;
  cron: Cron;
}

/**
 * Create a cron source that emits signals on schedule.
 *
 * @example
 * ```typescript
 * const source = createCronSource<MySignals>({
 *   jobs: [
 *     { id: "morning", name: "Morning Check", expr: "0 8 * * *", tz: "America/New_York" },
 *     { id: "evening", name: "Evening Digest", expr: "0 18 * * *", tz: "America/New_York" },
 *   ],
 *   toSignal: (job, firedAt) => ({
 *     type: "cron.fired",
 *     id: crypto.randomUUID(),
 *     ts: firedAt,
 *     payload: { jobId: job.id, jobName: job.name, expr: job.expr, firedAt },
 *   }),
 * });
 *
 * await source.start((signal) => bus.emit(signal));
 * ```
 */
export function createCronSource<S extends BaseSignal>(
  options: CronSourceOptions<S>,
): Source<S> {
  const activeJobs: ActiveJob[] = [];

  return {
    name: "cron",

    async start(emit) {
      for (const job of options.jobs) {
        // Skip disabled jobs
        if (job.enabled === false) {
          continue;
        }

        try {
          const cron = new Cron(job.expr, { timezone: job.tz }, async () => {
            const firedAt = Date.now();
            options.onFire?.(job);

            const signal = options.toSignal(job, firedAt);
            await emit(signal);
          });

          activeJobs.push({ job, cron });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          options.onError?.(job, error);
        }
      }
    },

    async stop() {
      for (const { cron } of activeJobs) {
        cron.stop();
      }
      activeJobs.length = 0;
    },
  };
}

/**
 * Get next run time for a cron expression.
 * Useful for displaying "next run at" in UI.
 */
export function getNextRun(expr: string, tz?: string): Date | null {
  try {
    const cron = new Cron(expr, { timezone: tz });
    const next = cron.nextRun();
    cron.stop();
    return next;
  } catch {
    return null;
  }
}

/**
 * Validate a cron expression.
 */
export function isValidCronExpr(expr: string): boolean {
  try {
    const cron = new Cron(expr);
    cron.stop();
    return true;
  } catch {
    return false;
  }
}
