# Cadence

**Typed event infrastructure for ambient AI agency.**

Cadence is the nervous system for AI agents that watch, notice, and act without being asked. It provides a type-safe signal bus with pluggable transport, persistence, and execution layers.

## Features

- **Type-safe signals** — `DefineSignals<M>` creates discriminated unions from a simple map
- **Pluggable architecture** — Swap transport, store, and executor independently
- **Built-in sources** — File watcher (chokidar) and cron scheduler (croner) out of the box
- **Clock system** — Interval, test, and bridge clocks with backpressure policies
- **Middleware** — Transform, filter, or log signals before handlers run
- **Signal replay** — Replay unacknowledged signals from store on restart

## Quick Install

```bash
pnpm add @peleke.s/cadence
```

## Quick Example

```typescript
import {
  createSignalBus,
  createFileWatcherSource,
  type DefineSignals,
} from "@peleke.s/cadence";

// 1. Define your signal types
type Signals = DefineSignals<{
  "file.changed": { path: string; event: "add" | "change" | "unlink" };
}>;

// 2. Create a bus
const bus = createSignalBus<Signals>();

// 3. Subscribe to signals
bus.on("file.changed", async (signal) => {
  console.log(`${signal.payload.event}: ${signal.payload.path}`);
});

// 4. Create a source and connect it
const watcher = createFileWatcherSource<Signals>({
  paths: ["./notes"],
  toSignal: (event) => ({
    type: "file.changed",
    ts: Date.now(),
    id: crypto.randomUUID(),
    payload: { path: event.path, event: event.type },
  }),
});

await watcher.start((signal) => bus.emit(signal));
```

## Next Steps

- [Installation](getting-started/installation.md) — prerequisites and setup
- [Quick Start](getting-started/quickstart.md) — build a working example in 5 minutes
- [Core Concepts](getting-started/concepts.md) — understand the architecture
