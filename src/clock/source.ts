import type { BaseSignal, Source } from "../types.js";
import type { Clock, Tick } from "./types.js";

/** Options for creating a ClockSource adapter. */
export interface ClockSourceOptions<S extends BaseSignal> {
  /** The clock to adapt. */
  clock: Clock;
  /** Convert a tick into a signal. Same pattern as cron/file-watcher sources. */
  toSignal: (tick: Tick) => S;
  /** Source name for debugging. Default: "clock". */
  name?: string;
}

/**
 * Adapt any Clock into a Source<S>.
 *
 * Follows the same `toSignal` pattern from cron and file-watcher sources.
 * The clock's tick handler emits signals via the provided emit function.
 */
export function createClockSource<S extends BaseSignal>(
  options: ClockSourceOptions<S>,
): Source<S> {
  const { clock, toSignal, name = "clock" } = options;

  return {
    name,

    async start(emit: (signal: S) => Promise<void>): Promise<void> {
      clock.start(async (tick) => {
        const signal = toSignal(tick);
        await emit(signal);
      });
    },

    async stop(): Promise<void> {
      clock.stop();
    },
  };
}
