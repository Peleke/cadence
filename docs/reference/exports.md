# API Exports

Everything exported from `@peleke.s/cadence`:

```typescript
import {
  // Bus
  createSignalBus,

  // Transport
  createMemoryTransport,

  // Store
  createNoopStore,

  // Executor
  createSequentialExecutor,

  // Sources
  createFileWatcherSource,
  createCronSource,
  getNextRun,
  isValidCronExpr,

  // Clocks
  createIntervalClock,
  createTestClock,
  createBridgeClock,
  createClockSource,
} from "@peleke.s/cadence";
```

## Functions

| Function | Module | Description |
|----------|--------|-------------|
| `createSignalBus<S>(options?)` | bus | Create a typed signal bus |
| `createMemoryTransport<S>()` | transport | Create an in-memory transport |
| `createNoopStore<S>()` | store | Create a no-op (non-persisting) store |
| `createSequentialExecutor<S>()` | executor | Create a sequential handler executor |
| `createFileWatcherSource<S>(options)` | sources | Create a file-watching signal source |
| `createCronSource<S>(options)` | sources | Create a cron-scheduled signal source |
| `getNextRun(expr, tz?)` | sources | Get next run time for a cron expression |
| `isValidCronExpr(expr)` | sources | Validate a cron expression |
| `createIntervalClock(options)` | clock | Create a production interval clock |
| `createTestClock(intervalMs?)` | clock | Create a deterministic test clock |
| `createBridgeClock()` | clock | Create an external-event-driven clock |
| `createClockSource<S>(options)` | clock | Adapt a Clock into a Source |

## Types

| Type | Module | Description |
|------|--------|-------------|
| `BaseSignal<T, P>` | types | Base signal shape |
| `DefineSignals<M>` | types | Signal definition helper |
| `SignalPayload<S, T>` | types | Extract payload type |
| `SignalHandler<S, T>` | types | Type-specific handler |
| `AnySignalHandler<S>` | types | Handler for all signals |
| `Middleware<S>` | types | Middleware function |
| `BusStats` | types | Bus statistics |
| `Transport<S>` | types | Transport interface |
| `SignalStore<S>` | types | Store interface |
| `HandlerExecutor<S>` | types | Executor interface |
| `Source<S>` | types | Signal source interface |
| `SignalBus<S>` | bus | Bus interface |
| `SignalBusOptions<S>` | bus | Bus configuration |
| `FileEvent` | sources | File system event |
| `FileEventType` | sources | `"add" \| "change" \| "unlink"` |
| `FileWatcherOptions<S>` | sources | File watcher configuration |
| `CronJob` | sources | Cron job definition |
| `CronSourceOptions<S>` | sources | Cron source configuration |
| `Tick` | clock | Single clock event |
| `TickHandler` | clock | Clock tick handler |
| `BackpressurePolicy` | clock | `"block" \| "drop" \| "adaptive"` |
| `TickStats` | clock | Clock statistics |
| `Clock` | clock | Core clock interface |
| `IntervalClockOptions` | clock | Interval clock configuration |
| `TestClock` | clock | Extended clock for testing |
| `BridgeClock` | clock | Extended clock for external events |
| `ClockSourceOptions<S>` | clock | Clock-to-source adapter configuration |
