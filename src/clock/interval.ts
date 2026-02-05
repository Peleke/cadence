import type {
  Clock,
  IntervalClockOptions,
  Tick,
  TickHandler,
  TickStats,
  BackpressurePolicy,
} from "./types.js";

/** Create an interval-based clock using chained setTimeout (never setInterval). */
export function createIntervalClock(options: IntervalClockOptions): Clock {
  const {
    intervalMs,
    backpressure = "block",
    maxCatchUpTicks = 3,
    onDriftWarning,
    onError,
  } = options;

  if (intervalMs <= 0) {
    throw new Error("intervalMs must be positive");
  }

  let handler: TickHandler | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let _running = false;
  let _seq = 0;
  let busy = false;

  // Stats tracking
  let tickCount = 0;
  let droppedTicks = 0;
  let errors = 0;
  let totalHandlerMs = 0;
  let totalDriftMs = 0;
  let lastTickAt = 0;
  let maxHandlerMs = 0;

  // Drift warning: consecutive high-drift ticks
  let consecutiveHighDrift = 0;
  const DRIFT_WARN_RATIO = 0.8;
  const DRIFT_WARN_COUNT = 5;

  // For fixed-rate modes: track ideal next fire time
  let nextIdealTime = 0;
  // Accumulator for adaptive catch-up
  let accumulator = 0;

  function resetStats(): void {
    tickCount = 0;
    droppedTicks = 0;
    errors = 0;
    totalHandlerMs = 0;
    totalDriftMs = 0;
    lastTickAt = 0;
    maxHandlerMs = 0;
    consecutiveHighDrift = 0;
  }

  async function fireTick(reason: Tick["reason"], drift?: number): Promise<void> {
    if (!handler) return;

    const tick: Tick = {
      ts: Date.now(),
      seq: _seq++,
      reason,
      drift,
    };

    tickCount++;
    lastTickAt = tick.ts;

    if (drift !== undefined) {
      totalDriftMs += Math.abs(drift);

      if (Math.abs(drift) > intervalMs * DRIFT_WARN_RATIO) {
        consecutiveHighDrift++;
        if (consecutiveHighDrift >= DRIFT_WARN_COUNT && onDriftWarning) {
          onDriftWarning(drift);
        }
      } else {
        consecutiveHighDrift = 0;
      }
    }

    const start = Date.now();
    try {
      await handler(tick);
    } catch (err) {
      errors++;
      onError?.(err);
    }
    const elapsed = Date.now() - start;

    totalHandlerMs += elapsed;
    if (elapsed > maxHandlerMs) {
      maxHandlerMs = elapsed;
    }

    return;
  }

  function scheduleBlock(): void {
    if (!_running) return;
    timer = setTimeout(async () => {
      await fireTick("interval", 0);
      scheduleBlock();
    }, intervalMs);
  }

  function scheduleDrop(): void {
    if (!_running) return;

    const now = Date.now();
    nextIdealTime = nextIdealTime || now + intervalMs;
    const delay = Math.max(0, nextIdealTime - now);

    timer = setTimeout(() => {
      const drift = Date.now() - nextIdealTime;
      nextIdealTime += intervalMs;

      // Schedule next tick BEFORE handling — fixed-rate, not fixed-delay
      scheduleDrop();

      if (busy) {
        droppedTicks++;
        return;
      }

      busy = true;
      const done = async () => {
        await fireTick("interval", drift);
        busy = false;

        // Catch-up: fire accumulated ticks up to maxCatchUpTicks
        let catchUps = 0;
        while (_running && nextIdealTime <= Date.now() && catchUps < maxCatchUpTicks) {
          const catchUpDrift = Date.now() - nextIdealTime;
          nextIdealTime += intervalMs;
          await fireTick("catchup", catchUpDrift);
          catchUps++;
        }

        // Clamp: if still behind, skip ahead (spiral-of-death prevention)
        if (nextIdealTime < Date.now()) {
          const skipped = Math.floor((Date.now() - nextIdealTime) / intervalMs);
          droppedTicks += skipped;
          nextIdealTime += skipped * intervalMs;
        }
      };
      done().catch((err) => {
        errors++;
        onError?.(err);
        busy = false;
      });
    }, delay);
  }

  function scheduleAdaptive(): void {
    if (!_running) return;

    const now = Date.now();
    nextIdealTime = nextIdealTime || now + intervalMs;
    const delay = Math.max(0, nextIdealTime - now);

    timer = setTimeout(async () => {
      const actualTime = Date.now();
      const drift = actualTime - nextIdealTime;
      accumulator += intervalMs + drift;

      // Fire ticks for accumulated time, clamped at maxCatchUpTicks
      let fired = 0;
      while (accumulator >= intervalMs && fired < maxCatchUpTicks + 1) {
        if (!_running) return;
        accumulator -= intervalMs;
        const tickReason = fired === 0 ? "interval" as const : "catchup" as const;
        await fireTick(tickReason, fired === 0 ? drift : 0);
        fired++;
      }

      // Clamp accumulator: spiral-of-death prevention
      if (accumulator >= intervalMs) {
        const skipped = Math.floor(accumulator / intervalMs);
        droppedTicks += skipped;
        accumulator -= skipped * intervalMs;
      }

      nextIdealTime = Date.now() + Math.max(0, intervalMs - accumulator);
      scheduleAdaptive();
    }, delay);
  }

  const schedulers: Record<BackpressurePolicy, () => void> = {
    block: scheduleBlock,
    drop: scheduleDrop,
    adaptive: scheduleAdaptive,
  };

  const clock: Clock = {
    start(h: TickHandler): void {
      if (_running) {
        throw new Error("Clock already running");
      }
      handler = h;
      _running = true;
      _seq = 0;
      resetStats();
      nextIdealTime = 0;
      accumulator = 0;
      busy = false;
      schedulers[backpressure]();
    },

    stop(): void {
      _running = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      handler = null;
      busy = false;
    },

    now(): number {
      return Date.now();
    },

    stats(): TickStats {
      return {
        tickCount,
        droppedTicks,
        errors,
        avgHandlerMs: tickCount > 0 ? totalHandlerMs / tickCount : 0,
        avgDriftMs: tickCount > 0 ? totalDriftMs / tickCount : 0,
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
  };

  return clock;
}
