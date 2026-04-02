import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: {
      tsgo: false,
    },
    entry: ["src/index.ts"],
    exports: true,
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
});
