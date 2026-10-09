import { vi } from "vite-plus/test";

// Vitest runs in Node, not Bun's native OpenTUI runtime. The visual suite
// verifies real StyledText colors, wrapping, selection and hydration.
vi.mock("../src/diff/styled-text.ts", () => ({
  toTextContent: (segments: readonly { text: string }[]) =>
    segments.map((segment) => segment.text).join(""),
}));
