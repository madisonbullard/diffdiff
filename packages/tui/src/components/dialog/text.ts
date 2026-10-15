const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function cellWidth(value: string): number {
  const bun = (globalThis as { Bun?: { stringWidth(value: string): number } }).Bun;
  if (bun != null) return bun.stringWidth(value);
  // Node unit tests do not load Bun; the application always takes the native path.
  return [...segments.segment(value)].reduce((sum, { segment }) => {
    const cp = segment.codePointAt(0) ?? 0;
    return (
      sum +
      (/\p{Extended_Pictographic}/u.test(segment) ||
      (cp >= 0x1100 &&
        (cp <= 0x115f ||
          (cp >= 0x2e80 && cp <= 0xa4cf) ||
          (cp >= 0xac00 && cp <= 0xd7a3) ||
          (cp >= 0xf900 && cp <= 0xfaff) ||
          (cp >= 0xff01 && cp <= 0xff60) ||
          cp >= 0x20000))
        ? 2
        : 1)
    );
  }, 0);
}

export function fitText(value: string, cells: number): string {
  if (cells <= 0) return "";
  if (cellWidth(value) <= cells) return value;
  let result = "";
  for (const { segment } of segments.segment(value)) {
    if (cellWidth(result + segment) > cells - 1) break;
    result += segment;
  }
  return `${result}…`;
}

export function fitPath(value: string, cells: number): string {
  if (cellWidth(value) <= cells) return value;
  const parts = [...segments.segment(value)].map(({ segment }) => segment);
  let left = "";
  let right = "";
  while (parts.length > 0) {
    const first = parts.shift()!;
    if (cellWidth(left + first + right) > cells - 1) break;
    left += first;
    const last = parts.pop();
    if (last == null || cellWidth(left + last + right) > cells - 1) break;
    right = last + right;
  }
  return cells > 0 ? `${left}…${right}` : "";
}
