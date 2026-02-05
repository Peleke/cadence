import { describe, it, expect, vi } from "vitest";
import { createBridgeClock } from "./bridge.js";
import type { Tick } from "./types.js";

describe("createBridgeClock", () => {
  it("starts with seq 0", () => {
    const clock = createBridgeClock();
    expect(clock.seq).toBe(0);
    expect(clock.running).toBe(false);
  });

  it("throws if started twice", () => {
    const clock = createBridgeClock();
    clock.start(() => {});
    expect(() => clock.start(() => {})).toThrow("Clock already running");
  });

  describe("push()", () => {
    it("fires one tick per push", () => {
      const clock = createBridgeClock();
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      clock.push();
      clock.push();
      clock.push();

      expect(ticks).toHaveLength(3);
      expect(ticks[0]!.seq).toBe(0);
      expect(ticks[1]!.seq).toBe(1);
      expect(ticks[2]!.seq).toBe(2);
      expect(ticks[0]!.reason).toBe("bridge");
    });

    it("ticks have real timestamps", () => {
      const clock = createBridgeClock();
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      const before = Date.now();
      clock.push();
      const after = Date.now();

      expect(ticks[0]!.ts).toBeGreaterThanOrEqual(before);
      expect(ticks[0]!.ts).toBeLessThanOrEqual(after);
    });

    it("is a no-op when not running", () => {
      const clock = createBridgeClock();
      const handler = vi.fn();
      // Don't start
      clock.push();
      expect(handler).not.toHaveBeenCalled();
    });

    it("is a no-op after stop", () => {
      const clock = createBridgeClock();
      const ticks: Tick[] = [];
      clock.start((tick) => { ticks.push(tick); });

      clock.push();
      clock.stop();
      clock.push();

      expect(ticks).toHaveLength(1);
    });
  });

  describe("now()", () => {
    it("returns real time (Date.now())", () => {
      const clock = createBridgeClock();
      const before = Date.now();
      const now = clock.now();
      const after = Date.now();
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
    });
  });

  describe("stats", () => {
    it("tracks tick count", () => {
      const clock = createBridgeClock();
      clock.start(() => {});
      clock.push();
      clock.push();

      const stats = clock.stats();
      expect(stats.tickCount).toBe(2);
      expect(stats.droppedTicks).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it("tracks errors from sync handlers", () => {
      const clock = createBridgeClock();
      clock.start(() => { throw new Error("boom"); });

      // push should not throw — bridge swallows errors
      expect(() => clock.push()).not.toThrow();

      const stats = clock.stats();
      expect(stats.errors).toBe(1);
      expect(stats.tickCount).toBe(1);
    });

    it("resets stats on restart", () => {
      const clock = createBridgeClock();
      clock.start(() => {});
      clock.push();
      clock.push();
      clock.stop();

      clock.start(() => {});
      const stats = clock.stats();
      expect(stats.tickCount).toBe(0);
    });
  });

  describe("lifecycle", () => {
    it("stop is idempotent", () => {
      const clock = createBridgeClock();
      clock.start(() => {});
      clock.stop();
      clock.stop();
      expect(clock.running).toBe(false);
    });

    it("can restart after stop", () => {
      const clock = createBridgeClock();
      const ticks1: Tick[] = [];
      const ticks2: Tick[] = [];

      clock.start((tick) => { ticks1.push(tick); });
      clock.push();
      clock.stop();

      clock.start((tick) => { ticks2.push(tick); });
      clock.push();
      clock.stop();

      expect(ticks1).toHaveLength(1);
      expect(ticks2).toHaveLength(1);
      // Restart resets seq
      expect(ticks2[0]!.seq).toBe(0);
    });
  });
});
