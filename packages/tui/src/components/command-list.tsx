import type { ReactNode } from "react";
import type { UiTheme } from "../theme.ts";
import { KeyCap, tintHex } from "./shared.tsx";

export function CommandListItem({
  accentColor,
  children,
  index,
  isSelected = false,
  theme,
}: {
  accentColor?: string;
  children: ReactNode;
  index: number;
  isSelected?: boolean;
  theme: UiTheme;
}) {
  const stripeColor = accentColor ?? theme.border;
  const backgroundColor = isSelected
    ? tintHex(theme.surface, stripeColor, 0.16)
    : index % 2 === 0
      ? theme.surface
      : tintHex(theme.surface, stripeColor, 0.05);

  return (
    <box width="100%" backgroundColor={backgroundColor}>
      {children}
    </box>
  );
}

export function CommandListRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <box width="100%" flexDirection="row" justifyContent="space-between" gap={2}>
      <box flexDirection="column" flexGrow={1} gap={0}>
        {left}
      </box>
      {right != null ? (
        <box flexDirection="column" flexShrink={0} gap={0}>
          {right}
        </box>
      ) : null}
    </box>
  );
}

export function CommandBindingLabel({
  accentColor,
  dimmed = false,
  label,
  theme,
}: {
  accentColor?: string;
  dimmed?: boolean;
  label?: string;
  theme: UiTheme;
}) {
  const trimmedLabel = label?.trim();
  const keyCapTheme: UiTheme = {
    ...theme,
    accent: dimmed ? theme.border : (accentColor ?? theme.accent),
    surfaceMuted: dimmed ? theme.surface : theme.surfaceMuted,
  };
  const textColor = dimmed ? theme.border : theme.textMuted;

  if (trimmedLabel == null || trimmedLabel === "") {
    return (
      <text fg={textColor} wrapMode="none">
        unbound
      </text>
    );
  }

  const alternatives = splitBindingLabel(trimmedLabel);
  const bindingChildren: ReactNode[] = [];

  for (const [alternativeIndex, steps] of alternatives.entries()) {
    if (alternativeIndex > 0) {
      bindingChildren.push(
        <span key={`separator:${alternativeIndex}`} fg={textColor}>
          {" / "}
        </span>,
      );
    }

    for (const [stepIndex, step] of steps.entries()) {
      if (stepIndex > 0) {
        bindingChildren.push(<span key={`space:${alternativeIndex}:${stepIndex}`}> </span>);
      }

      bindingChildren.push(
        <KeyCap
          key={`step:${alternativeIndex}:${stepIndex}:${step}`}
          label={step}
          theme={keyCapTheme}
        />,
      );
    }
  }

  return (
    <text fg={textColor} wrapMode="none">
      {bindingChildren}
    </text>
  );
}

function splitBindingLabel(label: string): string[][] {
  return label
    .split(/\s+\/\s+/u)
    .map((alternative) => alternative.split(/\s+/u).filter(Boolean))
    .filter((alternative) => alternative.length > 0);
}
