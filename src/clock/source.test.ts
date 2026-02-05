import { describe, it, expect } from "vitest";
import { createClockSource } from "./source.js";
import { createTestClock } from "./test-clock.js";
import { createSignalBus } from "../bus.js";
import type { BaseSignal, DefineSignals } from "../types.js";
import type { Tick } from "./types.js";

type TickSignal = DefineSignals<{
  "clock.tick": { seq: number; ts: number };
}>;

function tickToSignal(tick: Tick): TickSignal {
  return {
    type: "clock.tick",
    ts: tick.ts,
    id: `tick-${tick.seq}`,
    source: "test-clock",
    payload: { seq: tick.seq, ts: tick.ts },
  };
}

describe("createClockSource", () => {
  it("has default name 'clock'", () => {
    const clock = createTestClock(100);
    const source = createClockSource({ clock, toSignal: tickToSignal });
    expect(source.name).toBe("clock");
  });

  it("accepts custom name", () => {
    const clock = createTestClock(100);
    const source = createClockSource({
      clock,
      toSignal: tickToSignal,
      name: "heartbeat",
    });
    expect(source.name).toBe("heartbeat");
  });

  it("emits signals on tick", async () => {
    const clock = createTestClock(100);
    const source = createClockSource({ clock, toSignal: tickToSignal });
    const signals: TickSignal[] = [];

    await source.start(async (signal) => {
      signals.push(signal);
    });

    await clock.tick(3);

    expect(signals).toHaveLength(3);
    expect(signals[0]!.type).toBe("clock.tick");
    expect(signals[0]!.payload.seq).toBe(0);
    expect(signals[1]!.payload.seq).toBe(1);
    expect(signals[2]!.payload.seq).toBe(2);
  });

  it("stops the clock on stop", async () => {
    const clock = createTestClock(100);
    const source = createClockSource({ clock, toSignal: tickToSignal });

    await source.start(async () => {});
    expect(clock.running).toBe(true);

    await source.stop();
    expect(clock.running).toBe(false);
  });

  describe("integration: TestClock → ClockSource → SignalBus", () => {
    it("signals flow through the full pipeline", async () => {
      const clock = createTestClock(1000);
      const source = createClockSource({ clock, toSignal: tickToSignal });
      const bus = createSignalBus<TickSignal>();

      const received: TickSignal[] = [];
      bus.on("clock.tick", (signal) => {
        received.push(signal);
      });

      await source.start((signal) => bus.emit(signal));
      await clock.tick(5);

      expect(received).toHaveLength(5);
      expect(received[0]!.type).toBe("clock.tick");
      expect(received[0]!.payload.seq).toBe(0);
      expect(received[4]!.payload.seq).toBe(4);

      // Bus stats should reflect the signals
      const stats = bus.stats();
      expect(stats.emitted).toBe(5);
      expect(stats.handled).toBe(5);

      await source.stop();
    });

    it("works with advanceBy", async () => {
      const clock = createTestClock(100);
      const source = createClockSource({ clock, toSignal: tickToSignal });
      const bus = createSignalBus<TickSignal>();

      const received: TickSignal[] = [];
      bus.on("clock.tick", (signal) => {
        received.push(signal);
      });

      await source.start((signal) => bus.emit(signal));
      await clock.advanceBy(350); // 3 ticks + 50ms residual

      expect(received).toHaveLength(3);

      await clock.flush(); // Fire the residual
      expect(received).toHaveLength(4);

      await source.stop();
    });
  });
});
