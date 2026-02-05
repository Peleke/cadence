# Quick Start

Build a file-watching signal pipeline in under 5 minutes.

## Step 1: Define your signals

Every Cadence project starts by defining signal types. Use `DefineSignals` to create a type-safe union from a simple map:

```typescript
import { type DefineSignals } from "@peleke.s/cadence";

type MySignals = DefineSignals<{
  "file.changed": { path: string; event: "add" | "change" | "unlink" };
  "task.found": { file: string; line: number; text: string };
}>;
```

Each key becomes a signal `type`, each value becomes the `payload` shape. TypeScript enforces this everywhere.

## Step 2: Create a bus and subscribe

```typescript
import { createSignalBus } from "@peleke.s/cadence";

const bus = createSignalBus<MySignals>();

// Type-specific handler — only receives "file.changed" signals
bus.on("file.changed", async (signal) => {
  console.log(`[${signal.payload.event}] ${signal.payload.path}`);
});

// Any-handler — receives all signals
bus.onAny(async (signal) => {
  console.log(`Signal: ${signal.type} at ${new Date(signal.ts).toISOString()}`);
});
```

## Step 3: Create a source and connect it

Sources produce signals from external events. Connect them to the bus with `start()`:

```typescript
import { createFileWatcherSource } from "@peleke.s/cadence";

const watcher = createFileWatcherSource<MySignals>({
  paths: ["./notes"],
  toSignal: (event) => ({
    type: "file.changed",
    ts: Date.now(),
    id: crypto.randomUUID(),
    payload: { path: event.path, event: event.type },
  }),
});

// Start watching — file changes flow through the bus to your handlers
await watcher.start((signal) => bus.emit(signal));
```

## Complete Example

```typescript
import {
  createSignalBus,
  createFileWatcherSource,
  type DefineSignals,
} from "@peleke.s/cadence";

type MySignals = DefineSignals<{
  "file.changed": { path: string; event: "add" | "change" | "unlink" };
}>;

const bus = createSignalBus<MySignals>();

bus.on("file.changed", async (signal) => {
  console.log(`[${signal.payload.event}] ${signal.payload.path}`);
});

const watcher = createFileWatcherSource<MySignals>({
  paths: ["./notes"],
  toSignal: (event) => ({
    type: "file.changed",
    ts: Date.now(),
    id: crypto.randomUUID(),
    payload: { path: event.path, event: event.type },
  }),
});

await watcher.start((signal) => bus.emit(signal));

// Now modify a file in ./notes and watch the console
```

## What's Next?

- [Core Concepts](concepts.md) — understand the pluggable architecture
- [Signal Bus Guide](../guides/signal-bus.md) — middleware, replay, error handling
- [Sources Guide](../guides/sources.md) — file watcher and cron scheduling
- [Clock System Guide](../guides/clocks.md) — interval timers, testing, and bridging
