/**
 * File watcher source — emits signals when files change.
 *
 * Uses chokidar under the hood. The consumer provides a `toSignal` function
 * to transform file events into their signal type.
 */

import { watch, type FSWatcher } from "chokidar";
import type { BaseSignal, Source } from "../types.js";

export type FileEventType = "add" | "change" | "unlink";

export interface FileEvent {
  /** Event type */
  type: FileEventType;
  /** Absolute path to the file */
  path: string;
  /** Timestamp when event occurred */
  ts: number;
}

export interface FileWatcherOptions<S extends BaseSignal> {
  /** Paths to watch (files or directories) */
  paths: string | string[];
  /** Event types to listen for (default: all) */
  events?: FileEventType[];
  /** Transform a file event into a signal (return null to skip) */
  toSignal: (event: FileEvent) => S | null;
  /** Chokidar options */
  chokidar?: {
    /** Ignore patterns */
    ignored?: string | RegExp | ((path: string) => boolean);
    /** Use polling (for network drives, etc.) */
    usePolling?: boolean;
    /** Polling interval in ms */
    interval?: number;
    /** Ignore initial add events */
    ignoreInitial?: boolean;
    /** Stabilization delay for change events */
    awaitWriteFinish?: boolean | { stabilityThreshold?: number; pollInterval?: number };
  };
}

export function createFileWatcherSource<S extends BaseSignal>(
  options: FileWatcherOptions<S>,
): Source<S> {
  const {
    paths,
    events = ["add", "change", "unlink"],
    toSignal,
    chokidar: chokidarOpts = {},
  } = options;

  let watcher: FSWatcher | null = null;
  let emitFn: ((signal: S) => Promise<void>) | null = null;

  const handleEvent = (type: FileEventType) => async (path: string) => {
    if (!emitFn) return;
    if (!events.includes(type)) return;

    const event: FileEvent = { type, path, ts: Date.now() };
    const signal = toSignal(event);

    if (signal) {
      await emitFn(signal);
    }
  };

  async function start(emit: (signal: S) => Promise<void>): Promise<void> {
    if (watcher) {
      throw new Error("FileWatcherSource already started");
    }

    emitFn = emit;

    watcher = watch(paths, {
      ignoreInitial: chokidarOpts.ignoreInitial ?? true,
      ignored: chokidarOpts.ignored,
      usePolling: chokidarOpts.usePolling,
      interval: chokidarOpts.interval,
      awaitWriteFinish: chokidarOpts.awaitWriteFinish,
    });

    // Bind event handlers
    if (events.includes("add")) {
      watcher.on("add", handleEvent("add"));
    }
    if (events.includes("change")) {
      watcher.on("change", handleEvent("change"));
    }
    if (events.includes("unlink")) {
      watcher.on("unlink", handleEvent("unlink"));
    }

    // Wait for watcher to be ready
    await new Promise<void>((resolve) => {
      watcher!.on("ready", resolve);
    });
  }

  async function stop(): Promise<void> {
    if (watcher) {
      await watcher.close();
      watcher = null;
      emitFn = null;
    }
  }

  return {
    name: "file-watcher",
    start,
    stop,
  };
}
