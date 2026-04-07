import type { BranchInfo } from "@madisonbullard/diffdiff-core";
import type { ColorInput } from "@opentui/core";
import type { ReactNode } from "react";
import type { UiTheme } from "../theme.ts";

export const SPLIT_BORDER = {
  topLeft: "",
  bottomLeft: "",
  vertical: "┃",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
} as const;

export const MODAL_OVERLAY = "#00000096";

export function ModalFrame({
  children,
  headerRight,
  maxHeight,
  maxWidth = 140,
  theme,
  title,
  subtitle,
  width = "92%",
  zIndex = 20,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
  maxHeight?: `${number}%` | number;
  maxWidth?: number;
  theme: UiTheme;
  title: string;
  subtitle?: string;
  width?: `${number}%` | "auto" | number;
  zIndex?: number;
}) {
  return (
    <box
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      zIndex={zIndex}
      backgroundColor={MODAL_OVERLAY}
    >
      <box
        width={width}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        backgroundColor={theme.modalBg}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        <box width="100%" flexDirection="column">
          <box width="100%" flexDirection="row" justifyContent="space-between" gap={1}>
            <text fg={theme.accent} wrapMode="none">
              {title}
            </text>
            {headerRight}
          </box>
          {subtitle != null ? (
            <text fg={theme.textMuted} wrapMode="none">
              {subtitle}
            </text>
          ) : null}
        </box>
        {children}
      </box>
    </box>
  );
}

export function BranchName({
  branch,
  fg,
  theme,
}: {
  branch: BranchInfo;
  fg: ColorInput;
  theme: UiTheme;
}) {
  if (branch.kind === "remote" && branch.remoteName != null) {
    return (
      <>
        <span fg={theme.textMuted}>{`${branch.remoteName}/`}</span>
        <span fg={fg}>{getRemoteShortName(branch)}</span>
      </>
    );
  }

  return <span fg={fg}>{branch.name}</span>;
}

export function KeyCap({ label, theme }: { label: string; theme: UiTheme }) {
  return (
    <span fg={theme.accent} bg={theme.surfaceMuted}>
      {` ${label} `}
    </span>
  );
}

export function Tag({
  label,
  fg,
  bg,
  width,
}: {
  label: string;
  fg: ColorInput;
  bg: ColorInput;
  width?: number;
}) {
  const padded = width != null ? label.padEnd(width) : label;
  return (
    <span fg={fg} bg={bg}>
      {` ${padded} `}
    </span>
  );
}

export function selectItem<T>(items: readonly T[], index: number): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items[Math.max(0, Math.min(index, items.length - 1))];
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function getRemoteShortName(branch: BranchInfo): string {
  if (branch.remoteName == null) {
    return branch.name;
  }

  return branch.name.startsWith(`${branch.remoteName}/`)
    ? branch.name.slice(branch.remoteName.length + 1)
    : branch.name;
}

export function tintHex(base: string, overlay: string, alpha: number): string {
  const baseRgb = parseHexColor(base);
  const overlayRgb = parseHexColor(overlay);

  return toHexColor({
    r: Math.round(baseRgb.r + (overlayRgb.r - baseRgb.r) * alpha),
    g: Math.round(baseRgb.g + (overlayRgb.g - baseRgb.g) * alpha),
    b: Math.round(baseRgb.b + (overlayRgb.b - baseRgb.b) * alpha),
  });
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getCollapseToggleGlyph(isCollapsed: boolean): string {
  return isCollapsed ? "\u25B6" : "\u25BC";
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

function toHexColor(color: { r: number; g: number; b: number }): string {
  return `#${[color.r, color.g, color.b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}
