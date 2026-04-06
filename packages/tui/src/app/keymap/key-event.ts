/**
 * Utilities for normalising raw terminal key input into the canonical
 * `KeyEvent` used by the keymap trie.
 */

import type { KeyboardInput } from "../../keyboard-input.ts";
import type { KeyEvent } from "./types.ts";

// ---------------------------------------------------------------------------
// Canonical key name normalisation
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string> = {
  " ": "space",
  esc: "escape",
  del: "delete",
  cr: "return",
  enter: "return",
};

const SHIFTED_PRINTABLE_CHAR_ALIASES: Record<string, string> = {
  "~": "`",
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
  _: "-",
  "+": "=",
  "{": "[",
  "}": "]",
  "|": "\\",
  ":": ";",
  '"': "'",
  "<": ",",
  ">": ".",
  "?": "/",
};

function normalizeKeyName(raw: string): string {
  const lower = raw.toLowerCase();
  return ALIASES[lower] ?? lower;
}

function normalizePrintableCharacter(char: string): Pick<KeyEvent, "key" | "shift"> | null {
  if (char.length !== 1 || char < " ") {
    return null;
  }

  if (char === " ") {
    return { key: "space", shift: false };
  }

  if (char >= "A" && char <= "Z") {
    return { key: char.toLowerCase(), shift: true };
  }

  const shiftedBaseKey = SHIFTED_PRINTABLE_CHAR_ALIASES[char];
  if (shiftedBaseKey != null) {
    return { key: shiftedBaseKey, shift: true };
  }

  return { key: normalizeKeyName(char), shift: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert the opentui `KeyboardInput` into the canonical form stored inside
 * keymap tries. The result is always lower-cased and has modifiers pulled
 * into boolean flags.
 */
export function keyEventFromInput(input: KeyboardInput): KeyEvent {
  const printableEvent =
    input.sequence != null ? normalizePrintableCharacter(input.sequence) : null;

  if (printableEvent != null) {
    return {
      key: printableEvent.key,
      ctrl: input.ctrl === true,
      meta: input.meta === true,
      shift: input.shift === true || printableEvent.shift,
    };
  }

  const keyName =
    input.name !== ""
      ? input.name
      : input.sequence != null && input.sequence.length === 1
        ? input.sequence
        : input.name;

  return {
    key: normalizeKeyName(keyName),
    ctrl: input.ctrl === true,
    meta: input.meta === true,
    shift: input.shift === true,
  };
}

/**
 * Serialise a `KeyEvent` into the compact string used as trie-node map keys.
 *
 * Format: `[C-][A-][S-]<key>`
 *
 * Examples: `"j"`, `"shift+r"`, `"ctrl+x"`, `"ctrl+shift+p"`
 */
export function serializeKeyEvent(event: KeyEvent): string {
  const parts: string[] = [];
  if (event.ctrl) parts.push("ctrl");
  if (event.meta) parts.push("alt");
  if (event.shift) parts.push("shift");
  parts.push(event.key);
  return parts.join("+");
}

/**
 * Parse a human-authored key string (e.g. `"ctrl+x"`, `"shift+r"`, `"j"`)
 * into a `KeyEvent`.
 */
export function parseKeyString(raw: string): KeyEvent {
  const trimmed = raw.trim();

  const normalized = raw.trim().toLowerCase();

  // Handle bare space before splitting on "+"
  if (normalized === "" && raw === " ") {
    return { key: "space", ctrl: false, meta: false, shift: false };
  }

  if (!trimmed.includes("+")) {
    const printableEvent = normalizePrintableCharacter(trimmed);
    if (printableEvent != null) {
      return {
        key: printableEvent.key,
        ctrl: false,
        meta: false,
        shift: printableEvent.shift,
      };
    }
  }

  if (normalized === "space") {
    return { key: "space", ctrl: false, meta: false, shift: false };
  }

  const parts = normalized.split("+");
  const event: KeyEvent = { key: "", ctrl: false, meta: false, shift: false };

  for (const part of parts) {
    switch (part) {
      case "ctrl":
      case "c":
        if (parts.length > 1 && part === "c") {
          // Bare "c" at end is a key, not a modifier
          event.key = "c";
        } else if (part === "ctrl") {
          event.ctrl = true;
        } else {
          event.key = part;
        }
        break;
      case "alt":
      case "meta":
      case "option":
        event.meta = true;
        break;
      case "shift":
        event.shift = true;
        break;
      case "super":
        // Ignored — we don't track super separately in the trie.
        break;
      default:
        event.key = normalizeKeyName(part);
    }
  }

  return event;
}

/**
 * Format a `KeyEvent` for display to the user (e.g. in the help modal).
 *
 * Special-cases `shift+/` → `?` for readability.
 */
export function formatKeyEvent(event: KeyEvent): string {
  if (event.shift && event.key === "/" && !event.ctrl && !event.meta) {
    return "?";
  }

  const parts: string[] = [];
  if (event.ctrl) parts.push("ctrl");
  if (event.meta) parts.push("alt");
  if (event.shift) parts.push("shift");
  parts.push(event.key === "delete" ? "del" : event.key);
  return parts.join("+");
}

/**
 * Format a full key sequence for display.
 */
export function formatKeySequence(sequence: readonly KeyEvent[]): string {
  return sequence.map(formatKeyEvent).join(" ");
}
