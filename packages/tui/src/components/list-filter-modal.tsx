import type { BranchListFilters } from "../types.ts";
import type { UiTheme } from "../theme.ts";
import { CategoryPill } from "./branch-list-view.tsx";
import { KeyCap, ModalFrame, SPLIT_BORDER } from "./shared.tsx";

export function ListFilterModal({
  filters,
  selectedIndex,
  theme,
}: {
  filters: BranchListFilters;
  selectedIndex: number;
  theme: UiTheme;
}) {
  const entries = [
    ["workingTree", "Working tree"],
    ["localBranch", "Local branches"],
    ["openPr", "Open PRs"],
    ["remoteBranch", "Remote branches"],
  ] as const;

  return (
    <ModalFrame
      title="Filters"
      subtitle="Choose which list item types are visible in the branch view."
      theme={theme}
      maxWidth={56}
      width="68%"
      zIndex={40}
      headerRight={
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="esc" theme={theme} />
          <span>{" close"}</span>
        </text>
      }
    >
      <box width="100%" flexDirection="column" gap={0}>
        {entries.map(([key, label], index) => {
          const isSelected = index === selectedIndex;
          const isEnabled = filters[key];

          return (
            <box
              key={key}
              width="100%"
              border={["left"]}
              customBorderChars={SPLIT_BORDER}
              borderColor={isSelected ? theme.borderActive : theme.border}
              backgroundColor={isSelected ? theme.surfaceMuted : theme.surface}
              paddingLeft={2}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
              flexDirection="row"
              justifyContent="space-between"
              gap={1}
            >
              <text fg={isSelected ? theme.text : theme.textMuted} wrapMode="none">
                {label}
              </text>
              <text wrapMode="none">
                <CategoryPill
                  label={isEnabled ? "ON" : "OFF"}
                  isEnabled={isEnabled}
                  theme={theme}
                />
              </text>
            </box>
          );
        })}
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
      >
        <text fg={theme.textMuted} wrapMode="none">
          <KeyCap label="space / enter" theme={theme} />
          <span>{" toggle  "}</span>
          <KeyCap label="shift+space / shift+enter" theme={theme} />
          <span>{" all on  "}</span>
          <KeyCap label="alt+space / alt+enter" theme={theme} />
          <span>{" all off"}</span>
        </text>
      </box>
    </ModalFrame>
  );
}
