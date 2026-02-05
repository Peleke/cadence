/**
 * Clock primitives for Cadence.
 *
 * A Clock is a lower-level timing primitive than a Source.
 * Use createClockSource to adapt a Clock into a Source.
 */

/** A single tick emitted by a Clock. */
export interface Tick {
  /** Unix timestamp (ms) when this tick fired */
  ts: number;
  /** Monotonic counter, 0-based */
  seq: number;
  /** Why this tick fired */
  reason: "interval" | "bridge" | "manual" | "catchup";
  /** Milliseconds from ideal fire time (only for interval clocks) */
  drift?: number;
}

/** Handler invoked on each tick. */
export type TickHandler = (tick: Tick) => void | Promise<void>;

/**
 * Backpressure policy for interval clocks.
 *
 * - `"block"` — Fixed-delay. Next tick scheduled after handler completes + intervalMs.
 *   Prevents spiral of death by construction. **Default.**
 * - `"drop"` — Fixed-rate. Skip tick if handler is still busy. Dropped ticks counted in stats.
 * - `"adaptive"` — Fixed-rate with self-correction: nextDelay = max(0, intervalMs - elapsed).
 */
export type BackpressurePolicy = "block" | "drop" | "adaptive";

/** Observable tick statistics. */
export interface TickStats {
  /** Total ticks fired */
  tickCount: number;
  /** Ticks skipped due to backpressure (drop policy) */
  droppedTicks: number;
  /** Handler errors caught */
  errors: number;
  /** Rolling average handler duration (ms) */
  avgHandlerMs: number;
  /** Rolling average drift from ideal fire time (ms) */
  avgDriftMs: number;
  /** Timestamp of most recent tick */
  lastTickAt: number;
  /** Maximum handler duration observed (ms) */
  maxHandlerMs: number;
}

/** Core clock interface. */
export interface Clock {
  /** Register handler and start ticking. */
  start(handler: TickHandler): void;
  /** Stop ticking. Idempotent. */
  stop(): void;
  /** Current time in ms. Testing seam — real clocks return Date.now(). */
  now(): number;
  /** Current tick statistics. */
  stats(): TickStats;
  /** Whether the clock is currently running. */
  readonly running: boolean;
  /** Current sequence number. */
  readonly seq: number;
}

/** Options for createIntervalClock. */
export interface IntervalClockOptions {
  /** Interval between ticks in milliseconds. */
  intervalMs: number;
  /** Backpressure strategy. Default: "block". */
  backpressure?: BackpressurePolicy;
  /** Max catch-up ticks per cycle for drop/adaptive. Default: 3. */
  maxCatchUpTicks?: number;
  /** Called when drift exceeds 80% of interval for 5+ consecutive ticks. */
  onDriftWarning?: (driftMs: number) => void;
  /** Called when handler throws. */
  onError?: (error: unknown) => void;
}
