import type { Clock, Tick, TickHandler, TickStats } from "./types.js";

/** Clock that ticks on external push() calls. */
export interface BridgeClock extends Clock {
  /** Push a tick from an external system. Each push = one tick. */
  push(reason?: string): void;
}

/**
 * Create a bridge clock driven by external events.
 *
 * - Every `push()` = one tick with reason "bridge"
 * - No interval config — timing comes from external system
 * - `now()` returns `Date.now()` (real time, not virtual)
 */
export function createBridgeClock(): BridgeClock {
  let handler: TickHandler | null = null;
  let _running = false;
  let _seq = 0;

  // Stats
  let tickCount = 0;
  let errors = 0;
  let totalHandlerMs = 0;
  let lastTickAt = 0;
  let maxHandlerMs = 0;

  const clock: BridgeClock = {
    start(h: TickHandler): void {
      if (_running) {
        throw new Error("Clock already running");
      }
      handler = h;
      _running = true;
      _seq = 0;
      tickCount = 0;
      errors = 0;
      totalHandlerMs = 0;
      lastTickAt = 0;
      maxHandlerMs = 0;
    },

    stop(): void {
      _running = false;
      handler = null;
    },

    now(): number {
      return Date.now();
    },

    stats(): TickStats {
      return {
        tickCount,
        droppedTicks: 0, // Bridge never drops — every push is a tick
        errors,
        avgHandlerMs: tickCount > 0 ? totalHandlerMs / tickCount : 0,
        avgDriftMs: 0, // No concept of drift — timing is external
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

    push(_reason?: string): void {
      if (!_running || !handler) return;

      const tick: Tick = {
        ts: Date.now(),
        seq: _seq++,
        reason: "bridge",
      };

      tickCount++;
      lastTickAt = tick.ts;

      const start = Date.now();
      let result: void | Promise<void>;
      try {
        result = handler(tick);
      } catch (err) {
        errors++;
        const elapsed = Date.now() - start;
        totalHandlerMs += elapsed;
        if (elapsed > maxHandlerMs) maxHandlerMs = elapsed;
        void err;
        return;
      }

      // Handle async handlers
      if (result && typeof result === "object" && "then" in result) {
        (result as Promise<void>).then(
          () => {
            const elapsed = Date.now() - start;
            totalHandlerMs += elapsed;
            if (elapsed > maxHandlerMs) maxHandlerMs = elapsed;
          },
          (err) => {
            errors++;
            const elapsed = Date.now() - start;
            totalHandlerMs += elapsed;
            if (elapsed > maxHandlerMs) maxHandlerMs = elapsed;
            void err;
          },
        );
      } else {
        const elapsed = Date.now() - start;
        totalHandlerMs += elapsed;
        if (elapsed > maxHandlerMs) maxHandlerMs = elapsed;
      }
    },
  };

  return clock;
}
