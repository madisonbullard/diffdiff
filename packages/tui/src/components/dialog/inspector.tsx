import { useCallback, useRef, type ReactNode, type MutableRefObject } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { UiTheme } from "../../theme.ts";
import { DialogPanel, type DialogAction } from "./panel.tsx";
import { dialogTokens } from "./tokens.ts";
import { useDialogUi } from "./context.tsx";
import * as A from "../../app/keymap/actions.ts";
export function DialogInspector({
  title,
  context,
  theme,
  status,
  actions,
  list,
  detail,
  detailScrollRef,
  detailKey,
}: {
  title: string;
  context?: string;
  theme: UiTheme;
  status?: string;
  actions: readonly DialogAction[];
  list: (width: number, height: number) => ReactNode;
  detail: ReactNode;
  detailScrollRef?: MutableRefObject<ScrollBoxRenderable | null>;
  detailKey?: string;
}) {
  const ui = useDialogUi();
  const positions = useRef(new Map<string, number>());
  const current = useRef<ScrollBoxRenderable | null>(null);
  const external = detailScrollRef ?? ui.detailScrollRef;
  const attachDetail = useCallback(
    (node: ScrollBoxRenderable | null) => {
      if (node == null && current.current)
        positions.current.set(detailKey ?? "", current.current.scrollTop);
      current.current = node;
      if (external) external.current = node;
      if (node) node.scrollTo(positions.current.get(detailKey ?? "") ?? 0);
    },
    [detailKey, external],
  );
  return (
    <DialogPanel
      title={title}
      context={context}
      family="inspector"
      theme={theme}
      status={status}
      actions={[
        { action: A.INSPECTOR_FOCUS, label: ui.detailFocused ? "focus list" : "focus details" },
        { action: A.SCROLL_PAGE_DOWN, label: "scroll details" },
        ...actions,
      ]}
    >
      {(rect) => {
        const side = rect.width >= 100;
        const listWidth = side ? Math.floor(rect.innerWidth * 0.43) : rect.innerWidth;
        const listHeight = side
          ? rect.bodyRows
          : Math.min(7, Math.max(2, Math.floor(rect.bodyRows * 0.4)));
        return (
          <box height={rect.bodyRows} flexDirection={side ? "row" : "column"} gap={side ? 2 : 1}>
            <box width={listWidth} height={listHeight} flexShrink={0}>
              {list(listWidth, listHeight)}
            </box>
            <scrollbox
              key={detailKey}
              ref={attachDetail}
              width={side ? rect.innerWidth - listWidth - 2 : rect.innerWidth}
              height={side ? rect.bodyRows : rect.bodyRows - listHeight - 1}
              backgroundColor={dialogTokens(theme).raised}
              scrollY
              scrollX={false}
            >
              {detail}
            </scrollbox>
          </box>
        );
      }}
    </DialogPanel>
  );
}
