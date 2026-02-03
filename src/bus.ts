/**
 * Signal bus — the core of Cadence.
 *
 * A typed pub/sub system with pluggable transport, store, and executor.
 * Consumers define their own signal types; the bus handles routing.
 */

import type {
  AnySignalHandler,
  BaseSignal,
  BusStats,
  HandlerExecutor,
  Middleware,
  SignalHandler,
  SignalStore,
  Transport,
} from "./types.js";
import { createMemoryTransport } from "./transport/memory.js";
import { createNoopStore } from "./store/noop.js";
import { createSequentialExecutor } from "./executor/sequential.js";

/**
 * Signal bus interface.
 */
export interface SignalBus<S extends BaseSignal = BaseSignal> {
  /** Emit a signal to all subscribers */
  emit(signal: S): Promise<void>;

  /** Subscribe to signals of a specific type */
  on<T extends S["type"]>(type: T, handler: SignalHandler<S, T>): () => void;

  /** Subscribe to all signals */
  onAny(handler: AnySignalHandler<S>): () => void;

  /** Add middleware (runs before handlers) */
  use(middleware: Middleware<S>): void;

  /** Clear all handlers and middleware */
  clear(): void;

  /** Get bus statistics */
  stats(): BusStats;

  /** Replay unacknowledged signals from store */
  replay(): Promise<number>;
}

export interface SignalBusOptions<S extends BaseSignal = BaseSignal> {
  /** Transport layer (default: in-memory) */
  transport?: Transport<S>;
  /** Persistence layer (default: no-op) */
  store?: SignalStore<S>;
  /** Handler executor (default: sequential) */
  executor?: HandlerExecutor<S>;
  /** Error handler for handler failures */
  onError?: (signal: S, handlerName: string, error: unknown) => void;
}

export function createSignalBus<S extends BaseSignal = BaseSignal>(
  options: SignalBusOptions<S> = {},
): SignalBus<S> {
  const transport = options.transport ?? createMemoryTransport<S>();
  const store = options.store ?? createNoopStore<S>();
  const executor = options.executor ?? createSequentialExecutor<S>();
  const onError = options.onError ?? (() => {});

  // Type-specific handlers: Map<signalType, handler[]>
  const typeHandlers = new Map<S["type"], SignalHandler<S, S["type"]>[]>();

  // Handlers for all signals
  const anyHandlers: AnySignalHandler<S>[] = [];

  // Middleware stack (runs in order before handlers)
  const middlewareStack: Middleware<S>[] = [];

  // Stats
  let emittedCount = 0;
  let handledCount = 0;
  let errorCount = 0;

  // Process a signal through middleware and handlers
  async function processSignal(signal: S): Promise<void> {
    // Build the handler chain
    const runHandlers = async (): Promise<void> => {
      // Run type-specific handlers
      const handlers = typeHandlers.get(signal.type) ?? [];
      for (const handler of handlers) {
        try {
          await executor.execute(handler as AnySignalHandler<S>, signal);
          handledCount++;
        } catch (err) {
          errorCount++;
          onError(signal, `type:${signal.type}`, err);
        }
      }

      // Run any-handlers
      for (let i = 0; i < anyHandlers.length; i++) {
        const handler = anyHandlers[i];
        if (!handler) continue;
        try {
          await executor.execute(handler, signal);
          handledCount++;
        } catch (err) {
          errorCount++;
          onError(signal, `any:${i}`, err);
        }
      }
    };

    // Build middleware chain (last middleware calls runHandlers)
    let chain = runHandlers;
    for (let i = middlewareStack.length - 1; i >= 0; i--) {
      const mw = middlewareStack[i];
      if (!mw) continue;
      const next = chain;
      chain = () => mw(signal, next);
    }

    await chain();
  }

  // Subscribe to transport
  transport.subscribe(processSignal);

  async function emit(signal: S): Promise<void> {
    emittedCount++;

    // Persist before processing (for durability)
    await store.save(signal);

    // Emit through transport
    await transport.emit(signal);

    // Mark as acknowledged after successful processing
    await store.markAcked(signal.id);
  }

  function on<T extends S["type"]>(type: T, handler: SignalHandler<S, T>): () => void {
    if (!typeHandlers.has(type)) {
      typeHandlers.set(type, []);
    }
    const list = typeHandlers.get(type)!;
    // Safe cast: handler is stored by type, only called with matching signals
    list.push(handler as unknown as SignalHandler<S, S["type"]>);

    return () => {
      const idx = list.indexOf(handler as unknown as SignalHandler<S, S["type"]>);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  function onAny(handler: AnySignalHandler<S>): () => void {
    anyHandlers.push(handler);
    return () => {
      const idx = anyHandlers.indexOf(handler);
      if (idx !== -1) anyHandlers.splice(idx, 1);
    };
  }

  function use(middleware: Middleware<S>): void {
    middlewareStack.push(middleware);
  }

  function clear(): void {
    typeHandlers.clear();
    anyHandlers.length = 0;
    middlewareStack.length = 0;
  }

  function stats(): BusStats {
    let handlerCount = 0;
    for (const handlers of typeHandlers.values()) {
      handlerCount += handlers.length;
    }

    return {
      emitted: emittedCount,
      handled: handledCount,
      errors: errorCount,
      handlers: handlerCount,
      anyHandlers: anyHandlers.length,
      middleware: middlewareStack.length,
    };
  }

  async function replay(): Promise<number> {
    const unacked = await store.getUnacked();
    for (const signal of unacked) {
      await transport.emit(signal);
      await store.markAcked(signal.id);
    }
    return unacked.length;
  }

  return { emit, on, onAny, use, clear, stats, replay };
}
