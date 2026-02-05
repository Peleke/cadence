# Signal Bus

The signal bus is the core of Cadence. It coordinates signal routing, middleware, persistence, and handler execution.

## Creating a Bus

```typescript
import { createSignalBus, type DefineSignals } from "@peleke.s/cadence";

type MySignals = DefineSignals<{
  "file.changed": { path: string };
  "task.created": { title: string; assignee: string };
}>;

const bus = createSignalBus<MySignals>();
```

All options are optional — defaults provide in-memory transport, no persistence, and sequential execution:

```typescript
import {
  createSignalBus,
  createMemoryTransport,
  createNoopStore,
  createSequentialExecutor,
} from "@peleke.s/cadence";

// These are the defaults (shown explicitly)
const bus = createSignalBus<MySignals>({
  transport: createMemoryTransport(),
  store: createNoopStore(),
  executor: createSequentialExecutor(),
  onError: (signal, handlerName, error) => {
    console.error(`Handler ${handlerName} failed on ${signal.type}:`, error);
  },
});
```

## Subscribing to Signals

### Type-Specific Handlers

Subscribe to a specific signal type. The handler receives only signals matching that type, with full type narrowing:

```typescript
bus.on("file.changed", async (signal) => {
  // signal.payload is { path: string } — fully typed
  console.log(signal.payload.path);
});
```

The return value is an unsubscribe function:

```typescript
const unsub = bus.on("task.created", handler);
// Later:
unsub();
```

### Any Handlers

Subscribe to all signals regardless of type:

```typescript
bus.onAny(async (signal) => {
  console.log(`[${signal.type}] ${JSON.stringify(signal.payload)}`);
});
```

## Emitting Signals

```typescript
await bus.emit({
  type: "task.created",
  ts: Date.now(),
  id: crypto.randomUUID(),
  payload: { title: "Review PR", assignee: "alice" },
});
```

The emit flow:

1. Signal saved to store (for durability)
2. Signal dispatched through transport
3. Middleware chain runs (if any)
4. Type-specific handlers execute
5. Any-handlers execute
6. Signal marked as acknowledged in store

## Middleware

Middleware runs before handlers. It receives the signal and a `next()` function:

```typescript
// Logging middleware
bus.use(async (signal, next) => {
  console.log(`→ ${signal.type}`);
  await next();
  console.log(`← ${signal.type}`);
});

// Filtering middleware (skip signals by returning without calling next)
bus.use(async (signal, next) => {
  if (signal.type === "file.changed" && signal.payload.path.endsWith(".tmp")) {
    return; // Drop temp file signals
  }
  await next();
});

// Enrichment middleware
bus.use(async (signal, next) => {
  signal.source = signal.source ?? "default";
  await next();
});
```

Middleware runs in registration order. The last middleware's `next()` invokes the handlers.

## Signal Replay

If you provide a store that persists signals, you can replay unacknowledged signals on restart:

```typescript
const replayed = await bus.replay();
console.log(`Replayed ${replayed} signals`);
```

This fetches all unacked signals from the store, re-emits them through the transport, and marks them as acknowledged.

## Statistics

Monitor bus activity:

```typescript
const stats = bus.stats();
// {
//   emitted: 42,
//   handled: 38,
//   errors: 2,
//   handlers: 3,
//   anyHandlers: 1,
//   middleware: 2,
// }
```

## Error Handling

Handler errors are caught by the bus and passed to the `onError` callback. They do not crash the bus or prevent other handlers from running:

```typescript
const bus = createSignalBus<MySignals>({
  onError: (signal, handlerName, error) => {
    // handlerName is "type:file.changed" or "any:0"
    console.error(`Error in ${handlerName}:`, error);
  },
});
```

## Cleanup

Remove all handlers and middleware:

```typescript
bus.clear();
```

## See Also

- [Core Concepts](../getting-started/concepts.md) — architecture overview
- [Pluggable Layers](pluggable-layers.md) — custom transport, store, executor
- [Types Reference](../reference/types.md#signalbus) — full interface definitions
