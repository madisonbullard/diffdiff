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
      {
        files: ["src/app/DiffdiffApp.tsx"],
        rules: {
          "max-lines": "off",
        },
      },
    ],
  },
  fmt: {},
});
