import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";
import type { SessionDiagnosticEvent } from "../app/diagnostics/session-events.ts";
import { truncateInlineMessage } from "../app/shared/text.ts";
import type { UiTheme } from "../theme.ts";
import { KeyCap, ModalFrame, SPLIT_BORDER, Tag, selectItem, tintHex } from "./shared.tsx";

const DIAGNOSTICS_MODAL_MAX_WIDTH = 132;
const DIAGNOSTICS_MODAL_WIDTH_PERCENT = 94;

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
  const logPaneWidth = Math.max(Math.min(Math.floor(modalWidth * 0.4), 48), 34);
  const pathWidth = Math.max(modalWidth - 16, 24);
  const entryLabelWidth = Math.max(logPaneWidth - 20, 16);
  const summaryWidth = Math.max(logPaneWidth - 8, 18);
  const latestTimestamp = events[0]?.timestamp;
  const selectedAccent =
    selectedEvent == null ? theme.accent : getLevelColor(selectedEvent.level, theme);
  const statusCardBg = tintHex(theme.surface, theme.accent, 0.12);
  const detailHeaderBg = tintHex(theme.surface, selectedAccent, 0.12);
  const detailBodyBg = tintHex(theme.surface, selectedAccent, 0.08);

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
      theme={theme}
      maxWidth={DIAGNOSTICS_MODAL_MAX_WIDTH}
      maxHeight="86%"
      width="94%"
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
        <box width="100%" flexDirection="row" gap={1}>
          <box
            width={logPaneWidth}
            border={["left"]}
            customBorderChars={SPLIT_BORDER}
            borderColor={theme.accent}
            backgroundColor={statusCardBg}
            paddingLeft={2}
            paddingRight={1}
            paddingTop={1}
            paddingBottom={1}
            flexDirection="column"
            gap={0}
          >
            <text fg={theme.text} wrapMode="none">
              <span>{events.length}</span>
              <span fg={theme.textMuted}>{events.length === 1 ? " event" : " events"}</span>
              <span fg={theme.border}>{"  │  "}</span>
              <span fg={theme.textMuted}>
                {isLoading ? "loading" : errorMessage == null ? "ready" : "load error"}
              </span>
              <span fg={theme.border}>{latestTimestamp == null ? "" : "  │  "}</span>
              <span fg={theme.textMuted}>
                {latestTimestamp == null ? "" : `latest ${formatEventTime(latestTimestamp)}`}
              </span>
            </text>
          </box>

          <box
            flexGrow={1}
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
              <span fg={theme.text}>Most recent first</span>
              <span fg={theme.border}>{"  │  "}</span>
              <span>Session log</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              {truncateInlineMessage(logFilePath, pathWidth)}
            </text>
          </box>
        </box>

        <box width="100%" flexDirection="row" gap={1} flexGrow={1}>
          <box width={logPaneWidth} flexDirection="column" gap={1}>
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
                <span fg={theme.text}>Event Log</span>
                <span fg={theme.border}>{"  │  "}</span>
                <span>Newest first</span>
              </text>
            </box>

            <scrollbox
              ref={listScrollRef}
              width="100%"
              flexGrow={1}
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
                    const rowBackground = tintHex(
                      isSelected ? theme.surfaceMuted : theme.surface,
                      accent,
                      isSelected ? 0.24 : 0.1,
                    );

                    return (
                      <box
                        key={`${event.sequence}:${event.scope}:${event.event}`}
                        ref={(node: BoxRenderable | null) => {
                          rowRefs.current[index] = node;
                        }}
                        width="100%"
                        border={["left"]}
                        customBorderChars={SPLIT_BORDER}
                        borderColor={isSelected ? theme.borderActive : accent}
                        backgroundColor={rowBackground}
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
                            fg={theme.inverseText}
                            bg={accent}
                            width={5}
                          />
                          <span> </span>
                          <span fg={theme.text}>
                            {truncateInlineMessage(
                              `${event.scope}.${event.event}`,
                              entryLabelWidth,
                            )}
                          </span>
                        </text>
                        <text fg={theme.textMuted} wrapMode="none">
                          <span>{formatEventTime(event.timestamp)}</span>
                          <span fg={theme.border}>{"  │  "}</span>
                          <span>{truncateInlineMessage(event.summaryText, summaryWidth)}</span>
                        </text>
                      </box>
                    );
                  })
                )}
              </box>
            </scrollbox>
          </box>

          <box
            flexGrow={1}
            border={["left"]}
            customBorderChars={SPLIT_BORDER}
            borderColor={selectedEvent == null ? theme.border : selectedAccent}
            backgroundColor={detailBodyBg}
            paddingLeft={2}
            paddingRight={1}
            paddingTop={1}
            paddingBottom={1}
            flexDirection="column"
            gap={1}
          >
            {selectedEvent == null ? (
              <text fg={theme.textMuted} wrapMode="word">
                Select a session event to inspect its full contents.
              </text>
            ) : (
              <>
                <box
                  width="100%"
                  border={["left"]}
                  customBorderChars={SPLIT_BORDER}
                  borderColor={selectedAccent}
                  backgroundColor={detailHeaderBg}
                  paddingLeft={2}
                  paddingRight={1}
                  paddingTop={1}
                  paddingBottom={1}
                  flexDirection="column"
                  gap={1}
                >
                  <text fg={theme.text} wrapMode="none">
                    <Tag
                      label={formatLevelLabel(selectedEvent.level)}
                      fg={theme.inverseText}
                      bg={selectedAccent}
                      width={5}
                    />
                    <span> </span>
                    <span>{selectedEvent.scope}</span>
                    <span fg={theme.border}>{"  │  "}</span>
                    <span>{selectedEvent.event}</span>
                  </text>
                  <text fg={theme.textMuted} wrapMode="none">
                    <span fg={theme.text}>{selectedEvent.timestamp || "No timestamp"}</span>
                    <span fg={theme.border}>{"  │  "}</span>
                    <span>{selectedIndex + 1}</span>
                    <span>{` of ${events.length}`}</span>
                    <span fg={theme.border}>{"  │  "}</span>
                    <span>{`seq ${selectedEvent.sequence}`}</span>
                  </text>
                </box>

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
                  gap={1}
                  flexGrow={1}
                >
                  <text fg={theme.textMuted} wrapMode="none">
                    Full Event
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
                </box>
              </>
            )}
          </box>
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
