import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: {
      tsgo: false,
    },
    deps: {
      alwaysBundle: [/^@diffdiff\/core$/u, /^@opentui\//u, /^@pierre\//u, /^shiki$/u],
    },
    entry: {
      index: "src/index.ts",
      cli: "src/cli.tsx",
      "syntax-worker": "src/diff/syntax-worker.ts",
    },
    exports: true,
    loader: {
      ".scm": "asset",
      ".wasm": "asset",
    },
    platform: "node",
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["src/**/*.{ts,tsx}"],
        rules: {
          "max-lines": [
            "error",
            {
              max: 500,
              skipBlankLines: true,
              skipComments: true,
            },
          ],
        },
      },
    ],
  },
  fmt: {},
  // Test the core sources, as tsconfig paths do, not a possibly missing or stale dist.
  resolve: {
    alias: {
      "@madisonbullard/diffdiff-core": fileURLToPath(
        new URL("../core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    setupFiles: ["tests/native-buffer-mock.ts"],
    // Visual suites need Bun's native OpenTUI renderer; run them with
    // `vp run test:visual`.
    exclude: ["**/node_modules/**", "**/dist/**", "visual/**"],
  },
});
