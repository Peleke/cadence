# Sources

Sources produce signals from external events. Every source implements the `Source<S>` interface and follows the `toSignal` pattern — you provide a function that transforms raw events into your signal types.

## Source Interface

```typescript
interface Source<S extends BaseSignal> {
  name: string;
  start(emit: (signal: S) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}
```

Call `start()` with an emit function (typically `(signal) => bus.emit(signal)`), and the source begins producing signals. Call `stop()` to shut it down.

## File Watcher

Watch the file system for changes using [chokidar](https://github.com/paulmillr/chokidar).

### Basic Usage

```typescript
import { createFileWatcherSource, type DefineSignals } from "@peleke.s/cadence";

type Signals = DefineSignals<{
  "file.changed": { path: string; event: "add" | "change" | "unlink" };
}>;

const watcher = createFileWatcherSource<Signals>({
  paths: ["./notes", "./tasks"],
  toSignal: (event) => ({
    type: "file.changed",
    ts: Date.now(),
    id: crypto.randomUUID(),
    payload: { path: event.path, event: event.type },
  }),
});

await watcher.start((signal) => bus.emit(signal));
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `paths` | `string \| string[]` | — | Paths to watch (files or directories) |
| `events` | `FileEventType[]` | `["add", "change", "unlink"]` | Event types to listen for |
| `toSignal` | `(event: FileEvent) => S \| null` | — | Transform file events into signals. Return `null` to skip. |
| `chokidar` | object | `{}` | Chokidar options (see below) |

### Chokidar Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ignored` | `string \| RegExp \| function` | — | Paths to ignore |
| `usePolling` | `boolean` | `false` | Use polling (for network drives) |
| `interval` | `number` | — | Polling interval in ms |
| `ignoreInitial` | `boolean` | `true` | Skip initial add events |
| `awaitWriteFinish` | `boolean \| object` | — | Wait for writes to finish |

### Filtering Events

Return `null` from `toSignal` to skip an event:

```typescript
const watcher = createFileWatcherSource<Signals>({
  paths: ["./src"],
  events: ["change"], // Only watch changes, not add/unlink
  toSignal: (event) => {
    // Skip non-TypeScript files
    if (!event.path.endsWith(".ts")) return null;

    return {
      type: "file.changed",
      ts: event.ts,
      id: crypto.randomUUID(),
      payload: { path: event.path, event: event.type },
    };
  },
});
```

### FileEvent Shape

```typescript
interface FileEvent {
  type: "add" | "change" | "unlink";
  path: string; // Absolute path
  ts: number;   // Timestamp when event occurred
}
```

## Cron Source

Schedule signal emission using cron expressions. Uses [croner](https://github.com/hexagon/croner) — lightweight, timezone-aware, no native dependencies.

### Basic Usage

```typescript
import { createCronSource, type DefineSignals } from "@peleke.s/cadence";

type Signals = DefineSignals<{
  "cron.fired": { jobId: string; jobName: string };
}>;

const cron = createCronSource<Signals>({
  jobs: [
    { id: "morning", name: "Morning Check", expr: "0 8 * * *", tz: "America/New_York" },
    { id: "evening", name: "Evening Digest", expr: "0 18 * * *", tz: "America/New_York" },
  ],
  toSignal: (job, firedAt) => ({
    type: "cron.fired",
    ts: firedAt,
    id: crypto.randomUUID(),
    payload: { jobId: job.id, jobName: job.name },
  }),
});

await cron.start((signal) => bus.emit(signal));
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `jobs` | `CronJob[]` | — | Jobs to schedule |
| `toSignal` | `(job: CronJob, firedAt: number) => S` | — | Create a signal when a job fires |
| `onFire` | `(job: CronJob) => void` | — | Called when a job fires (logging) |
| `onError` | `(job: CronJob, error: Error) => void` | — | Called on cron parse error |

### CronJob Shape

```typescript
interface CronJob {
  id: string;       // Unique job identifier
  name: string;     // Human-readable name
  expr: string;     // Cron expression (e.g., "0 8 * * *")
  tz?: string;      // Timezone (e.g., "America/New_York")
  enabled?: boolean; // Default: true
}
```

### Utility Functions

```typescript
import { getNextRun, isValidCronExpr } from "@peleke.s/cadence";

// Check next run time
const next = getNextRun("0 8 * * *", "America/New_York");
console.log(next); // Date object or null if invalid

// Validate an expression
isValidCronExpr("0 8 * * *"); // true
isValidCronExpr("not valid");  // false
```

## Clock Source Adapter

Convert any `Clock` into a `Source<S>` using `createClockSource`:

```typescript
import { createIntervalClock, createClockSource, type DefineSignals } from "@peleke.s/cadence";

type Signals = DefineSignals<{
  "heartbeat": { seq: number };
}>;

const clock = createIntervalClock({ intervalMs: 5000 });

const source = createClockSource<Signals>({
  clock,
  toSignal: (tick) => ({
    type: "heartbeat",
    ts: tick.ts,
    id: crypto.randomUUID(),
    payload: { seq: tick.seq },
  }),
});

await source.start((signal) => bus.emit(signal));
```

This follows the same `toSignal` pattern as file watcher and cron sources, keeping the API consistent.

## See Also

- [Clock System](clocks.md) — interval, test, and bridge clocks
- [Signal Bus](signal-bus.md) — connecting sources to the bus
- [Types Reference](../reference/types.md#source) — `Source`, `FileEvent`, `CronJob` definitions
