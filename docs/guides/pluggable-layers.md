# Pluggable Layers

Cadence's bus delegates three concerns to pluggable interfaces: how signals move (transport), how signals are persisted (store), and how handlers are executed (executor). Each has a default implementation and can be swapped independently.

## Transport

The transport controls how signals move from emitter to subscribers.

### Interface

```typescript
interface Transport<S extends BaseSignal> {
  emit(signal: S): Promise<void>;
  subscribe(handler: AnySignalHandler<S>): () => void;
}
```

### Default: Memory Transport

Synchronous in-process delivery. All subscribers are called in the same event loop tick as the emitter.

```typescript
import { createMemoryTransport } from "@peleke.s/cadence";

const transport = createMemoryTransport<MySignals>();
```

### Custom Transport

Replace with Redis, WebSocket, HTTP, or any other delivery mechanism:

```typescript
const redisTransport: Transport<MySignals> = {
  async emit(signal) {
    await redis.publish("signals", JSON.stringify(signal));
  },
  subscribe(handler) {
    const sub = redis.subscribe("signals", (msg) => {
      handler(JSON.parse(msg));
    });
    return () => sub.unsubscribe();
  },
};

const bus = createSignalBus<MySignals>({ transport: redisTransport });
```

## Store

The store provides persistence for durability and signal replay.

### Interface

```typescript
interface SignalStore<S extends BaseSignal> {
  save(signal: S): Promise<void>;
  markAcked(signalId: string): Promise<void>;
  getUnacked(): Promise<S[]>;
}
```

The bus calls `save()` before processing, `markAcked()` after successful processing, and `getUnacked()` during `replay()`.

### Default: Noop Store

No persistence. Signals are not saved, `getUnacked()` always returns `[]`, and `replay()` is a no-op.

```typescript
import { createNoopStore } from "@peleke.s/cadence";

const store = createNoopStore<MySignals>();
```

### Custom Store

```typescript
const sqliteStore: SignalStore<MySignals> = {
  async save(signal) {
    await db.insert("signals", { id: signal.id, data: JSON.stringify(signal), acked: false });
  },
  async markAcked(signalId) {
    await db.update("signals", { acked: true }, { id: signalId });
  },
  async getUnacked() {
    const rows = await db.select("signals", { acked: false });
    return rows.map((r) => JSON.parse(r.data));
  },
};

const bus = createSignalBus<MySignals>({ store: sqliteStore });

// On restart, replay missed signals:
const count = await bus.replay();
console.log(`Replayed ${count} signals`);
```

## Executor

The executor controls handler concurrency — how handlers are invoked.

### Interface

```typescript
interface HandlerExecutor<S extends BaseSignal> {
  execute(handler: AnySignalHandler<S>, signal: S): Promise<void>;
  stats(): { queued: number; processing: number };
}
```

### Default: Sequential Executor

Handlers run one at a time, in order. Each handler completes before the next starts.

```typescript
import { createSequentialExecutor } from "@peleke.s/cadence";

const executor = createSequentialExecutor<MySignals>();
```

### Custom Executor

```typescript
const concurrentExecutor: HandlerExecutor<MySignals> = {
  async execute(handler, signal) {
    // Fire and forget — handlers run concurrently
    handler(signal).catch(console.error);
  },
  stats() {
    return { queued: 0, processing: 0 };
  },
};

const bus = createSignalBus<MySignals>({ executor: concurrentExecutor });
```

## Composition Example

Combine all three for a durable, distributed setup:

```typescript
const bus = createSignalBus<MySignals>({
  transport: createRedisTransport(),
  store: createSqliteStore("./signals.db"),
  executor: createSequentialExecutor(),
  onError: (signal, handler, err) => {
    logger.error({ signal: signal.type, handler, err }, "Handler failed");
  },
});
```

## See Also

- [Signal Bus](signal-bus.md) — bus usage, middleware, replay
- [Types Reference](../reference/types.md#transport) — full interface definitions
