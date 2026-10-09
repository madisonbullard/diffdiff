import { Worker } from "node:worker_threads";
import type { SyntaxJob, SyntaxResult } from "./syntax-worker.ts";

/** One job at a time; the caller chooses the next visible file after each result. */
export function createSyntaxHydrator() {
  let worker: Worker | undefined;
  let disposed = false;
  let pending:
    | { resolve: (result: SyntaxResult) => void; reject: (error: Error) => void }
    | undefined;
  return {
    hydrate(job: SyntaxJob): Promise<SyntaxResult> {
      if (disposed) return Promise.reject(new Error("Syntax hydrator is disposed."));
      if (pending != null) throw new Error("Syntax hydration is already running.");
      if (worker == null) {
        worker = new Worker(
          new URL(
            import.meta.url.endsWith(".ts") ? "./syntax-worker.ts" : "./syntax-worker.mjs",
            import.meta.url,
          ),
        );
        worker.unref();
        worker.on("message", (result: SyntaxResult) => {
          const request = pending;
          pending = undefined;
          request?.resolve(result);
        });
        worker.on("error", (error) => {
          const request = pending;
          pending = undefined;
          request?.reject(error);
        });
        worker.on("exit", (code) => {
          const request = pending;
          pending = undefined;
          request?.reject(new Error(`Syntax worker exited (${code}).`));
          worker = undefined;
        });
      }
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        try {
          worker!.postMessage(job);
        } catch (error) {
          pending = undefined;
          reject(error);
        }
      });
    },
    dispose() {
      disposed = true;
      pending?.reject(new Error("Syntax hydrator is disposed."));
      pending = undefined;
      void worker?.terminate();
      worker = undefined;
    },
  };
}
