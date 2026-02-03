import { describe, it, expect, vi } from "vitest";
import { createMemoryTransport } from "./memory.js";
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

describe("MemoryTransport", () => {
  it("delivers signals to subscribers", async () => {
    const transport = createMemoryTransport<TestSignal>();
    const handler = vi.fn();

    transport.subscribe(handler);
    await transport.emit(createSignal(42));

    expect(handler).toHaveBeenCalledOnce();
  });

  it("delivers to multiple subscribers", async () => {
    const transport = createMemoryTransport<TestSignal>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    transport.subscribe(handler1);
    transport.subscribe(handler2);
    await transport.emit(createSignal(42));

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("unsubscribes correctly", async () => {
    const transport = createMemoryTransport<TestSignal>();
    const handler = vi.fn();

    const unsub = transport.subscribe(handler);
    unsub();
    await transport.emit(createSignal(42));

    expect(handler).not.toHaveBeenCalled();
  });

  it("handles no subscribers gracefully", async () => {
    const transport = createMemoryTransport<TestSignal>();
    // Should not throw
    await transport.emit(createSignal(42));
  });
});
