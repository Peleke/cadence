# Cadence

**Typed event infrastructure for ambient AI agency.**

Cadence is the nervous system for AI agents that watch, notice, and act without being asked. It provides a lightweight, typed pub/sub bus with pluggable transports, persistence, and execution strategies.

## The Problem

Most AI agents are request-response: you ask, they answer. But staff members don't wait to be asked — they notice things and bring them to you.

Cadence closes that gap. It enables **ambient agency**: agents that observe file changes, webhook events, scheduled triggers, and act autonomously based on what they see.

## Installation

```bash
npm install @pelekes/cadence
# or
pnpm add @pelekes/cadence
```

## Quick Start

```typescript
import { createSignalBus, defineSignals, createFileWatcherSource } from "@pelekes/cadence";

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
await watcher.start(bus);
```

## Architecture

Cadence is built with pluggable interfaces:

- **Transport** — How signals move (in-memory, Redis, HTTP bridge)
- **Store** — Durability layer (none, SQLite, Redis)
- **Executor** — Handler concurrency (sequential, concurrent with limits)

Build for the sophisticated case, implement simple defaults.

## Use Cases

- **Ambient Obsidian agent** — Watch your vault, extract tasks, act on them
- **PR delegate** — Watch journals, cluster insights, draft social posts
- **Proactive pair programmer** — Watch code changes, surface forgotten TODOs
- **Multi-agent coordination** — Agents communicate via signal emission

## License

MIT
