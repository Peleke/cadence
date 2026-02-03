import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSignalBus } from "./bus.js";
import type { BaseSignal, DefineSignals } from "./types.js";

// Test signal types
type TestSignals = DefineSignals<{
  "user.created": { userId: string; email: string };
  "order.placed": { orderId: string; total: number };
  "system.heartbeat": { ts: number };
}>;

function createTestSignal<T extends TestSignals["type"]>(
  type: T,
  payload: Extract<TestSignals, { type: T }>["payload"],
): Extract<TestSignals, { type: T }> {
  return {
    type,
    ts: Date.now(),
    id: crypto.randomUUID(),
    payload,
  } as Extract<TestSignals, { type: T }>;
}

describe("SignalBus", () => {
  describe("emit and on", () => {
    it("delivers signals to type-specific handlers", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler = vi.fn();

      bus.on("user.created", handler);

      const signal = createTestSignal("user.created", {
        userId: "123",
        email: "test@example.com",
      });
      await bus.emit(signal);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(signal);
    });

    it("does not deliver signals to wrong type handlers", async () => {
      const bus = createSignalBus<TestSignals>();
      const userHandler = vi.fn();
      const orderHandler = vi.fn();

      bus.on("user.created", userHandler);
      bus.on("order.placed", orderHandler);

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(userHandler).toHaveBeenCalledOnce();
      expect(orderHandler).not.toHaveBeenCalled();
    });

    it("supports multiple handlers for same type", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on("user.created", handler1);
      bus.on("user.created", handler2);

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("unsubscribes correctly", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler = vi.fn();

      const unsub = bus.on("user.created", handler);
      unsub();

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("onAny", () => {
    it("receives all signals regardless of type", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler = vi.fn();

      bus.onAny(handler);

      const userSignal = createTestSignal("user.created", {
        userId: "123",
        email: "test@example.com",
      });
      const orderSignal = createTestSignal("order.placed", {
        orderId: "456",
        total: 99.99,
      });

      await bus.emit(userSignal);
      await bus.emit(orderSignal);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, userSignal);
      expect(handler).toHaveBeenNthCalledWith(2, orderSignal);
    });

    it("unsubscribes correctly", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler = vi.fn();

      const unsub = bus.onAny(handler);
      unsub();

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("middleware", () => {
    it("runs middleware before handlers", async () => {
      const bus = createSignalBus<TestSignals>();
      const order: string[] = [];

      bus.use(async (_signal, next) => {
        order.push("middleware");
        await next();
      });

      bus.on("user.created", () => {
        order.push("handler");
      });

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(order).toEqual(["middleware", "handler"]);
    });

    it("can short-circuit by not calling next", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler = vi.fn();

      bus.use(async (_signal, _next) => {
        // Don't call next — handler should not run
      });

      bus.on("user.created", handler);

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it("runs multiple middleware in order", async () => {
      const bus = createSignalBus<TestSignals>();
      const order: string[] = [];

      bus.use(async (_signal, next) => {
        order.push("mw1-before");
        await next();
        order.push("mw1-after");
      });

      bus.use(async (_signal, next) => {
        order.push("mw2-before");
        await next();
        order.push("mw2-after");
      });

      bus.on("user.created", () => {
        order.push("handler");
      });

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(order).toEqual([
        "mw1-before",
        "mw2-before",
        "handler",
        "mw2-after",
        "mw1-after",
      ]);
    });
  });

  describe("error handling", () => {
    it("catches handler errors and continues", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler1 = vi.fn(() => {
        throw new Error("boom");
      });
      const handler2 = vi.fn();

      bus.on("user.created", handler1);
      bus.on("user.created", handler2);

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("calls onError callback on handler failure", async () => {
      const onError = vi.fn();
      const bus = createSignalBus<TestSignals>({ onError });
      const error = new Error("boom");

      bus.on("user.created", () => {
        throw error;
      });

      const signal = createTestSignal("user.created", {
        userId: "123",
        email: "test@example.com",
      });
      await bus.emit(signal);

      expect(onError).toHaveBeenCalledWith(signal, "type:user.created", error);
    });

    it("tracks errors in stats", async () => {
      const bus = createSignalBus<TestSignals>();

      bus.on("user.created", () => {
        throw new Error("boom");
      });

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(bus.stats().errors).toBe(1);
    });
  });

  describe("stats", () => {
    it("tracks emitted signals", async () => {
      const bus = createSignalBus<TestSignals>();

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );
      await bus.emit(createTestSignal("order.placed", { orderId: "456", total: 99.99 }));

      expect(bus.stats().emitted).toBe(2);
    });

    it("tracks handled signals", async () => {
      const bus = createSignalBus<TestSignals>();

      bus.on("user.created", () => {});
      bus.on("user.created", () => {});
      bus.onAny(() => {});

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      // 2 type handlers + 1 any handler = 3
      expect(bus.stats().handled).toBe(3);
    });

    it("tracks handler counts", () => {
      const bus = createSignalBus<TestSignals>();

      bus.on("user.created", () => {});
      bus.on("user.created", () => {});
      bus.on("order.placed", () => {});
      bus.onAny(() => {});

      const stats = bus.stats();
      expect(stats.handlers).toBe(3);
      expect(stats.anyHandlers).toBe(1);
    });

    it("tracks middleware count", () => {
      const bus = createSignalBus<TestSignals>();

      bus.use(async (_s, next) => next());
      bus.use(async (_s, next) => next());

      expect(bus.stats().middleware).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all handlers and middleware", async () => {
      const bus = createSignalBus<TestSignals>();
      const handler = vi.fn();

      bus.on("user.created", handler);
      bus.onAny(handler);
      bus.use(async (_s, next) => next());

      bus.clear();

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(handler).not.toHaveBeenCalled();

      const stats = bus.stats();
      expect(stats.handlers).toBe(0);
      expect(stats.anyHandlers).toBe(0);
      expect(stats.middleware).toBe(0);
    });
  });

  describe("async handlers", () => {
    it("waits for async handlers to complete", async () => {
      const bus = createSignalBus<TestSignals>();
      let completed = false;

      bus.on("user.created", async () => {
        await new Promise((r) => setTimeout(r, 10));
        completed = true;
      });

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      expect(completed).toBe(true);
    });

    it("runs handlers sequentially by default", async () => {
      const bus = createSignalBus<TestSignals>();
      const order: number[] = [];

      bus.on("user.created", async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push(1);
      });

      bus.on("user.created", async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(2);
      });

      await bus.emit(
        createTestSignal("user.created", { userId: "123", email: "test@example.com" }),
      );

      // Sequential: first handler completes before second starts
      expect(order).toEqual([1, 2]);
    });
  });
});
