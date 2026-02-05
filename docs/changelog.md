# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-03

### Added

- Core signal bus with typed pub/sub (`createSignalBus`)
- `DefineSignals<M>` helper for type-safe signal definitions
- Pluggable architecture:
  - `Transport` interface (default: `MemoryTransport`)
  - `SignalStore` interface (default: `NoopStore`)
  - `HandlerExecutor` interface (default: `SequentialExecutor`)
- Middleware support (`bus.use()`)
- Signal replay from store (`bus.replay()`)
- File watcher source (`createFileWatcherSource`)
- Cron source (`createCronSource`) with timezone support
- Clock system:
  - `IntervalClock` with block/drop/adaptive backpressure
  - `TestClock` for deterministic testing
  - `BridgeClock` for external event adaptation
  - `ClockSource` adapter (Clock → Source)
- Full test suite (97% coverage)
