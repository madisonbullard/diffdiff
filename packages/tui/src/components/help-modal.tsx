import type { UiTheme } from "../theme.ts";
import { KeyCap, ModalFrame, SPLIT_BORDER } from "./shared.tsx";

export function HelpModal({ theme }: { theme: UiTheme }) {
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
      {[
        {
          color: theme.accent,
          title: "Commands",
          rows: [
            ["ctrl+p", "open the command palette", "ctrl+x", "leader shortcuts"],
            ["z", "show or hide the key legend"],
          ],
        },
        {
          color: theme.accent,
          title: "Navigation",
          rows: [
            ["j / k", "move in the active pane", "g / G", "first / last item"],
            [
              "tab",
              "switch tree/diff pane",
              "left / right",
              "collapse, expand, or open from the tree",
            ],
          ],
        },
        {
          color: theme.success,
          title: "Review",
          rows: [
            ["r", "toggle reviewed", "c / enter", "collapse file", "v", "toggle diff view"],
            ["t", "PR comments", "u", "outdated threads", "y", "copy PR URL"],
            ["a", "add comment", "s", "submit review", "m", "merge PR"],
          ],
        },
        {
          color: theme.warning,
          title: "Comparison",
          rows: [
            ["l", "list modal", "b / h", "set base / head", "w", "working tree"],
            [
              "shift+f",
              "refresh branches",
              "o",
              "remote toggle",
              "f",
              "list filters",
              "/",
              "search commits",
            ],
            ["q", "quit"],
          ],
        },
      ].map((section) => (
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
          {section.rows.map((row, index) => (
            <text key={index} fg={theme.textMuted} wrapMode="none">
              <KeyCap label={row[0]!} theme={theme} />
              <span>{` ${row[1]!}`}</span>
              {row[2] != null ? (
                <>
                  <span>{"  "}</span>
                  <KeyCap label={row[2]} theme={theme} />
                  <span>{` ${row[3]!}`}</span>
                </>
              ) : null}
              {row[4] != null ? (
                <>
                  <span>{"  "}</span>
                  <KeyCap label={row[4]} theme={theme} />
                  <span>{` ${row[5]!}`}</span>
                </>
              ) : null}
              {row[6] != null ? (
                <>
                  <span>{"  "}</span>
                  <KeyCap label={row[6]} theme={theme} />
                  <span>{` ${row[7]!}`}</span>
                </>
              ) : null}
            </text>
          ))}
        </box>
      ))}
    </ModalFrame>
  );
}
