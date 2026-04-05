import { formatCommandShortcuts, type CommandDefinition } from "../commands.ts";
import type { UiTheme } from "../theme.ts";
import { KeyCap, ModalFrame, SPLIT_BORDER, selectItem } from "./shared.tsx";

export function CommandPaletteModal({
  commands,
  leaderKeybind,
  query,
  selectedIndex,
  theme,
}: {
  commands: readonly CommandDefinition[];
  leaderKeybind: string;
  query: string;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const selectedCommand = selectItem(commands, selectedIndex);
  const normalizedQuery = query.trim();
  let activeCategory: string | undefined;

  return (
    <ModalFrame
      title="Commands"
      subtitle={
        normalizedQuery === ""
          ? "Search or browse available diffdiff actions."
          : `Filtering commands for "${normalizedQuery}".`
      }
      theme={theme}
      maxWidth={96}
      width="78%"
      zIndex={30}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box width="100%" flexDirection="column" gap={1}>
        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={0}
        >
          <text fg={theme.textMuted} wrapMode="none">
            <span fg={theme.text}>query</span>
            <span>{": "}</span>
            <span fg={normalizedQuery === "" ? theme.textMuted : theme.text}>
              {normalizedQuery === "" ? "type to filter commands" : normalizedQuery}
            </span>
          </text>
        </box>

        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.accent}
          backgroundColor={theme.surface}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={0}
        >
          {commands.length === 0 ? (
            <text fg={theme.textMuted} wrapMode="none">
              No matching commands.
            </text>
          ) : (
            commands.map((command, index) => {
              const categoryLabel =
                normalizedQuery === "" && command.suggested ? "Suggested" : command.category;
              const showCategory = categoryLabel !== activeCategory;
              activeCategory = categoryLabel;
              const isSelected = index === selectedIndex;
              const isEnabled = command.enabled !== false;
              const backgroundColor = isSelected ? theme.accent : theme.surface;
              const foreground = isSelected
                ? theme.appBackground
                : isEnabled
                  ? theme.text
                  : theme.textMuted;
              const detail = isSelected ? theme.appBackground : theme.textMuted;
              const detailText =
                command.enabled === false && command.disabledReason != null
                  ? command.disabledReason
                  : command.description;

              return (
                <box key={command.value} width="100%" flexDirection="column" gap={0}>
                  {showCategory ? (
                    <text fg={theme.success} wrapMode="none">
                      {categoryLabel}
                    </text>
                  ) : null}
                  <box
                    width="100%"
                    backgroundColor={backgroundColor}
                    paddingLeft={1}
                    paddingRight={1}
                    minHeight={detailText == null ? 1 : 2}
                    flexDirection="row"
                    justifyContent="space-between"
                    gap={1}
                  >
                    <box flexDirection="column" flexGrow={1} gap={0}>
                      <text fg={foreground} wrapMode="none">
                        <span>{isSelected ? "› " : "  "}</span>
                        <span>{command.title}</span>
                      </text>
                      {detailText != null ? (
                        <box width="100%" paddingLeft={2}>
                          <text fg={detail} wrapMode="word">
                            {detailText}
                          </text>
                        </box>
                      ) : null}
                    </box>
                    <text fg={detail} wrapMode="none">
                      {formatCommandShortcuts(command, leaderKeybind) ?? ""}
                    </text>
                  </box>
                </box>
              );
            })
          )}
        </box>

        <box
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={theme.border}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
          justifyContent="space-between"
          gap={2}
        >
          <text fg={theme.textMuted} wrapMode="none">
            <KeyCap label="up / down" theme={theme} />
            <span>{" move  "}</span>
            <KeyCap label="enter" theme={theme} />
            <span>{" run  "}</span>
            <KeyCap label="leader+j/k" theme={theme} />
            <span>{" move while typing  "}</span>
            <KeyCap label="backspace" theme={theme} />
            <span>{" edit query"}</span>
          </text>
          <text fg={theme.textMuted} wrapMode="none">
            {selectedCommand != null ? selectedCommand.value : ""}
          </text>
        </box>
      </box>
    </ModalFrame>
  );
}
