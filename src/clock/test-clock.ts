import type { Clock, Tick, TickHandler, TickStats } from "./types.js";

/** Extended Clock with manual tick control for deterministic testing. */
export interface TestClock extends Clock {
  /** Fire N ticks (default: 1). Awaits handler for each. */
  tick(count?: number): Promise<void>;
  /** Advance virtual time by ms, firing due ticks. Residual stays in accumulator. */
  advanceBy(ms: number): Promise<void>;
  /** Execute all pending ticks. */
  flush(): Promise<void>;
  /** Reset to t=0, seq=0. */
  reset(): void;
  /** Number of ticks pending in accumulator. */
  readonly pendingTicks: number;
}

/**
 * Create a deterministic test clock. No real timers.
 *
 * - `now()` returns virtual time, never `Date.now()`
 * - `start()` registers handler but does NOT auto-tick
 * - `tick()` fires handler synchronously with correct ts/seq
 * - `advanceBy()` computes tick count, fires them, residual in accumulator
 */
export function createTestClock(intervalMs = 1000): TestClock {
  let handler: TickHandler | null = null;
  let _running = false;
  let _seq = 0;
  let virtualTime = 0;
  let accumulator = 0;

  // Stats
  let tickCount = 0;
  let errors = 0;
  let totalHandlerMs = 0;
  let lastTickAt = 0;
  let maxHandlerMs = 0;

  function resetStats(): void {
    tickCount = 0;
    errors = 0;
    totalHandlerMs = 0;
    lastTickAt = 0;
    maxHandlerMs = 0;
  }

  async function fireSingleTick(reason: Tick["reason"] = "manual"): Promise<void> {
    if (!handler) return;

    const tick: Tick = {
      ts: virtualTime,
      seq: _seq++,
      reason,
    };

    tickCount++;
    lastTickAt = virtualTime;

    const start = performance.now();
    try {
      await handler(tick);
    } catch (err) {
      errors++;
      // In test clock, rethrow so tests can catch errors
      throw err;
    }
    const elapsed = performance.now() - start;
    totalHandlerMs += elapsed;
    if (elapsed > maxHandlerMs) {
      maxHandlerMs = elapsed;
    }
  }

  const clock: TestClock = {
    start(h: TickHandler): void {
      if (_running) {
        throw new Error("Clock already running");
      }
      handler = h;
      _running = true;
    },

    stop(): void {
      _running = false;
      handler = null;
      accumulator = 0;
    },

    now(): number {
      return virtualTime;
    },

    stats(): TickStats {
      return {
        tickCount,
        droppedTicks: 0, // Test clock never drops
        errors,
        avgHandlerMs: tickCount > 0 ? totalHandlerMs / tickCount : 0,
        avgDriftMs: 0, // No drift in virtual time
        lastTickAt,
        maxHandlerMs,
      };
    },

    get running(): boolean {
      return _running;
    },

    get seq(): number {
      return _seq;
    },

    async tick(count = 1): Promise<void> {
      if (!_running) {
        throw new Error("Clock not running");
      }
      for (let i = 0; i < count; i++) {
        virtualTime += intervalMs;
        await fireSingleTick("manual");
      }
    },

    async advanceBy(ms: number): Promise<void> {
      if (!_running) {
        throw new Error("Clock not running");
      }
      accumulator += ms;
      const ticksToFire = Math.floor(accumulator / intervalMs);
      accumulator -= ticksToFire * intervalMs;

      for (let i = 0; i < ticksToFire; i++) {
        virtualTime += intervalMs;
        await fireSingleTick("manual");
      }
    },

    async flush(): Promise<void> {
      if (!_running) {
        throw new Error("Clock not running");
      }
      if (accumulator > 0) {
        // Fire one more tick for any remaining accumulator
        virtualTime += accumulator;
        accumulator = 0;
        await fireSingleTick("manual");
      }
    },

    reset(): void {
      virtualTime = 0;
      _seq = 0;
      accumulator = 0;
      resetStats();
    },

    get pendingTicks(): number {
      return Math.floor(accumulator / intervalMs);
    },
  };

  return clock;
}
