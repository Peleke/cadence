import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFileWatcherSource, type FileEvent } from "./file-watcher.js";
import type { BaseSignal, DefineSignals } from "../types.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

type TestSignals = DefineSignals<{
  "file.changed": { path: string; event: "add" | "change" | "unlink" };
}>;

function toSignal(event: FileEvent): TestSignals {
  return {
    type: "file.changed",
    ts: event.ts,
    id: crypto.randomUUID(),
    payload: { path: event.path, event: event.type },
  };
}

describe("FileWatcherSource", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("emits signal when file is added", async () => {
    const emitted: TestSignals[] = [];
    const emit = vi.fn(async (signal: TestSignals) => {
      emitted.push(signal);
    });

    const source = createFileWatcherSource<TestSignals>({
      paths: tmpDir,
      toSignal,
    });

    await source.start(emit);

    // Create a file
    const filePath = path.join(tmpDir, "test.txt");
    await fs.writeFile(filePath, "hello");

    // Wait for event to propagate
    await new Promise((r) => setTimeout(r, 100));

    await source.stop();

    expect(emitted.length).toBeGreaterThanOrEqual(1);
    expect(emitted[0]?.type).toBe("file.changed");
    expect(emitted[0]?.payload.event).toBe("add");
    expect(emitted[0]?.payload.path).toBe(filePath);
  });

  it("emits signal when file is changed", async () => {
    // Create file before watching
    const filePath = path.join(tmpDir, "existing.txt");
    await fs.writeFile(filePath, "initial");

    const emitted: TestSignals[] = [];
    const emit = vi.fn(async (signal: TestSignals) => {
      emitted.push(signal);
    });

    const source = createFileWatcherSource<TestSignals>({
      paths: tmpDir,
      toSignal,
    });

    await source.start(emit);

    // Modify the file
    await fs.writeFile(filePath, "updated");

    // Wait for event to propagate
    await new Promise((r) => setTimeout(r, 100));

    await source.stop();

    const changeEvents = emitted.filter((s) => s.payload.event === "change");
    expect(changeEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("emits signal when file is deleted", async () => {
    // Create file before watching
    const filePath = path.join(tmpDir, "to-delete.txt");
    await fs.writeFile(filePath, "goodbye");

    const emitted: TestSignals[] = [];
    const emit = vi.fn(async (signal: TestSignals) => {
      emitted.push(signal);
    });

    const source = createFileWatcherSource<TestSignals>({
      paths: tmpDir,
      toSignal,
    });

    await source.start(emit);

    // Delete the file
    await fs.unlink(filePath);

    // Wait for event to propagate (unlink can be slower)
    await new Promise((r) => setTimeout(r, 200));

    await source.stop();

    const unlinkEvents = emitted.filter((s) => s.payload.event === "unlink");
    expect(unlinkEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("filters events by type", async () => {
    const emitted: TestSignals[] = [];
    const emit = vi.fn(async (signal: TestSignals) => {
      emitted.push(signal);
    });

    const source = createFileWatcherSource<TestSignals>({
      paths: tmpDir,
      events: ["change"], // Only listen for changes
      toSignal,
    });

    await source.start(emit);

    // Create a file (should not emit)
    const filePath = path.join(tmpDir, "test.txt");
    await fs.writeFile(filePath, "hello");

    // Wait
    await new Promise((r) => setTimeout(r, 100));

    await source.stop();

    // Should not have emitted for "add"
    const addEvents = emitted.filter((s) => s.payload.event === "add");
    expect(addEvents.length).toBe(0);
  });

  it("skips signal when toSignal returns null", async () => {
    const emitted: TestSignals[] = [];
    const emit = vi.fn(async (signal: TestSignals) => {
      emitted.push(signal);
    });

    const source = createFileWatcherSource<TestSignals>({
      paths: tmpDir,
      toSignal: (event) => {
        // Skip .tmp files
        if (event.path.endsWith(".tmp")) return null;
        return toSignal(event);
      },
    });

    await source.start(emit);

    // Create a .tmp file (should be skipped)
    await fs.writeFile(path.join(tmpDir, "test.tmp"), "temp");

    // Create a .txt file (should emit)
    await fs.writeFile(path.join(tmpDir, "test.txt"), "real");

    // Wait
    await new Promise((r) => setTimeout(r, 100));

    await source.stop();

    // Should only have emitted for .txt
    expect(emitted.every((s) => s.payload.path.endsWith(".txt"))).toBe(true);
  });

  it("throws if started twice", async () => {
    const source = createFileWatcherSource<TestSignals>({
      paths: tmpDir,
      toSignal,
    });

    await source.start(async () => {});

    await expect(source.start(async () => {})).rejects.toThrow(
      "FileWatcherSource already started",
    );

    await source.stop();
  });

  it("stop is idempotent", async () => {
    const source = createFileWatcherSource<TestSignals>({
      paths: tmpDir,
      toSignal,
    });

    await source.start(async () => {});
    await source.stop();
    await source.stop(); // Should not throw
  });
});
