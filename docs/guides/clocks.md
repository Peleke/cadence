# Clock System

Clocks are timing primitives that tick at a rate and invoke a handler. They are lower-level than sources — use `createClockSource` to adapt a clock into a `Source<S>` for the signal bus.

## Clock Interface

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

Every clock emits `Tick` objects:

```typescript
interface Tick {
  ts: number;    // Unix timestamp (ms)
  seq: number;   // Monotonic counter, 0-based
  reason: "interval" | "bridge" | "manual" | "catchup";
  drift?: number; // Ms from ideal fire time (interval clocks only)
}
```

## Interval Clock

Production timer using chained `setTimeout` (never `setInterval`). Supports three backpressure policies.

### Basic Usage

```typescript
import { createIntervalClock } from "@peleke.s/cadence";

const clock = createIntervalClock({ intervalMs: 1000 });

clock.start(async (tick) => {
  console.log(`Tick #${tick.seq} at ${tick.ts}`);
});

// Later:
clock.stop();
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `intervalMs` | `number` | — | Interval between ticks in milliseconds |
| `backpressure` | `BackpressurePolicy` | `"block"` | How to handle slow handlers |
| `maxCatchUpTicks` | `number` | `3` | Max catch-up ticks per cycle (drop/adaptive) |
| `onDriftWarning` | `(driftMs: number) => void` | — | Called when drift exceeds 80% of interval for 5+ ticks |
| `onError` | `(error: unknown) => void` | — | Called when handler throws |

### Backpressure Policies

#### Block (Default)

Fixed-delay scheduling. The next tick is scheduled after the handler completes plus `intervalMs`. This prevents spiral-of-death by construction — if the handler is slow, ticks simply space out.

```typescript
const clock = createIntervalClock({
  intervalMs: 1000,
  backpressure: "block",
});
```

#### Drop

Fixed-rate scheduling. Ticks fire on schedule regardless of handler duration. If the handler is still running when the next tick is due, that tick is dropped. Dropped ticks are counted in stats.

```typescript
const clock = createIntervalClock({
  intervalMs: 1000,
  backpressure: "drop",
});
```

After the handler finishes, the clock will fire catch-up ticks (up to `maxCatchUpTicks`) for any time that elapsed during the handler. If still behind after catch-up, remaining ticks are skipped to prevent spiral-of-death.

#### Adaptive

Fixed-rate with self-correction. An accumulator tracks overrun time, and the next delay is adjusted: `nextDelay = max(0, intervalMs - accumulated)`. Like drop, it fires catch-up ticks and clamps the accumulator to prevent runaway.

```typescript
const clock = createIntervalClock({
  intervalMs: 1000,
  backpressure: "adaptive",
});
```

### Observability

```typescript
const stats = clock.stats();
// {
//   tickCount: 100,
//   droppedTicks: 2,
//   errors: 0,
//   avgHandlerMs: 12.5,
//   avgDriftMs: 1.3,
//   lastTickAt: 1706900000000,
//   maxHandlerMs: 45,
// }
```

## Test Clock

Deterministic clock for testing. No real timers — you control time manually.

### Basic Usage

```typescript
import { createTestClock } from "@peleke.s/cadence";

const clock = createTestClock(1000); // 1s interval

const ticks: Tick[] = [];
clock.start((tick) => { ticks.push(tick); });

// Fire 3 ticks manually
await clock.tick(3);

console.log(ticks.length); // 3
console.log(clock.now());  // 3000 (virtual time)
console.log(clock.seq);    // 3
```

### API

| Method | Description |
|--------|-------------|
| `tick(count?)` | Fire `count` ticks (default: 1). Advances virtual time by `count * intervalMs`. |
| `advanceBy(ms)` | Advance virtual time by `ms`. Fires `Math.floor(ms / intervalMs)` ticks. Residual stays in accumulator. |
| `flush()` | Fire one tick for any remaining accumulator time. |
| `reset()` | Reset to t=0, seq=0, clear accumulator and stats. |
| `pendingTicks` | Number of whole ticks pending in the accumulator. |

### Key Properties

- `now()` returns virtual time, never `Date.now()`
- `start()` registers the handler but does NOT auto-tick
- No drift, no dropped ticks — every tick fires
- Handler errors are rethrown (not swallowed) so tests can catch them

### Testing Pattern

```typescript
import { createTestClock, createClockSource, type DefineSignals } from "@peleke.s/cadence";

type Signals = DefineSignals<{
  "heartbeat": { seq: number };
}>;

const clock = createTestClock(5000);
const source = createClockSource<Signals>({
  clock,
  toSignal: (tick) => ({
    type: "heartbeat",
    ts: tick.ts,
    id: `test-${tick.seq}`,
    payload: { seq: tick.seq },
  }),
});

const emitted: Signals[] = [];
await source.start(async (signal) => { emitted.push(signal); });

await clock.tick(3);
console.log(emitted.length); // 3
```

## Bridge Clock

Adapts external events into clock ticks. Each `push()` call produces one tick. No interval configuration — timing comes entirely from the external system.

### Basic Usage

```typescript
import { createBridgeClock } from "@peleke.s/cadence";

const clock = createBridgeClock();

clock.start(async (tick) => {
  console.log(`Bridge tick #${tick.seq} reason: ${tick.reason}`);
});

// Push ticks from an external system
clock.push();  // Tick #0
clock.push();  // Tick #1
```

### Integration Pattern

The bridge clock is designed for adapting external heartbeats or event loops:

```typescript
import { createBridgeClock, createClockSource } from "@peleke.s/cadence";

const bridge = createBridgeClock();
const source = createClockSource({
  clock: bridge,
  toSignal: (tick) => ({
    type: "external.heartbeat",
    ts: tick.ts,
    id: crypto.randomUUID(),
    payload: { seq: tick.seq },
  }),
});

await source.start((signal) => bus.emit(signal));

// In your external system's heartbeat callback:
externalSystem.on("heartbeat", () => {
  bridge.push();
});
```

### Key Properties

- Every `push()` = one tick with reason `"bridge"`
- `now()` returns `Date.now()` (real time)
- Never drops ticks — every push fires
- No drift concept — timing is external
- `push()` is a no-op if the clock is not running

## See Also

- [Sources](sources.md) — `createClockSource` adapter
- [Types Reference](../reference/types.md#clock) — `Clock`, `Tick`, `TickStats` definitions
