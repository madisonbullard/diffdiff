import { logDiffdiffInfo } from "./logging.ts";

/** Wall-clock accounting: concurrent network operations count once, not once per request. */
export class StartupPerformance {
  private networkDepth = 0;
  private networkStartedAt = 0;
  private networkDurationMs = 0;

  constructor(
    private readonly startedAt = 0,
    private readonly now = () => performance.now(),
  ) {}

  beginNetworkWait(): () => void {
    if (this.networkDepth++ === 0) this.networkStartedAt = this.now();
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      if (--this.networkDepth === 0) {
        this.networkDurationMs += this.now() - this.networkStartedAt;
      }
    };
  }

  summarize(completedAt = this.now()) {
    const totalDurationMs = Math.max(0, completedAt - this.startedAt);
    const networkWaitDurationMs = Math.min(
      totalDurationMs,
      this.networkDurationMs + (this.networkDepth > 0 ? completedAt - this.networkStartedAt : 0),
    );
    const nonNetworkDurationMs = totalDurationMs - networkWaitDurationMs;
    return {
      totalDurationMs: round(totalDurationMs),
      networkWaitDurationMs: round(networkWaitDurationMs),
      nonNetworkDurationMs: round(nonNetworkDurationMs),
      localBudgetMs: 1000,
      localBudgetExceeded: nonNetworkDurationMs >= 1000,
    };
  }
}

let startupPerformance: StartupPerformance | undefined;

export function startStartupPerformance(): void {
  // performance.now() uses process origin, including the static module graph and CLI parsing.
  startupPerformance = new StartupPerformance();
}

export function summarizeStartupPerformance() {
  return startupPerformance?.summarize();
}

export function finishStartupPerformance(): void {
  if (startupPerformance == null) return;
  logDiffdiffInfo("perf", "startup_first_diff_frame", startupPerformance.summarize());
  startupPerformance = undefined;
}

export function beginPerformanceOperation(
  operation: string,
  kind: "local" | "network",
): () => void {
  const startedAt = performance.now();
  const endNetworkWait = kind === "network" ? startupPerformance?.beginNetworkWait() : undefined;
  return () => {
    endNetworkWait?.();
    logDiffdiffInfo("perf", "operation_completed", {
      operation,
      kind,
      startedAt: round(startedAt),
      durationMs: round(performance.now() - startedAt),
    });
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
