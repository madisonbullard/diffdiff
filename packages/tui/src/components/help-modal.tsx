import { formatCommandKeybind, type CommandDefinition } from "../commands.ts";
import type { AppPane } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import { KeyCap, MODAL_OVERLAY, SPLIT_BORDER } from "./shared.tsx";

type ModeKey = "global" | AppPane;

interface HelpRow {
  keybind: string | undefined;
  text: string;
}

interface HelpModeSection {
  color: string;
  dimmed: boolean;
  mode: ModeKey;
  rows: HelpRow[];
  title: string;
}

const MODE_LABELS: Record<ModeKey, string> = {
  global: "Global",
  tree: "Tree Pane",
  diff: "Diff Pane",
};

function formatHelpText(command: CommandDefinition): string {
  return command.title.charAt(0).toLowerCase() + command.title.slice(1);
}

function getModeForCommand(command: { keybindingContexts?: readonly AppPane[] }): ModeKey {
  if (command.keybindingContexts == null || command.keybindingContexts.length === 0) {
    return "global";
  }

  // If the command has a single context, use it. If multiple, take the first.
  return command.keybindingContexts[0];
}

interface CommandWithContext extends CommandDefinition {
  keybindingContexts?: readonly AppPane[];
}

function buildModeSections(
  commands: readonly CommandWithContext[],
  leaderKeybind: string,
  activePane: AppPane,
  theme: UiTheme,
): HelpModeSection[] {
  const rowsByMode = new Map<ModeKey, HelpRow[]>();

  for (const command of commands) {
    const mode = getModeForCommand(command);
    const keybind =
      command.keybind != null ? formatCommandKeybind(command.keybind, leaderKeybind) : undefined;

    const rows = rowsByMode.get(mode) ?? [];
    rows.push({
      keybind,
      text: formatHelpText(command),
    });
    rowsByMode.set(mode, rows);
  }

  // Determine which modes are active: global is always active, plus the current pane
  const activeModes = new Set<ModeKey>(["global", activePane]);

  // Build ordered sections: global first, current pane second, then remaining
  const allModes: ModeKey[] = ["global", "tree", "diff"];
  const orderedModes: ModeKey[] = [
    "global",
    activePane,
    ...allModes.filter((m) => m !== "global" && m !== activePane),
  ];

  const modeColors: Record<ModeKey, string> = {
    global: theme.accent,
    tree: theme.warning,
    diff: theme.success,
  };

  const sections: HelpModeSection[] = [];

  for (const mode of orderedModes) {
    const rows = rowsByMode.get(mode);
    if (rows == null || rows.length === 0) {
      continue;
    }

    sections.push({
      color: modeColors[mode],
      dimmed: !activeModes.has(mode),
      mode,
      rows,
      title: MODE_LABELS[mode],
    });
  }

  return sections;
}

export function HelpModal({
  activePane,
  commands,
  leaderKeybind,
  theme,
}: {
  activePane: AppPane;
  commands: readonly CommandWithContext[];
  leaderKeybind: string;
  theme: UiTheme;
}) {
  const sections = buildModeSections(commands, leaderKeybind, activePane, theme);

  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={30}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width="92%"
        maxWidth={92}
        maxHeight="80%"
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="column">
          <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
            <text fg={theme.accent} wrapMode="none">
              Help
            </text>
            <text fg={theme.textMuted} wrapMode="none">
              <KeyCap label="esc" theme={theme} />
              <span>{" close"}</span>
            </text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">
            All keyboard shortcuts by mode.
          </text>
        </box>
        <scrollbox
          width="100%"
          flexGrow={1}
          focused={true}
          viewportOptions={{ backgroundColor: theme.modalBg }}
          contentOptions={{ backgroundColor: theme.modalBg }}
          verticalScrollbarOptions={{ trackOptions: { backgroundColor: theme.border } }}
        >
          <box width="100%" flexDirection="column" gap={1}>
            {sections.map((section) => (
              <box
                key={section.mode}
                width="100%"
                border={["left"]}
                customBorderChars={SPLIT_BORDER}
                borderColor={section.dimmed ? theme.border : section.color}
                backgroundColor={theme.surface}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={1}
                paddingBottom={1}
                flexDirection="column"
                gap={0}
              >
                <text fg={section.dimmed ? theme.border : section.color} wrapMode="none">
                  {section.title}
                </text>
                {section.rows.map((row) => (
                  <text
                    key={`${section.mode}:${row.text}`}
                    fg={section.dimmed ? theme.border : theme.textMuted}
                    wrapMode="none"
                  >
                    {row.keybind != null ? (
                      <>
                        <KeyCap
                          label={row.keybind}
                          theme={
                            section.dimmed
                              ? { ...theme, accent: theme.border, surfaceMuted: theme.surface }
                              : theme
                          }
                        />
                        <span>{` ${row.text}`}</span>
                      </>
                    ) : (
                      <span>{`  ${row.text}`}</span>
                    )}
                  </text>
                ))}
              </box>
            ))}
          </box>
        </scrollbox>
      </box>
    </box>
  );
}
