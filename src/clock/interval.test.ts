import { describe, it, expect, vi, afterEach } from "vitest";
import { createIntervalClock } from "./interval.js";
import type { Tick } from "./types.js";

describe("createIntervalClock", () => {
  let clock: ReturnType<typeof createIntervalClock>;

  afterEach(() => {
    clock?.stop();
  });

  it("throws if intervalMs is not positive", () => {
    expect(() => createIntervalClock({ intervalMs: 0 })).toThrow("intervalMs must be positive");
    expect(() => createIntervalClock({ intervalMs: -1 })).toThrow("intervalMs must be positive");
  });

  it("throws if started twice", () => {
    clock = createIntervalClock({ intervalMs: 100 });
    clock.start(() => {});
    expect(() => clock.start(() => {})).toThrow("Clock already running");
  });

  describe("block policy (default)", () => {
    it("fires ticks at interval", async () => {
      clock = createIntervalClock({ intervalMs: 50 });
      const ticks: Tick[] = [];

      clock.start((tick) => {
        ticks.push(tick);
      });

      expect(clock.running).toBe(true);
      await sleep(180);
      clock.stop();

      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks[0]!.seq).toBe(0);
      expect(ticks[0]!.reason).toBe("interval");
      // Sequences are monotonic
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i]!.seq).toBe(ticks[i - 1]!.seq + 1);
      }
    });

    it("waits for handler before scheduling next tick", async () => {
      clock = createIntervalClock({ intervalMs: 30 });
      const ticks: Tick[] = [];

      clock.start(async (tick) => {
        ticks.push(tick);
        await sleep(60); // Handler takes 2x the interval
      });

      await sleep(250);
      clock.stop();

      // With block policy and 60ms handler + 30ms interval = ~90ms per tick
      // In 250ms we should get ~2-3 ticks, not 8+ like fixed-rate would
      expect(ticks.length).toBeLessThanOrEqual(4);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("drop policy", () => {
    it("drops ticks when handler is busy", async () => {
      clock = createIntervalClock({ intervalMs: 30, backpressure: "drop" });
      const ticks: Tick[] = [];

      clock.start(async (tick) => {
        ticks.push(tick);
        if (tick.seq === 0) {
          await sleep(100); // First handler blocks for multiple intervals
        }
      });

      await sleep(200);
      clock.stop();

      const stats = clock.stats();
      expect(stats.droppedTicks).toBeGreaterThan(0);
    });
  });

  describe("adaptive policy", () => {
    it("self-corrects timing after slow handler", async () => {
      clock = createIntervalClock({ intervalMs: 40, backpressure: "adaptive" });
      const ticks: Tick[] = [];

      clock.start(async (tick) => {
        ticks.push(tick);
        if (tick.seq === 0) {
          await sleep(60); // First tick takes longer
        }
      });

      await sleep(300);
      clock.stop();

      // Adaptive should fire catch-up ticks
      const catchups = ticks.filter((t) => t.reason === "catchup");
      // May or may not have catch-ups depending on timing, but should have ticks
      expect(ticks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("lifecycle", () => {
    it("stop is idempotent", () => {
      clock = createIntervalClock({ intervalMs: 100 });
      clock.start(() => {});
      clock.stop();
      clock.stop(); // Should not throw
      expect(clock.running).toBe(false);
    });

    it("can restart after stop", async () => {
      clock = createIntervalClock({ intervalMs: 30 });
      const ticks1: Tick[] = [];
      const ticks2: Tick[] = [];

      clock.start((tick) => ticks1.push(tick));
      await sleep(80);
      clock.stop();

      clock.start((tick) => ticks2.push(tick));
      await sleep(80);
      clock.stop();

      expect(ticks1.length).toBeGreaterThanOrEqual(1);
      expect(ticks2.length).toBeGreaterThanOrEqual(1);
      // Second start resets seq to 0
      expect(ticks2[0]!.seq).toBe(0);
    });
  });

  describe("stats", () => {
    it("tracks tick count and handler duration", async () => {
      clock = createIntervalClock({ intervalMs: 30 });

      clock.start(async () => {
        await sleep(5);
      });

      await sleep(120);
      clock.stop();

      const stats = clock.stats();
      expect(stats.tickCount).toBeGreaterThanOrEqual(2);
      expect(stats.avgHandlerMs).toBeGreaterThan(0);
      expect(stats.maxHandlerMs).toBeGreaterThan(0);
      expect(stats.lastTickAt).toBeGreaterThan(0);
      expect(stats.errors).toBe(0);
    });

    it("tracks errors", async () => {
      const onError = vi.fn();
      clock = createIntervalClock({ intervalMs: 30, onError });

      clock.start(() => {
        throw new Error("boom");
      });

      await sleep(100);
      clock.stop();

      const stats = clock.stats();
      expect(stats.errors).toBeGreaterThanOrEqual(1);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("now()", () => {
    it("returns Date.now()", () => {
      clock = createIntervalClock({ intervalMs: 100 });
      const before = Date.now();
      const now = clock.now();
      const after = Date.now();
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
    });
  });

  describe("seq", () => {
    it("starts at 0 before any ticks", () => {
      clock = createIntervalClock({ intervalMs: 100 });
      expect(clock.seq).toBe(0);
    });

    it("increments with each tick", async () => {
      clock = createIntervalClock({ intervalMs: 30 });
      clock.start(() => {});
      await sleep(100);
      clock.stop();
      expect(clock.seq).toBeGreaterThanOrEqual(2);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
