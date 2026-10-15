// Proposal-only presentational primitives for the menu/modal unification mockups.
// These are NOT production components: they exist to prove that the proposed
// layouts fit real OpenTUI/Yoga geometry at 80x24 and 120x40. Production code
// would derive labels from the live keymap and data from dialog view models.
import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import type { UiTheme } from "../../../packages/tui/src/theme.ts";

export const BOLD = TextAttributes.BOLD;
export const DIM = TextAttributes.DIM;
export const ITALIC = TextAttributes.ITALIC;

// ---------------------------------------------------------------------------
// Tokens: every color a dialog uses is derived from the existing UiTheme.
// ---------------------------------------------------------------------------

export interface DialogTokens {
  bg: string;
  /** Fill for non-modal popovers (key menus), which sit on the undimmed app. */
  popoverBg: string;
  border: string;
  focus: string;
  warning: string;
  danger: string;
  success: string;
  text: string;
  muted: string;
  subtle: string;
  key: string;
  cursorBg: string;
  matchFg: string;
  rule: string;
  backdropFg: string;
  backdropBg: string;
  appFg: string;
  appBg: string;
  footerBg: string;
  raised: string;
  warningBg: string;
  dangerBg: string;
}

export function dialogTokens(theme: UiTheme): DialogTokens {
  // A transparent app background shows the terminal's own background, which
  // createTerminalUiTheme also stores as inverseText.
  const app = theme.appBackground === "transparent" ? theme.inverseText : theme.appBackground;
  const dark = luminance(theme.modalBg) < 0.5;
  // Borderless panels separate by fill alone (D1). Dark themes lift the panel
  // toward the border color; light themes keep the white modalBg over a darker
  // scrim, and give non-modal popovers (no scrim) a tint darker than the app.
  const bg = dark ? mix(theme.modalBg, theme.border, 0.45) : theme.modalBg;
  const backdropBg = mix(app, "#000000", dark ? 0.4 : 0.15);
  return {
    bg,
    popoverBg: dark ? bg : mix(app, theme.border, 0.55),
    border: theme.border,
    focus: theme.borderActive,
    warning: theme.warning,
    danger: theme.danger,
    success: theme.success,
    text: theme.text,
    muted: theme.textMuted,
    subtle: mix(theme.textMuted, bg, 0.4),
    key: theme.accent,
    cursorBg: mix(bg, theme.accent, 0.2),
    matchFg: theme.warning,
    rule: mix(theme.border, bg, 0.3),
    backdropFg: mix(theme.textMuted, backdropBg, 0.6),
    backdropBg,
    appFg: theme.textMuted,
    appBg: app,
    footerBg: theme.chromeBackground,
    raised: mix(bg, theme.text, 0.08),
    warningBg: mix(bg, theme.warning, 0.16),
    dangerBg: mix(bg, theme.danger, 0.16),
  };
}

