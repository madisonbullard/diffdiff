import type { ReactNode } from "react";
import type { UiTheme } from "../../theme.ts";
import { dialogTokens } from "./tokens.ts";
import { fitText, cellWidth } from "./text.ts";
import { useDialogUi } from "./context.tsx";
export function DialogRow({
  selected,
  label,
  right,
  theme,
  width,
  onSelect,
  onActivate,
  disabled,
  onClick,
}: {
  selected?: boolean;
  label: ReactNode;
  right?: string;
  theme: UiTheme;
  width: number;
  onSelect?: () => void;
  onActivate?: () => void;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const ui = useDialogUi();
  const focused = selected && !ui.detailFocused;
  const rightText = right ? fitText(right, Math.max(0, Math.floor(width * 0.5))) : "";
  return (
    <box
      height={1}
      flexShrink={0}
      flexDirection="row"
      backgroundColor={focused ? dialogTokens(theme).cursor : undefined}
      onMouseUp={() => {
        if (onClick) {
          onClick();
          return;
        }
        if (ui.detailFocused) {
          ui.run("inspector.focus");
          onSelect?.();
        } else if (selected) onActivate?.();
        else onSelect?.();
      }}
    >
      <text width={2} flexShrink={0} fg={theme.accent}>
        {selected ? (focused ? "› " : "● ") : "  "}
      </text>
      <text flexGrow={1} wrapMode="none" fg={disabled ? theme.textMuted : theme.text}>
        {typeof label === "string"
          ? fitText(label, width - 2 - (rightText ? cellWidth(rightText) + 1 : 0))
          : label}
      </text>
      {right ? (
        <text marginLeft={1} flexShrink={0} wrapMode="none" fg={theme.textMuted}>
          {rightText}
        </text>
      ) : null}
    </box>
  );
}

export function DialogList<T>({
  items,
  index,
  height,
  render,
  empty = "No results.",
  theme,
  section,
  onMove,
}: {
  items: readonly T[];
  index: number;
  height: number;
  render: (item: T, index: number) => ReactNode;
  empty?: string;
  theme: UiTheme;
  section?: (item: T) => string;
  onMove?: (delta: number) => void;
}) {
  const rows: { item?: T; index: number; label?: string }[] = [];
  let previous: string | undefined;
  for (let i = 0; i < items.length; i += 1) {
    const label = section?.(items[i]!);
    if (label != null && label !== previous) {
      rows.push({ label, index: -i - 1 });
      previous = label;
    }
    rows.push({ item: items[i], index: i });
  }
  const cursor = rows.findIndex(
    (row) => row.index === Math.max(0, Math.min(index, items.length - 1)),
  );
  const start = Math.max(0, Math.min(cursor - Math.max(0, height - 3), rows.length - height));
  const visibleRows = rows.slice(start, start + height);
  if (visibleRows.at(-1)?.label != null) visibleRows.pop();
  return (
    <box
      height={Math.max(1, height)}
      flexShrink={0}
      flexDirection="column"
      overflow="hidden"
      onMouseScroll={(event) => onMove?.(event.scroll?.direction === "up" ? -3 : 3)}
    >
      {items.length === 0 ? (
        <text height={1} fg={theme.textMuted}>
          {empty}
        </text>
      ) : (
        visibleRows.map((row) =>
          row.item == null ? (
            <text
              key={`section:${row.index}`}
              height={1}
              flexShrink={0}
              fg={theme.textMuted}
              attributes={1}
            >{`  ${row.label}`}</text>
          ) : (
            <box key={row.index} height={1} flexShrink={0}>
              {render(row.item, row.index)}
            </box>
          ),
        )
      )}
    </box>
  );
}
