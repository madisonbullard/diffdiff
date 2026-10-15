import type { SessionDiagnosticEvent } from "../app/diagnostics/session-events.ts";
import type { UiTheme } from "../theme.ts";
import { DialogInspector } from "./dialog/inspector.tsx";
import { DialogList, DialogRow } from "./dialog/list-view.tsx";
import { useDialogUi } from "./dialog/context.tsx";
import * as A from "../app/keymap/actions.ts";
export function DiagnosticsModal({
  errorMessage,
  events,
  isLoading,
  logFilePath,
  selectedIndex,
  theme,
}: {
  errorMessage: string | null;
  events: readonly SessionDiagnosticEvent[];
  isLoading: boolean;
  logFilePath: string;
  selectedIndex: number;
  terminalWidth: number;
  theme: UiTheme;
}) {
  const ui = useDialogUi();
  const selected = events[selectedIndex];
  return (
    <DialogInspector
      title="Diagnostics"
      context={`${events.length} events · newest first`}
      status={errorMessage ?? (isLoading ? "Loading session events..." : undefined)}
      theme={theme}
      actions={[
        { action: A.LIST_MOVE_DOWN, label: "move" },
        { action: A.LIST_FIRST, label: "newest" },
        { action: A.LIST_LAST, label: "oldest" },
      ]}
      list={(width, height) => (
        <DialogList
          items={events}
          index={selectedIndex}
          height={height}
          theme={theme}
          empty="No session events have been recorded yet."
          onMove={(delta) => ui.run(delta > 0 ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP, Math.abs(delta))}
          render={(event, i) => (
            <DialogRow
              selected={i === selectedIndex}
              label={`${event.level === "error" ? "✗" : event.level === "warn" ? "▲" : "·"} ${event.scope}.${event.event}`}
              right={event.timestamp.slice(11, 19)}
              width={width}
              theme={theme}
              onSelect={() =>
                ui.run(
                  i > selectedIndex ? A.LIST_MOVE_DOWN : A.LIST_MOVE_UP,
                  Math.abs(i - selectedIndex),
                )
              }
            />
          )}
        />
      )}
      detailKey={String(selected?.sequence)}
      detail={
        <>
          <text fg={theme.textMuted} wrapMode="word">
            {logFilePath}
          </text>
          <text fg={theme.text} attributes={1} wrapMode="word">
            {selected?.summaryText ?? "No event selected"}
          </text>
          <text fg={theme.text} wrapMode="word">
            {selected?.detailText ?? ""}
          </text>
        </>
      }
    />
  );
}
