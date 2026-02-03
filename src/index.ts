/**
 * Cadence — Typed event infrastructure for ambient AI agency.
 *
 * @packageDocumentation
 */

// Core types
export type {
  BaseSignal,
  DefineSignals,
  SignalPayload,
  SignalHandler,
  AnySignalHandler,
  Middleware,
  BusStats,
  Transport,
  SignalStore,
  HandlerExecutor,
  Source,
} from "./types.js";

// Bus
export { createSignalBus } from "./bus.js";
export type { SignalBus, SignalBusOptions } from "./bus.js";

// Transport implementations
export { createMemoryTransport } from "./transport/memory.js";

// Store implementations
export { createNoopStore } from "./store/noop.js";

// Executor implementations
export { createSequentialExecutor } from "./executor/sequential.js";
