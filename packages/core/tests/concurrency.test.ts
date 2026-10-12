import { expect, test } from "vite-plus/test";
import { mapWithConcurrency } from "../src/concurrency.ts";

test("bounds concurrent work and preserves order", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (item) => {
    peak = Math.max(peak, ++active);
    await Promise.resolve();
    active--;
    return item * 2;
  });
  expect(peak).toBe(2);
  expect(result).toEqual([0, 2, 4, 6, 8, 10]);
  expect(await mapWithConcurrency([], 2, async (item) => item)).toEqual([]);
});
