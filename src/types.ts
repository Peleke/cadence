/**
 * Core type definitions for Cadence.
 *
 * Cadence is domain-agnostic — consumers define their own signal types
 * using the DefineSignals helper.
 */

/**
 * Base signal shape. All signals have these fields.
 * Consumers extend via DefineSignals<M>.
 */
export interface BaseSignal<T extends string = string, P = unknown> {
  /** Signal type identifier */
  type: T;
  /** Unix timestamp (ms) when signal was created */
  ts: number;
  /** Unique signal ID (UUID recommended) */
  id: string;
  /** Optional origin identifier (source name, service ID, etc.) */
  source?: string;
  /** Signal-specific data */
  payload: P;
}

/**
 * Type-safe signal definition helper.
 *
 * @example
 * type MySignals = DefineSignals<{
 *   "user.created": { userId: string };
 *   "order.placed": { orderId: string; total: number };
 * }>;
 *
 * // MySignals is now a union:
 * // | BaseSignal<"user.created", { userId: string }>
 * // | BaseSignal<"order.placed", { orderId: string; total: number }>
 */
export type DefineSignals<M extends Record<string, unknown>> = {
  [K in keyof M]: BaseSignal<K & string, M[K]>;
}[keyof M];

/**
 * Extract the payload type for a specific signal type.
 */
export type SignalPayload<
  S extends BaseSignal,
  T extends S["type"],
> = Extract<S, { type: T }>["payload"];

/**
 * Handler function for a specific signal type.
 */
export type SignalHandler<S extends BaseSignal, T extends S["type"] = S["type"]> = (
  signal: Extract<S, { type: T }>,
) => void | Promise<void>;

/**
 * Handler for any signal (used by onAny, middleware).
 */
export type AnySignalHandler<S extends BaseSignal> = (signal: S) => void | Promise<void>;

/**
 * Middleware function. Receives signal and next(), can transform, filter, or pass through.
 */
export type Middleware<S extends BaseSignal> = (
  signal: S,
  next: () => Promise<void>,
) => Promise<void>;

/**
 * Bus statistics for observability.
 */
export interface BusStats {
  /** Total signals emitted since creation */
  emitted: number;
  /** Total handler invocations */
  handled: number;
  /** Total handler errors caught */
  errors: number;
  /** Number of registered type-specific handlers */
  handlers: number;
  /** Number of registered any-handlers */
  anyHandlers: number;
  /** Number of registered middleware */
  middleware: number;
}

/**
 * Transport interface — how signals move.
 * Default: in-memory. Can be replaced with Redis, HTTP bridge, etc.
 */
export interface Transport<S extends BaseSignal = BaseSignal> {
  /** Emit a signal to all subscribers */
  emit(signal: S): Promise<void>;
  /** Subscribe to all signals */
  subscribe(handler: AnySignalHandler<S>): () => void;
}

/**
 * Signal store interface — durability layer.
 * Default: no-op (signals not persisted). Can be replaced with SQLite, Redis, etc.
 */
export interface SignalStore<S extends BaseSignal = BaseSignal> {
  /** Save a signal before processing */
  save(signal: S): Promise<void>;
  /** Mark a signal as acknowledged (processed successfully) */
  markAcked(signalId: string): Promise<void>;
  /** Get all unacknowledged signals (for replay on restart) */
  getUnacked(): Promise<S[]>;
}

/**
 * Handler executor interface — controls concurrency.
 * Default: sequential. Can be replaced with concurrent executor.
 */
export interface HandlerExecutor<S extends BaseSignal = BaseSignal> {
  /** Execute a handler for a signal */
  execute(handler: AnySignalHandler<S>, signal: S): Promise<void>;
  /** Get executor stats */
  stats(): { queued: number; processing: number };
}

/**
 * Source interface — produces signals from external events.
 */
export interface Source<S extends BaseSignal = BaseSignal> {
  /** Source name for debugging/logging */
  name: string;
  /** Start the source, emitting signals to the provided bus */
  start(emit: (signal: S) => Promise<void>): Promise<void>;
  /** Stop the source */
  stop(): Promise<void>;
}
