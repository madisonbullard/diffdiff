import { defineConfig } from "vite-plus";

export default defineConfig({
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
      {
        files: ["packages/tui/src/app/DiffdiffApp.tsx"],
        rules: {
          "max-lines": "off",
        },
      },
    ],
  },
});
