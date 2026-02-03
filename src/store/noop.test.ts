import { describe, it, expect } from "vitest";
import { createNoopStore } from "./noop.js";
import type { BaseSignal } from "../types.js";

type TestSignal = BaseSignal<"test", { value: number }>;

describe("NoopStore", () => {
  it("save does nothing", async () => {
    const store = createNoopStore<TestSignal>();
    // Should not throw
    await store.save({
      type: "test",
      ts: Date.now(),
      id: "123",
      payload: { value: 42 },
    });
  });

  it("markAcked does nothing", async () => {
    const store = createNoopStore<TestSignal>();
    // Should not throw
    await store.markAcked("123");
  });

  it("getUnacked returns empty array", async () => {
    const store = createNoopStore<TestSignal>();
    const result = await store.getUnacked();
    expect(result).toEqual([]);
  });
});
