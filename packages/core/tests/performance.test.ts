import { expect, test } from "vite-plus/test";
import { StartupPerformance } from "../src/performance.ts";

test("network accounting unions overlaps, includes active waits, and ends idempotently", () => {
  let now = 100;
  const trace = new StartupPerformance(0, () => now);
  const first = trace.beginNetworkWait();
  now = 200;
  const second = trace.beginNetworkWait();
  now = 300;
  first();
  first();
  now = 400;
  expect(trace.summarize()).toMatchObject({
    networkWaitDurationMs: 300,
    nonNetworkDurationMs: 100,
  });
  second();
  now = 500;
  expect(trace.summarize()).toMatchObject({
    networkWaitDurationMs: 300,
    nonNetworkDurationMs: 200,
  });
  const third = trace.beginNetworkWait();
  now = 600;
  third();
  now = 1400;
  expect(trace.summarize()).toEqual({
    totalDurationMs: 1400,
    networkWaitDurationMs: 400,
    nonNetworkDurationMs: 1000,
    localBudgetMs: 1000,
    localBudgetExceeded: true,
  });
});
