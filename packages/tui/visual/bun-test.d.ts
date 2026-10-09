// Minimal `bun:test` surface used by the visual suite. The TUI package
// type-checks against Node types only, so Bun's full typings are not loaded.
declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeLessThan(expected: number): void;
    not: Matchers;
    toContain(expected: string): void;
    toBeLessThanOrEqual(expected: number): void;
  }

  export function describe(name: string, run: () => void): void;
  export function test(name: string, run: () => Promise<void> | void, timeoutMs?: number): void;
  export function beforeAll(run: () => Promise<void> | void): void;
  export function afterAll(run: () => Promise<void> | void): void;
  export function expect(actual: unknown, message?: string): Matchers;
}
