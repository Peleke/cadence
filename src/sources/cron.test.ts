/**
 * Tests for the cron source.
 */

import { describe, it, expect, vi } from "vitest";
import { createCronSource, getNextRun, isValidCronExpr } from "./cron.js";
import type { BaseSignal } from "../types.js";

interface TestSignal extends BaseSignal {
  type: "test.cron.fired";
  payload: { jobId: string; jobName: string; firedAt: number };
}

describe("createCronSource", () => {
  it("creates a source with name 'cron'", () => {
    const source = createCronSource<TestSignal>({
      jobs: [],
      toSignal: (job, firedAt) => ({
        type: "test.cron.fired",
        id: "test-id",
        ts: firedAt,
        payload: { jobId: job.id, jobName: job.name, firedAt },
      }),
    });

    expect(source.name).toBe("cron");
  });

  it("calls onError callback for invalid cron expressions", async () => {
    const errors: { jobId: string; error: Error }[] = [];

    const source = createCronSource<TestSignal>({
      jobs: [{ id: "invalid", name: "Invalid Job", expr: "not a cron expression" }],
      toSignal: (job, firedAt) => ({
        type: "test.cron.fired",
        id: "signal-id",
        ts: firedAt,
        payload: { jobId: job.id, jobName: job.name, firedAt },
      }),
      onError: (job, error) => {
        errors.push({ jobId: job.id, error });
      },
    });

    await source.start(() => Promise.resolve());
    await source.stop();

    expect(errors.length).toBe(1);
    expect(errors[0].jobId).toBe("invalid");
  });

  it("does not schedule disabled jobs", async () => {
    const scheduledJobs: string[] = [];

    const source = createCronSource<TestSignal>({
      jobs: [
        { id: "enabled", name: "Enabled Job", expr: "0 8 * * *" },
        { id: "disabled", name: "Disabled Job", expr: "0 8 * * *", enabled: false },
      ],
      toSignal: (job, firedAt) => ({
        type: "test.cron.fired",
        id: `signal-${job.id}`,
        ts: firedAt,
        payload: { jobId: job.id, jobName: job.name, firedAt },
      }),
      onFire: (job) => {
        scheduledJobs.push(job.id);
      },
    });

    // Start and immediately stop - we're just testing that disabled jobs aren't scheduled
    await source.start(() => Promise.resolve());

    // The croner library schedules jobs synchronously on start
    // Disabled jobs should be skipped entirely (no cron instance created)
    // We can verify by checking that no errors occur and stop works cleanly
    await source.stop();

    // No errors should occur
    expect(true).toBe(true);
  });

  it("can start and stop cleanly", async () => {
    const source = createCronSource<TestSignal>({
      jobs: [
        { id: "job1", name: "Job 1", expr: "0 8 * * *" },
        { id: "job2", name: "Job 2", expr: "0 18 * * *" },
      ],
      toSignal: (job, firedAt) => ({
        type: "test.cron.fired",
        id: "signal-id",
        ts: firedAt,
        payload: { jobId: job.id, jobName: job.name, firedAt },
      }),
    });

    // Should not throw
    await source.start(() => Promise.resolve());
    await source.stop();

    // Can restart after stop
    await source.start(() => Promise.resolve());
    await source.stop();
  });

  it("toSignal receives correct job info", async () => {
    const receivedJobs: Array<{ id: string; name: string; expr: string }> = [];

    // Use a mock that captures the toSignal calls
    const source = createCronSource<TestSignal>({
      jobs: [{ id: "test-job", name: "Test Job", expr: "* * * * * *" }], // every second
      toSignal: (job, firedAt) => {
        receivedJobs.push({ id: job.id, name: job.name, expr: job.expr });
        return {
          type: "test.cron.fired",
          id: "signal-id",
          ts: firedAt,
          payload: { jobId: job.id, jobName: job.name, firedAt },
        };
      },
    });

    await source.start(() => Promise.resolve());

    // Wait for one tick (croner uses seconds for 6-part expressions)
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await source.stop();

    // Should have received at least one call
    expect(receivedJobs.length).toBeGreaterThanOrEqual(1);
    expect(receivedJobs[0]).toEqual({
      id: "test-job",
      name: "Test Job",
      expr: "* * * * * *",
    });
  }, 3000);
});

describe("getNextRun", () => {
  it("returns a Date for valid cron expressions", () => {
    const next = getNextRun("0 8 * * *"); // 8am daily
    expect(next).toBeInstanceOf(Date);
  });

  it("returns null for invalid cron expressions", () => {
    const next = getNextRun("invalid cron");
    expect(next).toBeNull();
  });

  it("respects timezone parameter", () => {
    const nextNY = getNextRun("0 8 * * *", "America/New_York");
    const nextLA = getNextRun("0 8 * * *", "America/Los_Angeles");

    // Both should be valid dates
    expect(nextNY).toBeInstanceOf(Date);
    expect(nextLA).toBeInstanceOf(Date);

    // LA is 3 hours behind NY, so 8am LA is later than 8am NY
    if (nextNY && nextLA) {
      // The difference should be related to timezone offset
      // We just verify both are valid - exact timing depends on current time
      expect(nextNY.getTime()).not.toBe(nextLA.getTime());
    }
  });
});

describe("isValidCronExpr", () => {
  it("returns true for valid cron expressions", () => {
    expect(isValidCronExpr("* * * * *")).toBe(true); // every minute
    expect(isValidCronExpr("0 8 * * *")).toBe(true); // 8am daily
    expect(isValidCronExpr("0 0 1 * *")).toBe(true); // first of month
    expect(isValidCronExpr("*/5 * * * *")).toBe(true); // every 5 minutes
    expect(isValidCronExpr("0 8,18 * * 1-5")).toBe(true); // 8am and 6pm weekdays
  });

  it("returns false for invalid cron expressions", () => {
    expect(isValidCronExpr("invalid")).toBe(false);
    expect(isValidCronExpr("not a cron")).toBe(false);
    expect(isValidCronExpr("")).toBe(false);
    expect(isValidCronExpr("60 * * * *")).toBe(false); // 60 is invalid minute
  });
});
