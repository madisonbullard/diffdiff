import type { CommandDefinition } from "../commands.ts";
import type { UiTheme } from "../theme.ts";
import { SINGLE_LINE_TEXT_INPUT_HINT } from "./text-input-hints.ts";
import { CommandBindingLabel, CommandListItem, CommandListRow } from "./command-list.tsx";
import { KeyCap, ModalFrame, SPLIT_BORDER, selectItem } from "./shared.tsx";
import { TextInputContent } from "./text-input-content.tsx";

export function CommandPaletteModal({
  commands,
  commandBindingLabels,
  query,
  queryCursorOffset,
  selectedIndex,
  theme,
}: {
  commands: readonly CommandDefinition[];
  commandBindingLabels: ReadonlyMap<string, string | undefined>;
  query: string;
  queryCursorOffset: number;
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
          ? "Fuzzy filter or browse available diffdiff actions."
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
            <span fg={theme.text}>fuzzy filter</span>
            <span>{": "}</span>
            <span fg={query === "" ? theme.textMuted : theme.text}>
              <TextInputContent
                cursorColor={theme.accent}
                cursorOffset={queryCursorOffset}
                placeholder="type to fuzzy filter commands"
                placeholderColor={theme.textMuted}
                value={query}
              />
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
              const foreground = isEnabled ? theme.text : theme.textMuted;
              const detail = isEnabled ? theme.textMuted : theme.border;
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
                  <CommandListItem
                    accentColor={theme.accent}
                    index={index}
                    isSelected={isSelected}
                    theme={theme}
                  >
                    <CommandListRow
                      left={
                        <>
                          <text fg={foreground} wrapMode="word">
                            <span fg={isSelected ? theme.accent : theme.textMuted}>
                              {isSelected ? "› " : "  "}
                            </span>
                            <span>{command.title}</span>
                          </text>
                          {detailText != null ? (
                            <box width="100%" paddingLeft={2}>
                              <text fg={detail} wrapMode="word">
                                {detailText}
                              </text>
                            </box>
                          ) : null}
                        </>
                      }
                      right={
                        <CommandBindingLabel
                          label={commandBindingLabels.get(command.value)}
                          theme={theme}
                          dimmed={!isEnabled}
                        />
                      }
                    />
                  </CommandListItem>
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
          flexDirection="column"
          gap={1}
        >
          <box width="100%" flexDirection="row" justifyContent="space-between" gap={2}>
            <text fg={theme.textMuted} wrapMode="none">
              <KeyCap label="up / down" theme={theme} />
              <span>{" move  "}</span>
              <KeyCap label="enter" theme={theme} />
              <span>{" run  "}</span>
              <KeyCap label="leader+j/k" theme={theme} />
              <span>{" move while typing"}</span>
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              {selectedCommand != null ? selectedCommand.value : ""}
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="word">
            {SINGLE_LINE_TEXT_INPUT_HINT}
          </text>
        </box>
      </box>
    </ModalFrame>
  );
}
