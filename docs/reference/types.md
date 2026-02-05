# Type Reference

All types exported from `@peleke.s/cadence`, organized by module.

## Core Types

### `BaseSignal`

The base shape for all signals.

```typescript
interface BaseSignal<T extends string = string, P = unknown> {
  type: T;         // Signal type identifier
  ts: number;      // Unix timestamp (ms)
  id: string;      // Unique signal ID
  source?: string; // Origin identifier
  payload: P;      // Signal-specific data
}
```

### `DefineSignals`

Type helper that creates a discriminated union from a signal map.

```typescript
type DefineSignals<M extends Record<string, unknown>> = {
  [K in keyof M]: BaseSignal<K & string, M[K]>;
}[keyof M];
```

**Usage:**

```typescript
type MySignals = DefineSignals<{
  "file.changed": { path: string };
  "cron.fired": { jobId: string };
}>;
// Equivalent to:
// BaseSignal<"file.changed", { path: string }> | BaseSignal<"cron.fired", { jobId: string }>
```

### `SignalPayload`

Extract the payload type for a specific signal type.

```typescript
type SignalPayload<S extends BaseSignal, T extends S["type"]> =
  Extract<S, { type: T }>["payload"];
```

### `SignalHandler`

Handler for a specific signal type.

```typescript
type SignalHandler<S extends BaseSignal, T extends S["type"] = S["type"]> =
  (signal: Extract<S, { type: T }>) => void | Promise<void>;
```

### `AnySignalHandler`

Handler for any signal.

```typescript
type AnySignalHandler<S extends BaseSignal> = (signal: S) => void | Promise<void>;
```

### `Middleware`

Middleware function. Receives signal and `next()`.

```typescript
type Middleware<S extends BaseSignal> = (
  signal: S,
  next: () => Promise<void>,
) => Promise<void>;
```

### `BusStats`

Bus statistics for observability.

```typescript
interface BusStats {
  emitted: number;      // Total signals emitted
  handled: number;      // Total handler invocations
  errors: number;       // Total handler errors caught
  handlers: number;     // Registered type-specific handlers
  anyHandlers: number;  // Registered any-handlers
  middleware: number;    // Registered middleware
}
```

## SignalBus

### `SignalBus`

```typescript
interface SignalBus<S extends BaseSignal = BaseSignal> {
  emit(signal: S): Promise<void>;
  on<T extends S["type"]>(type: T, handler: SignalHandler<S, T>): () => void;
  onAny(handler: AnySignalHandler<S>): () => void;
  use(middleware: Middleware<S>): void;
  clear(): void;
  stats(): BusStats;
  replay(): Promise<number>;
}
```

### `SignalBusOptions`

```typescript
interface SignalBusOptions<S extends BaseSignal = BaseSignal> {
  transport?: Transport<S>;
  store?: SignalStore<S>;
  executor?: HandlerExecutor<S>;
  onError?: (signal: S, handlerName: string, error: unknown) => void;
}
```

## Transport

### `Transport`

```typescript
interface Transport<S extends BaseSignal = BaseSignal> {
  emit(signal: S): Promise<void>;
  subscribe(handler: AnySignalHandler<S>): () => void;
}
```

## Store

### `SignalStore`

```typescript
interface SignalStore<S extends BaseSignal = BaseSignal> {
  save(signal: S): Promise<void>;
  markAcked(signalId: string): Promise<void>;
  getUnacked(): Promise<S[]>;
}
```

## Executor

### `HandlerExecutor`

```typescript
interface HandlerExecutor<S extends BaseSignal = BaseSignal> {
  execute(handler: AnySignalHandler<S>, signal: S): Promise<void>;
  stats(): { queued: number; processing: number };
}
```

## Source

### `Source`

```typescript
interface Source<S extends BaseSignal = BaseSignal> {
  name: string;
  start(emit: (signal: S) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}
```

### `FileEvent`

```typescript
interface FileEvent {
  type: "add" | "change" | "unlink";
  path: string;
  ts: number;
}
```

### `FileEventType`

```typescript
type FileEventType = "add" | "change" | "unlink";
```

### `FileWatcherOptions`

```typescript
interface FileWatcherOptions<S extends BaseSignal> {
  paths: string | string[];
  events?: FileEventType[];
  toSignal: (event: FileEvent) => S | null;
  chokidar?: {
    ignored?: string | RegExp | ((path: string) => boolean);
    usePolling?: boolean;
    interval?: number;
    ignoreInitial?: boolean;
    awaitWriteFinish?: boolean | { stabilityThreshold?: number; pollInterval?: number };
  };
}
```

### `CronJob`

```typescript
interface CronJob {
  id: string;
  name: string;
  expr: string;
  tz?: string;
  enabled?: boolean;
}
```

### `CronSourceOptions`

```typescript
interface CronSourceOptions<S extends BaseSignal> {
  jobs: CronJob[];
  toSignal: (job: CronJob, firedAt: number) => S;
  onFire?: (job: CronJob) => void;
  onError?: (job: CronJob, error: Error) => void;
}
```

## Clock

### `Tick`

```typescript
interface Tick {
  ts: number;
  seq: number;
  reason: "interval" | "bridge" | "manual" | "catchup";
  drift?: number;
}
```

### `TickHandler`

```typescript
type TickHandler = (tick: Tick) => void | Promise<void>;
```

### `BackpressurePolicy`

```typescript
type BackpressurePolicy = "block" | "drop" | "adaptive";
```

### `TickStats`

```typescript
interface TickStats {
  tickCount: number;
  droppedTicks: number;
  errors: number;
  avgHandlerMs: number;
  avgDriftMs: number;
  lastTickAt: number;
  maxHandlerMs: number;
}
```

### `Clock`

```typescript
interface Clock {
  start(handler: TickHandler): void;
  stop(): void;
  now(): number;
  stats(): TickStats;
  readonly running: boolean;
  readonly seq: number;
}
```

### `IntervalClockOptions`

```typescript
interface IntervalClockOptions {
  intervalMs: number;
  backpressure?: BackpressurePolicy;
  maxCatchUpTicks?: number;
  onDriftWarning?: (driftMs: number) => void;
  onError?: (error: unknown) => void;
}
```

### `TestClock`

```typescript
interface TestClock extends Clock {
  tick(count?: number): Promise<void>;
  advanceBy(ms: number): Promise<void>;
  flush(): Promise<void>;
  reset(): void;
  readonly pendingTicks: number;
}
```

### `BridgeClock`

```typescript
interface BridgeClock extends Clock {
  push(reason?: string): void;
}
```

### `ClockSourceOptions`

```typescript
interface ClockSourceOptions<S extends BaseSignal> {
  clock: Clock;
  toSignal: (tick: Tick) => S;
  name?: string;
}
```
