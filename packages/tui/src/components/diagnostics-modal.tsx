import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";
import type { SessionDiagnosticEvent } from "../app/diagnostics/session-events.ts";
import { truncateInlineMessage } from "../app/shared/text.ts";
import type { UiTheme } from "../theme.ts";
import { KeyCap, ModalFrame, SPLIT_BORDER, Tag, selectItem } from "./shared.tsx";

const DIAGNOSTICS_MODAL_MAX_WIDTH = 112;
const DIAGNOSTICS_MODAL_WIDTH_PERCENT = 92;

export function DiagnosticsModal({
  errorMessage,
  events,
  isLoading,
  logFilePath,
  selectedIndex,
  terminalWidth,
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
  const listScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const detailScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const rowRefs = useRef<(BoxRenderable | null)[]>([]);
  const selectedEvent = selectItem(events, selectedIndex);
  const modalWidth = Math.min(
    DIAGNOSTICS_MODAL_MAX_WIDTH,
    Math.max(Math.floor((terminalWidth * DIAGNOSTICS_MODAL_WIDTH_PERCENT) / 100), 56),
  );
  const pathWidth = Math.max(modalWidth - 10, 16);
  const entryLabelWidth = Math.max(modalWidth - 24, 18);
  const summaryWidth = Math.max(modalWidth - 14, 20);

  useEffect(() => {
    rowRefs.current.length = events.length;
  }, [events.length]);

  useEffect(() => {
    const scrollBox = listScrollRef.current;
    const selectedRow = rowRefs.current[selectedIndex];
    if (scrollBox == null || selectedRow == null) {
      return;
    }

    const contentTop = scrollBox.content.y;
    const offset = selectedRow.y - contentTop;
    if (!Number.isFinite(offset)) {
      return;
    }

    scrollBox.scrollTo({ x: 0, y: Math.max(offset - 1, 0) });
  }, [events.length, selectedIndex]);

  useEffect(() => {
    detailScrollRef.current?.scrollTo({ x: 0, y: 0 });
  }, [selectedEvent?.sequence]);

  return (
    <ModalFrame
      title="Diagnostics"
      subtitle="Full event log for the current diffdiff session."
      theme={theme}
      maxWidth={DIAGNOSTICS_MODAL_MAX_WIDTH}
      maxHeight="86%"
      width="92%"
      zIndex={35}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="j/k" theme={theme} />
          <span>{" move  "}</span>
          <KeyCap label="home/end" theme={theme} />
          <span>{" jump  "}</span>
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box width="100%" flexDirection="column" gap={1} flexGrow={1}>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={0}
        >
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.text}>{events.length}</span>
            <span>{events.length === 1 ? " event" : " events"}</span>
            <span fg={theme.border}>{"  │  "}</span>
            <span>{isLoading ? "loading" : errorMessage == null ? "ready" : "load error"}</span>
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            {truncateInlineMessage(logFilePath, pathWidth)}
          </text>
        </box>

        <scrollbox
          ref={listScrollRef}
          width="100%"
          height="46%"
          focused={true}
          viewportOptions={{ backgroundColor: theme.modalBg }}
          contentOptions={{ backgroundColor: theme.modalBg }}
          verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
        >
          <box width="100%" flexDirection="column" gap={0}>
            {isLoading ? (
              <DiagnosticsPlaceholder message="Loading session events..." theme={theme} />
            ) : errorMessage != null ? (
              <DiagnosticsPlaceholder message={errorMessage} theme={theme} tone="error" />
            ) : events.length === 0 ? (
              <DiagnosticsPlaceholder
                message="No session events have been recorded yet."
                theme={theme}
              />
            ) : (
              events.map((event, index) => {
                const isSelected = index === selectedIndex;
                const accent = getLevelColor(event.level, theme);
                return (
                  <box
                    key={`${event.sequence}:${event.scope}:${event.event}`}
                    ref={(node: BoxRenderable | null) => {
                      rowRefs.current[index] = node;
                    }}
                    width="100%"
                    border={["left"]}
                    customBorderChars={SPLIT_BORDER}
                    borderColor={isSelected ? theme.accent : theme.border}
                    backgroundColor={isSelected ? theme.surfaceMuted : theme.surface}
                    paddingLeft={2}
                    paddingRight={1}
                    paddingTop={1}
                    paddingBottom={1}
                    flexDirection="column"
                    gap={0}
                  >
                    <text fg={isSelected ? theme.text : theme.textMuted} wrapMode="none">
                      <span fg={isSelected ? theme.accent : theme.border}>
                        {isSelected ? "> " : "  "}
                      </span>
                      <Tag
                        label={formatLevelLabel(event.level)}
                        fg={theme.appBackground}
                        bg={accent}
                        width={5}
                      />
                      <span> </span>
                      <span fg={theme.text}>
                        {truncateInlineMessage(`${event.scope}.${event.event}`, entryLabelWidth)}
                      </span>
                      <span fg={theme.border}>{"  │  "}</span>
                      <span>{formatEventTime(event.timestamp)}</span>
                    </text>
                    <box width="100%" paddingLeft={2}>
                      <text fg={theme.textMuted} wrapMode="none">
                        {truncateInlineMessage(event.summaryText, summaryWidth)}
                      </text>
                    </box>
                  </box>
                );
              })
            )}
          </box>
        </scrollbox>

        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={
            selectedEvent == null ? theme.border : getLevelColor(selectedEvent.level, theme)
          }
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={1}
          flexGrow={1}
        >
          {selectedEvent == null ? (
            <text fg={theme.textMuted} wrapMode="word">
              Select a session event to inspect its full contents.
            </text>
          ) : (
            <>
              <text fg={theme.textMuted} wrapMode="none">
                <span fg={theme.text}>{`Entry ${selectedIndex + 1}`}</span>
                <span>{` of ${events.length}`}</span>
                <span fg={theme.border}>{"  │  "}</span>
                <span>{selectedEvent.timestamp || "No timestamp"}</span>
              </text>
              <scrollbox
                ref={detailScrollRef}
                width="100%"
                flexGrow={1}
                focused={false}
                viewportOptions={{ backgroundColor: theme.surface }}
                contentOptions={{ backgroundColor: theme.surface }}
                verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
              >
                <box width="100%" flexDirection="column">
                  <text fg={theme.text} wrapMode="word">
                    {selectedEvent.detailText}
                  </text>
                </box>
              </scrollbox>
            </>
          )}
        </box>
      </box>
    </ModalFrame>
  );
}

function DiagnosticsPlaceholder({
  message,
  theme,
  tone = "muted",
}: {
  message: string;
  theme: UiTheme;
  tone?: "error" | "muted";
}) {
  return (
    <box
      width="100%"
      border={["left"]}
      customBorderChars={SPLIT_BORDER}
      borderColor={tone === "error" ? theme.danger : theme.border}
      backgroundColor={theme.surface}
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
    >
      <text fg={tone === "error" ? theme.danger : theme.textMuted} wrapMode="word">
        {message}
      </text>
    </box>
  );
}

function formatEventTime(timestamp: string): string {
  if (timestamp.length >= 19) {
    return timestamp.slice(11, 19);
  }

  return timestamp === "" ? "--:--:--" : timestamp;
}

function formatLevelLabel(level: SessionDiagnosticEvent["level"]): string {
  switch (level) {
    case "warn":
      return "WARN";
    case "error":
      return "ERROR";
    default:
      return "INFO";
  }
}

function getLevelColor(level: SessionDiagnosticEvent["level"], theme: UiTheme): string {
  switch (level) {
    case "warn":
      return theme.warning;
    case "error":
      return theme.danger;
    default:
      return theme.accent;
  }
}
