<div align="center">

# Cadence

### Typed event infrastructure for ambient AI agency

[![npm](https://img.shields.io/npm/v/@peleke.s/cadence?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@peleke.s/cadence)
[![CI](https://img.shields.io/github/actions/workflow/status/Peleke/cadence/ci.yml?branch=main&style=for-the-badge&logo=github&label=CI)](https://github.com/Peleke/cadence/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**The nervous system for AI agents that watch, notice, and act without being asked.**

<img src="assets/hero-banner.png" alt="Cadence - Typed event infrastructure for ambient AI agency" width="800"/>

> **RE: The art.** Yes, it's AI-generated. Looking for an actual artist to pay for a real logo. If you know someone good, [open an issue](https://github.com/Peleke/cadence/issues).

</div>

---

## The Problem

Most AI agents are request-response: you ask, they answer. But staff members don't wait to be asked — they notice things and bring them to you.

Cadence closes that gap. It enables **ambient agency**: agents that observe file changes, webhook events, scheduled triggers, and act autonomously based on what they see.

## Installation

```bash
npm install @peleke.s/cadence
# or
pnpm add @peleke.s/cadence
```

## Quick Start

```typescript
import { createSignalBus, createFileWatcherSource, type DefineSignals } from "@peleke.s/cadence";

// Define your signal types
type MySignals = DefineSignals<{
  "file.changed": { path: string; event: "add" | "change" | "unlink" };
  "task.found": { file: string; task: string; done: boolean };
}>;

// Create a bus
const bus = createSignalBus<MySignals>();

// Subscribe to signals
bus.on("file.changed", async (signal) => {
  console.log(`File ${signal.payload.event}: ${signal.payload.path}`);
});

// Create a source
const watcher = createFileWatcherSource<MySignals>({
  paths: ["./notes"],
  toSignal: (event) => ({
    type: "file.changed",
    ts: Date.now(),
    id: crypto.randomUUID(),
    payload: { path: event.path, event: event.type },
  }),
});

// Start watching
await watcher.start((signal) => bus.emit(signal));
```

## Architecture

Cadence is built with pluggable interfaces:

| Interface | Purpose | Default |
|-----------|---------|---------|
| **Transport** | How signals move | `MemoryTransport` (in-process) |
| **Store** | Durability layer | `NoopStore` (no persistence) |
| **Executor** | Handler concurrency | `SequentialExecutor` |

Build for the sophisticated case, implement simple defaults.

```typescript
import {
  createSignalBus,
  createMemoryTransport,
  createNoopStore,
  createSequentialExecutor
} from "@peleke.s/cadence";

// Explicit configuration (these are the defaults)
const bus = createSignalBus<MySignals>({
  transport: createMemoryTransport(),
  store: createNoopStore(),
  executor: createSequentialExecutor(),
});
```

## Features

- **Type-safe signals** — `DefineSignals<M>` creates discriminated unions
- **Middleware** — Transform, filter, or log signals before handlers
- **Signal replay** — Replay unacked signals from store on restart
- **Pluggable everything** — Swap transport, store, executor as needed
- **File watcher source** — Built-in chokidar integration

## Use Cases

- **Ambient Obsidian agent** — Watch your vault, extract tasks, act on them
- **PR delegate** — Watch journals, cluster insights, draft social posts
- **Proactive pair programmer** — Watch code changes, surface forgotten TODOs
- **Multi-agent coordination** — Agents communicate via signal emission

## API

### `createSignalBus<S>(options?)`

Create a signal bus with optional pluggable components.

```typescript
const bus = createSignalBus<MySignals>();

bus.on("file.changed", handler);     // Subscribe to specific type
bus.onAny(handler);                   // Subscribe to all signals
bus.use(middleware);                  // Add middleware
bus.emit(signal);                     // Emit a signal
bus.clear();                          // Remove all handlers
bus.stats();                          // Get bus statistics
bus.replay();                         // Replay unacked signals from store
```

### `createFileWatcherSource<S>(options)`

Create a file watcher that emits signals on file changes.

```typescript
const watcher = createFileWatcherSource<MySignals>({
  paths: ["./notes", "./tasks"],
  toSignal: (event) => ({ /* map to your signal type */ }),
  chokidarOptions: { /* optional chokidar config */ },
});

await watcher.start(emitFn);
await watcher.stop();
```

## License

MIT License. See [LICENSE](./LICENSE).
