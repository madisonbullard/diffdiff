import { formatCommandKeybind, type CommandDefinition } from "../commands.ts";
import type { UiTheme } from "../theme.ts";
import { KeyCap, ModalFrame, SPLIT_BORDER } from "./shared.tsx";

interface HelpSection {
  color: string;
  rows: {
    keybind: string;
    text: string;
  }[];
  title: string;
}

function formatHelpText(command: CommandDefinition): string {
  return command.title.charAt(0).toLowerCase() + command.title.slice(1);
}

function buildHelpSections(
  commands: readonly CommandDefinition[],
  leaderKeybind: string,
  theme: UiTheme,
): HelpSection[] {
  const sections: HelpSection[] = [
    {
      color: theme.accent,
      title: "Navigation",
      rows: [
        { keybind: "j / k", text: "move in the active pane" },
        { keybind: "g / G", text: "jump to the first or last item" },
        { keybind: "tab", text: "switch between the tree and diff panes" },
        { keybind: "left / right", text: "collapse, expand, or open from the tree" },
      ],
    },
    {
      color: theme.success,
      title: "Review Navigation",
      rows: [
        { keybind: "i / o", text: "focus the previous or next inline thread" },
        { keybind: "[ / ]", text: "focus the previous or next comment in the active thread" },
      ],
    },
  ];

  const categoryColors = new Map<string, string>([
    ["System", theme.accent],
    ["View", theme.accent],
    ["Review", theme.success],
    ["Comparison", theme.warning],
    ["GitHub", theme.warning],
  ]);
  const rowsByCategory = new Map<string, HelpSection["rows"]>();

  for (const command of commands) {
    if (command.hidden === true || command.keybind == null) {
      continue;
    }

    const keybind = formatCommandKeybind(command.keybind, leaderKeybind);
    if (keybind == null) {
      continue;
    }

    const rows = rowsByCategory.get(command.category) ?? [];
    rows.push({
      keybind,
      text: formatHelpText(command),
    });
    rowsByCategory.set(command.category, rows);
  }

  for (const [category, rows] of rowsByCategory) {
    sections.push({
      color: categoryColors.get(category) ?? theme.textMuted,
      rows,
      title: category,
    });
  }

  return sections;
}

export function HelpModal({
  commands,
  leaderKeybind,
  theme,
}: {
  commands: readonly CommandDefinition[];
  leaderKeybind: string;
  theme: UiTheme;
}) {
  const sections = buildHelpSections(commands, leaderKeybind, theme);

  return (
    <ModalFrame
      title="Help"
      subtitle="Review files quickly without leaving the keyboard."
      theme={theme}
      maxWidth={92}
      zIndex={30}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      {sections.map((section) => (
        <box
          key={section.title}
          width="100%"
          border={["left"]}
          customBorderChars={SPLIT_BORDER}
          borderColor={section.color}
          backgroundColor={theme.surface}
          paddingLeft={2}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={0}
        >
          <text fg={section.color} wrapMode="none">
            {section.title}
          </text>
          {section.rows.map((row) => (
            <text
              key={`${section.title}:${row.keybind}:${row.text}`}
              fg={theme.textMuted}
              wrapMode="none"
            >
              <KeyCap label={row.keybind} theme={theme} />
              <span>{` ${row.text}`}</span>
            </text>
          ))}
        </box>
      ))}
    </ModalFrame>
  );
}
