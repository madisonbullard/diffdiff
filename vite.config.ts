import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    setupFiles: ["packages/tui/tests/native-buffer-mock.ts"],
    // Visual suites need Bun's native OpenTUI renderer; run them with
    // `vp run test:visual` in packages/tui.
    exclude: ["**/node_modules/**", "**/dist/**", "**/visual/**"],
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["packages/*/src/**/*.{ts,tsx}"],
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
});
