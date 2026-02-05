import { describe, it, expect } from "vitest";
import { createTestClock } from "./test-clock.js";
import type { Tick } from "./types.js";

describe("createTestClock", () => {
  it("starts with seq 0 and virtual time 0", () => {
    const clock = createTestClock(100);
    expect(clock.seq).toBe(0);
    expect(clock.now()).toBe(0);
    expect(clock.running).toBe(false);
  });

  it("throws if started twice", () => {
    const clock = createTestClock(100);
    clock.start(() => {});
    expect(() => clock.start(() => {})).toThrow("Clock already running");
  });

  it("throws tick/advanceBy/flush if not running", async () => {
    const clock = createTestClock(100);
    await expect(clock.tick()).rejects.toThrow("Clock not running");
    await expect(clock.advanceBy(100)).rejects.toThrow("Clock not running");
    await expect(clock.flush()).rejects.toThrow("Clock not running");
  });

  describe("tick()", () => {
    it("fires one tick with correct seq and ts", async () => {
      const clock = createTestClock(1000);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.tick();

      expect(ticks).toHaveLength(1);
      expect(ticks[0]!.seq).toBe(0);
      expect(ticks[0]!.ts).toBe(1000);
      expect(ticks[0]!.reason).toBe("manual");
      expect(clock.now()).toBe(1000);
      expect(clock.seq).toBe(1);
    });

    it("fires N ticks sequentially", async () => {
      const clock = createTestClock(500);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.tick(3);

      expect(ticks).toHaveLength(3);
      expect(ticks[0]!.seq).toBe(0);
      expect(ticks[0]!.ts).toBe(500);
      expect(ticks[1]!.seq).toBe(1);
      expect(ticks[1]!.ts).toBe(1000);
      expect(ticks[2]!.seq).toBe(2);
      expect(ticks[2]!.ts).toBe(1500);
      expect(clock.now()).toBe(1500);
    });

    it("rethrows handler errors", async () => {
      const clock = createTestClock(100);
      clock.start(() => { throw new Error("boom"); });

      await expect(clock.tick()).rejects.toThrow("boom");
      expect(clock.stats().errors).toBe(1);
    });
  });

  describe("advanceBy()", () => {
    it("fires correct number of ticks for exact multiple", async () => {
      const clock = createTestClock(100);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.advanceBy(300);

      expect(ticks).toHaveLength(3);
      expect(clock.now()).toBe(300);
    });

    it("keeps residual in accumulator", async () => {
      const clock = createTestClock(100);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.advanceBy(250);

      expect(ticks).toHaveLength(2);
      expect(clock.now()).toBe(200);
      expect(clock.pendingTicks).toBe(0);
      // 50ms residual in accumulator — not enough for a tick
    });

    it("accumulator carries across calls", async () => {
      const clock = createTestClock(100);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.advanceBy(150); // 1 tick, 50ms residual
      expect(ticks).toHaveLength(1);

      await clock.advanceBy(60); // 50+60=110ms → 1 tick, 10ms residual
      expect(ticks).toHaveLength(2);
    });

    it("fires zero ticks for sub-interval advance", async () => {
      const clock = createTestClock(1000);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.advanceBy(500);

      expect(ticks).toHaveLength(0);
      expect(clock.now()).toBe(0);
    });
  });

  describe("flush()", () => {
    it("fires tick for remaining accumulator", async () => {
      const clock = createTestClock(100);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.advanceBy(150); // 1 tick, 50ms residual
      expect(ticks).toHaveLength(1);

      await clock.flush(); // Fires for the 50ms residual
      expect(ticks).toHaveLength(2);
      expect(clock.now()).toBe(150);
    });

    it("no-ops when accumulator is empty", async () => {
      const clock = createTestClock(100);
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      await clock.advanceBy(200); // Exact, no residual
      await clock.flush();

      expect(ticks).toHaveLength(2);
    });
  });

  describe("reset()", () => {
    it("resets to t=0, seq=0", async () => {
      const clock = createTestClock(100);
      clock.start(() => {});
      await clock.tick(5);

      expect(clock.now()).toBe(500);
      expect(clock.seq).toBe(5);

      clock.reset();
      expect(clock.now()).toBe(0);
      expect(clock.seq).toBe(0);
      expect(clock.stats().tickCount).toBe(0);
    });

    it("clears accumulator", async () => {
      const clock = createTestClock(100);
      clock.start(() => {});
      await clock.advanceBy(150);

      clock.reset();
      expect(clock.pendingTicks).toBe(0);
    });
  });

  describe("stats", () => {
    it("tracks tick count", async () => {
      const clock = createTestClock(100);
      clock.start(() => {});
      await clock.tick(3);

      const stats = clock.stats();
      expect(stats.tickCount).toBe(3);
      expect(stats.droppedTicks).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.lastTickAt).toBe(300);
    });
  });

  describe("async handlers", () => {
    it("awaits async handlers before continuing", async () => {
      const clock = createTestClock(100);
      const order: string[] = [];

      clock.start(async () => {
        order.push("handler-start");
        await Promise.resolve();
        order.push("handler-end");
      });

      await clock.tick();
      order.push("after-tick");

      expect(order).toEqual(["handler-start", "handler-end", "after-tick"]);
    });
  });
});
