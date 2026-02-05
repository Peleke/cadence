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

// Sources
export { createFileWatcherSource } from "./sources/file-watcher.js";
export type { FileEvent, FileEventType, FileWatcherOptions } from "./sources/file-watcher.js";

export { createCronSource, getNextRun, isValidCronExpr } from "./sources/cron.js";
export type { CronJob, CronSourceOptions } from "./sources/cron.js";

// Clock primitives
export type {
  Tick,
  TickHandler,
  BackpressurePolicy,
  TickStats,
  Clock,
  IntervalClockOptions,
} from "./clock/types.js";

export { createIntervalClock } from "./clock/interval.js";
