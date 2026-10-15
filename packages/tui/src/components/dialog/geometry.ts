export type DialogFamily = "picker" | "inspector" | "form" | "confirm";
export interface DialogRect {
  left: number;
  top: number;
  width: number;
  height: number;
  sheet: boolean;
  padX: number;
  padY: number;
  innerWidth: number;
  bodyRows: number;
  tooSmall: boolean;
}
const widths = { picker: 92, inspector: 118, form: 96, confirm: 64 };
const minimums = {
  picker: [40, 10],
  inspector: [60, 18],
  form: [60, 18],
  confirm: [40, 10],
} as const;
export function resolveDialogRect(
  family: DialogFamily,
  cols: number,
  rows: number,
  contentRows?: number,
  hasStatus = false,
): DialogRect {
  const sheet = family !== "confirm" && (cols < 100 || rows < 30);
  const padX = sheet ? 1 : 2;
  const padY = sheet ? 0 : 1;
  const width = Math.max(1, sheet ? cols : Math.min(widths[family], cols - 4));
  const top = sheet
    ? 0
    : family === "confirm"
      ? Math.max(0, Math.floor((rows - Math.min(contentRows ?? 8, rows - 2)) / 2))
      : 4;
  const height = Math.max(1, sheet ? rows - 1 : Math.min(contentRows ?? rows, rows - top - 2));
  return {
    left: Math.floor((cols - width) / 2),
    top,
    width,
    height,
    sheet,
    padX,
    padY,
    innerWidth: Math.max(1, width - padX * 2),
    bodyRows: Math.max(1, height - padY * 2 - 2 - Number(hasStatus)),
    tooSmall: cols < minimums[family][0] || rows < minimums[family][1],
  };
}