export function mix(base: string, overlay: string, alpha: number): string {
  const a = hex(base);
  const b = hex(overlay);
  const c = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * alpha);
  return `#${[c(0), c(1), c(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(color: string): number {
  const [r, g, b] = hex(color);
  return (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
}

function hex(color: string): number[] {
  return [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
}

// ---------------------------------------------------------------------------
// Display-width helpers (production: shared util backed by Bun.stringWidth).
// ---------------------------------------------------------------------------

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function width(text: string): number {
  return Bun.stringWidth(text);
}

export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (width(text) <= max) return text;
  let out = "";
  for (const { segment } of segmenter.segment(text)) {
    if (width(out + segment) > max - 1) break;
    out += segment;
  }
  return `${out}…`;
}

export function truncateMiddle(text: string, max: number): string {
  if (width(text) <= max) return text;
  const keep = Math.max(1, max - 1);
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

export function pad(text: string, cells: number): string {
  return text + " ".repeat(Math.max(0, cells - width(text)));
}

// ---------------------------------------------------------------------------
// Geometry: one pure resolver for every family (unit-testable in production).
// ---------------------------------------------------------------------------

export type Family = "picker" | "inspector" | "form" | "confirm";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Full-screen sheet below 30 rows or 100 columns: no padding rows, 1-column sides. */
  sheet: boolean;
}

const MAX_WIDTH: Record<Family, number> = { picker: 92, inspector: 118, form: 96, confirm: 64 };

/**
 * Regular (>= 100x30): floating panel, top-anchored one row below the app
 * header so filtering never makes it jump. Compact: a sheet that covers the
 * app header and leaves the global footer row visible.
 */
export function resolveRect(
  family: Family,
  cols: number,
  rows: number,
  { headerRows = 4, contentRows }: { headerRows?: number; contentRows?: number } = {},
): Rect {
  if (family === "confirm") {
    // Confirmations always float, centered, at every size.
    const w = Math.min(MAX_WIDTH.confirm, cols - 4);
    const h = Math.min(contentRows ?? 8, rows - 3);
    return {
      left: Math.floor((cols - w) / 2),
      top: Math.max(1, Math.floor((rows - 1 - h) / 2)),
      width: w,
      height: h,
      sheet: false,
    };
  }
  if (rows < 30 || cols < 100)
    return { left: 0, top: 0, width: cols, height: rows - 1, sheet: true };
  const w = Math.min(MAX_WIDTH[family], cols - 8);
  const top = headerRows;
  const max = rows - top - 2;
  const h = contentRows == null ? max : Math.min(max, contentRows);
  return { left: Math.floor((cols - w) / 2), top, width: w, height: h, sheet: false };
}

// ---------------------------------------------------------------------------
// Panel: borderless tinted surface (decision D1). Title row, body, optional
// status row, action bar. Floating panels pad 2 columns / 1 row; sheets pad
// 1 column and no rows, so the title sits on row 0 and the bar above the footer.
// ---------------------------------------------------------------------------

export type Tone = "focus" | "muted" | "warning" | "danger";

export function padX(rect: Rect): number {
  return rect.sheet ? 1 : 2;
}

export function padY(rect: Rect): number {
  return rect.sheet ? 0 : 1;
}

/** Usable cells between the panel's horizontal padding. */
export function innerWidth(rect: Rect): number {
  return rect.width - 2 * padX(rect);
}

export function DialogPanel({
  actions,
  children,
  context,
  position,
  rect,
  status,
  t,
  title,
  tone = "focus",
  zIndex = 20,
  closeLabel = "esc",
  tabs,
  raised = false,
  popover = false,
}: {
  tabs?: { label: string; active: boolean }[];
  actions?: ReactNode;
  children: ReactNode;
  context?: string;
  closeLabel?: string;
  position?: string;
  rect: Rect;
  status?: ReactNode;
  t: DialogTokens;
  title: string;
  tone?: Tone;
  zIndex?: number;
  raised?: boolean;
  /** Non-modal popover over the undimmed app (key menus). */
  popover?: boolean;
}) {
  const cells = innerWidth(rect);
  const right = [position, closeLabel].filter(Boolean).join("  ");
  const marker = tone === "warning" || tone === "danger" ? "▲ " : "";
  const tabsText = (tabs ?? []).map((tab) => ` ${tab.label} `).join("");
  const lead = tabs == null ? width(marker) + width(title) : width(tabsText);
  const budget = cells - lead - 2 - (right === "" ? 0 : width(right) + 2);
  const contextText = context != null && budget >= 6 ? truncate(context, budget) : "";
  const bg = raised ? t.raised : popover ? t.popoverBg : t.bg;
  return (
    <box
      position="absolute"
      left={rect.left}
      top={rect.top}
      width={rect.width}
      height={rect.height}
      zIndex={zIndex}
      flexDirection="column"
      backgroundColor={bg}
      paddingLeft={padX(rect)}
      paddingRight={padX(rect)}
      paddingTop={padY(rect)}
      paddingBottom={padY(rect)}
    >
      <box height={1} flexShrink={0} flexDirection="row">
        <text flexGrow={1} wrapMode="none">
          {marker !== "" ? (
            <span fg={toneColor(tone, t)} attributes={BOLD}>
              {marker}
            </span>
          ) : null}
          {tabs == null ? (
            <span fg={tone === "muted" ? t.muted : t.text} attributes={BOLD}>
              {title}
            </span>
          ) : (
            tabs.map((tab) => (
              <span
                key={tab.label}
                fg={tab.active ? t.bg : t.muted}
                bg={tab.active ? t.key : bg}
                attributes={tab.active ? BOLD : 0}
              >{` ${tab.label} `}</span>
            ))
          )}
          {contextText !== "" ? <span fg={t.muted}>{`  ${contextText}`}</span> : null}
        </text>
        {right !== "" ? (
          <text flexShrink={0} wrapMode="none" fg={t.subtle}>
            {right}
          </text>
        ) : null}
      </box>
      <box flexGrow={1} flexShrink={1} flexDirection="column" overflow="hidden">
        {children}
      </box>
      {status != null ? (
        <box height={1} flexShrink={0} flexDirection="row">
          {status}
        </box>
      ) : null}
      {actions != null ? (
        <box height={1} flexShrink={0} flexDirection="row">
          {actions}
        </box>
      ) : null}
    </box>
  );
}

export function toneColor(tone: Tone, t: DialogTokens): string {
  return tone === "warning"
    ? t.warning
    : tone === "danger"
      ? t.danger
      : tone === "muted"
        ? t.border
        : t.focus;
}

// ---------------------------------------------------------------------------
// Action bar: key-first hints, primary first, cancel never dropped.
// ---------------------------------------------------------------------------

export interface Hint {
  key: string;
  label: string;
  primary?: boolean;
  tone?: "danger" | "warning";
  disabled?: boolean;
}

export function ActionBar({
  hints,
  right,
  t,
  width: cells,
}: {
  hints: Hint[];
  right?: Hint[];
  t: DialogTokens;
  width: number;
}) {
  const rightWidth = (right ?? []).reduce(
    (sum, hint) => sum + width(hint.key) + 1 + width(hint.label) + 2,
    0,
  );
  const visible: Hint[] = [];
  let used = 0;
  for (const hint of hints) {
    const cost = width(hint.key) + 1 + width(hint.label) + 2;
    if (used + cost > cells - rightWidth && !hint.primary) continue;
    used += cost;
    visible.push(hint);
  }
  return (
    <>
      <text flexGrow={1} wrapMode="none">
        {visible.map((hint, index) => (
          <HintSpan key={`${hint.key}:${index}`} hint={hint} t={t} />
        ))}
      </text>
      {right != null ? (
        <text flexShrink={0} wrapMode="none">
          {right.map((hint, index) => (
            <HintSpan
              key={`r:${hint.key}:${index}`}
              hint={hint}
              t={t}
              last={index === right.length - 1}
            />
          ))}
        </text>
      ) : null}
    </>
  );
}

function HintSpan({ hint, last = false, t }: { hint: Hint; last?: boolean; t: DialogTokens }) {
  const labelColor = hint.disabled
    ? t.subtle
    : hint.tone === "danger"
      ? t.danger
      : hint.tone === "warning"
        ? t.warning
        : hint.primary
          ? t.text
          : t.muted;
  return (
    <>
      <span fg={hint.disabled ? t.subtle : t.key} attributes={hint.primary ? BOLD : 0}>
        {hint.key}
      </span>
      <span
        fg={labelColor}
        attributes={hint.primary ? BOLD : 0}
      >{` ${hint.label}${last ? "" : "  "}`}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Rows and lists.
// ---------------------------------------------------------------------------

export function Row({
  cursor = false,
  children,
  right,
  t,
}: {
  cursor?: boolean;
  children: ReactNode;
  right?: ReactNode;
  t: DialogTokens;
}) {
  return (
    <box
      height={1}
      flexShrink={0}
      flexDirection="row"
      backgroundColor={cursor ? t.cursorBg : undefined}
    >
      <text width={2} flexShrink={0} fg={t.key} attributes={BOLD}>
        {cursor ? "›" : " "}
      </text>
      <text flexGrow={1} flexShrink={1} wrapMode="none" fg={cursor ? t.text : t.text}>
        {children}
      </text>
      {right != null ? (
        <text flexShrink={0} wrapMode="none" marginLeft={1}>
          {right}
        </text>
      ) : null}
    </box>
  );
}

export function Section({ label, t, right }: { label: string; t: DialogTokens; right?: string }) {
  return (
    <box height={1} flexShrink={0} flexDirection="row">
      <text flexGrow={1} wrapMode="none" fg={t.muted} attributes={BOLD}>{`  ${label}`}</text>
      {right != null ? (
        <text flexShrink={0} fg={t.subtle}>
          {right}
        </text>
      ) : null}
    </box>
  );
}

export function Rule({ t }: { t: DialogTokens }) {
  return (
    <box height={1} flexShrink={0} border={["top"]} borderStyle="single" borderColor={t.rule} />
  );
}

export function Blank() {
  return <box height={1} flexShrink={0} />;
}

export function QueryRow({
  query,
  placeholder,
  right,
  t,
  focused = true,
  cells,
}: {
  query: string;
  placeholder: string;
  right?: string;
  t: DialogTokens;
  focused?: boolean;
  cells: number;
}) {
  // Priority: the caret and typed query never truncate; the hint on the right
  // is dropped before the placeholder is shortened.
  const typed = query === "" ? placeholder : `${query} `;
  const showRight = right != null && width(typed) + 2 + 2 + width(right) <= cells;
  const budget = cells - 2 - (showRight ? width(right!) + 2 : 0);
  const text = query === "" ? truncate(placeholder, budget) : query;
  return (
    <box height={1} flexShrink={0} flexDirection="row">
      <text flexGrow={1} wrapMode="none">
        <span fg={focused ? t.key : t.muted} attributes={BOLD}>
          {"› "}
        </span>
        {query === "" ? (
          <>
            {focused ? (
              <span bg={t.key} fg={t.bg}>
                {text.slice(0, 1)}
              </span>
            ) : null}
            <span fg={t.subtle}>{focused ? text.slice(1) : text}</span>
          </>
        ) : (
          <>
            <span fg={t.text}>{text}</span>
            {focused ? (
              <span bg={t.key} fg={t.bg}>
                {" "}
              </span>
            ) : null}
          </>
        )}
      </text>
      {showRight ? (
        <text flexShrink={0} wrapMode="none" fg={t.subtle}>
          {right}
        </text>
      ) : null}
    </box>
  );
}

/** Highlight fuzzy-matched characters (production: indexes from the scorer). */
export function Matched({
  text,
  query,
  t,
  base,
}: {
  text: string;
  query: string;
  t: DialogTokens;
  base?: string;
}) {
  if (query === "") return <span fg={base ?? t.text}>{text}</span>;
  const lower = text.toLowerCase();
  const start = lower.indexOf(query.toLowerCase());
  if (start < 0) return <span fg={base ?? t.text}>{text}</span>;
  return (
    <>
      <span fg={base ?? t.text}>{text.slice(0, start)}</span>
      <span fg={t.matchFg} attributes={BOLD}>
        {text.slice(start, start + query.length)}
      </span>
      <span fg={base ?? t.text}>{text.slice(start + query.length)}</span>
    </>
  );
}

export function Keys({ label, t, dim = false }: { label: string; t: DialogTokens; dim?: boolean }) {
  return <span fg={dim ? t.subtle : t.key}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Backdrop and global footer (the real app, dimmed behind the dialog).
// ---------------------------------------------------------------------------

export function Backdrop({
  lines,
  t,
  cols,
  scrim = true,
}: {
  lines: string[];
  t: DialogTokens;
  cols: number;
  scrim?: boolean;
}) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={cols}
      height={lines.length}
      flexDirection="column"
      backgroundColor={scrim ? t.backdropBg : t.appBg}
    >
      {lines.map((line, index) => (
        <text key={index} height={1} wrapMode="none" fg={scrim ? t.backdropFg : t.appFg}>
          {line}
        </text>
      ))}
    </box>
  );
}

export function GlobalFooter({
  badge,
  status,
  cols,
  rows,
  t,
  right,
}: {
  badge: string;
  status: string;
  cols: number;
  rows: number;
  t: DialogTokens;
  right?: string;
}) {
  return (
    <box
      position="absolute"
      left={0}
      top={rows - 1}
      width={cols}
      height={1}
      zIndex={40}
      backgroundColor={t.footerBg}
      flexDirection="row"
      paddingLeft={2}
      paddingRight={2}
    >
      <text flexShrink={0} wrapMode="none">
        <span fg={t.bg} bg={t.key}>{` ${badge} `}</span>
        {right != null ? <span fg={t.muted}>{`  ${right}`}</span> : null}
      </text>
      <box flexGrow={1} />
      <text flexShrink={0} wrapMode="none" fg={t.muted}>
        {status}
      </text>
    </box>
  );
}

/**
 * Status row. Warning and danger tones paint a full-bleed band across the
 * panel: without a border, the band is what turns the frame amber or red.
 */
export function Status({
  glyph,
  text,
  tone,
  t,
  trailing,
  bleed = 2,
}: {
  glyph: string;
  text: string;
  tone: "pending" | "danger" | "warning" | "success" | "muted";
  t: DialogTokens;
  trailing?: ReactNode;
  /** The panel's horizontal padding, so the band reaches both edges. */
  bleed?: number;
}) {
  const color =
    tone === "danger"
      ? t.danger
      : tone === "warning"
        ? t.warning
        : tone === "success"
          ? t.success
          : tone === "pending"
            ? t.key
            : t.muted;
  const band = tone === "danger" ? t.dangerBg : tone === "warning" ? t.warningBg : undefined;
  return (
    <box
      flexGrow={1}
      height={1}
      flexDirection="row"
      backgroundColor={band}
      marginLeft={band == null ? 0 : -bleed}
      marginRight={band == null ? 0 : -bleed}
      paddingLeft={band == null ? 0 : bleed}
      paddingRight={band == null ? 0 : bleed}
    >
      <text flexGrow={1} wrapMode="none">
        <span fg={color} attributes={BOLD}>{`${glyph} `}</span>
        <span fg={tone === "muted" ? t.muted : t.text}>{text}</span>
        {trailing}
      </text>
    </box>
  );
}
