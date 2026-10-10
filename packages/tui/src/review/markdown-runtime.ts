import { TreeSitterClient } from "@opentui/core";
import { homedir } from "node:os";
import { join } from "node:path";
import { useEffect, useState } from "react";

export function createMarkdownClient(): TreeSitterClient | null {
  // OpenTUI is bundled, but its parser worker is shipped by our runtime
  // dependency. Resolve that package rather than looking beside our JS chunk.
  return new TreeSitterClient({
    workerPath: new URL("./parser.worker.js", import.meta.resolve("@opentui/core")),
    dataPath: join(homedir(), ".diffdiff", "cache", "markdown"),
  });
}

export function useMarkdownClient(enabled: boolean) {
  const [client, setClient] = useState<TreeSitterClient | null>(null);
  useEffect(() => {
    if (!enabled) {
      setClient(null);
      return;
    }
    const next = createMarkdownClient();
    setClient(next);
    return () => {
      void next?.destroy();
    };
  }, [enabled]);
  return client;
}
