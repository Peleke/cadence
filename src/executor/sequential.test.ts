import { describe, it, expect, vi } from "vitest";
import { createSequentialExecutor } from "./sequential.js";
import type { BaseSignal } from "../types.js";

type TestSignal = BaseSignal<"test", { value: number }>;

function createSignal(value: number): TestSignal {
  return {
    type: "test",
    ts: Date.now(),
    id: crypto.randomUUID(),
    payload: { value },
  };
}

describe("SequentialExecutor", () => {
  it("executes handler with signal", async () => {
    const executor = createSequentialExecutor<TestSignal>();
    const handler = vi.fn();
    const signal = createSignal(42);

    await executor.execute(handler, signal);

    expect(handler).toHaveBeenCalledWith(signal);
  });

  it("tracks processing count", async () => {
    const executor = createSequentialExecutor<TestSignal>();
    let statsWhileProcessing: { queued: number; processing: number } | null = null;

    await executor.execute(async () => {
      statsWhileProcessing = executor.stats();
    }, createSignal(42));

    expect(statsWhileProcessing).toEqual({ queued: 0, processing: 1 });
    expect(executor.stats()).toEqual({ queued: 0, processing: 0 });
  });

  it("decrements processing even on error", async () => {
    const executor = createSequentialExecutor<TestSignal>();

    try {
      await executor.execute(() => {
        throw new Error("boom");
      }, createSignal(42));
    } catch {
      // Expected
    }

    expect(executor.stats().processing).toBe(0);
  });

  it("propagates handler errors", async () => {
    const executor = createSequentialExecutor<TestSignal>();
    const error = new Error("boom");

    await expect(
      executor.execute(() => {
        throw error;
      }, createSignal(42)),
    ).rejects.toThrow(error);
  });
});
