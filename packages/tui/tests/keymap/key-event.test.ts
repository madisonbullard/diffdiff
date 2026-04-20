import { describe, expect, test } from "vite-plus/test";
import {
  formatKeyEvent,
  formatKeySequence,
  keyEventFromInput,
  parseKeyString,
  serializeKeyEvent,
} from "../../src/app/keymap/key-event.ts";

describe("parseKeyString", () => {
  test("parses a bare key", () => {
    expect(parseKeyString("j")).toEqual({ key: "j", ctrl: false, meta: false, shift: false });
  });

  test("parses ctrl modifier", () => {
    expect(parseKeyString("ctrl+x")).toEqual({ key: "x", ctrl: true, meta: false, shift: false });
  });

  test("parses shift modifier", () => {
    expect(parseKeyString("shift+r")).toEqual({ key: "r", ctrl: false, meta: false, shift: true });
  });

  test("parses alt/meta modifier", () => {
    expect(parseKeyString("alt+p")).toEqual({ key: "p", ctrl: false, meta: true, shift: false });
  });

  test("parses combined modifiers", () => {
    expect(parseKeyString("ctrl+shift+p")).toEqual({
      key: "p",
      ctrl: true,
      meta: false,
      shift: true,
    });
  });

  test("normalizes space alias", () => {
    expect(parseKeyString(" ")).toEqual({ key: "space", ctrl: false, meta: false, shift: false });
  });

  test("normalizes escape alias", () => {
    expect(parseKeyString("esc")).toEqual({
      key: "escape",
      ctrl: false,
      meta: false,
      shift: false,
    });
  });

  test("normalizes enter alias", () => {
    expect(parseKeyString("enter")).toEqual({
      key: "return",
      ctrl: false,
      meta: false,
      shift: false,
    });
  });
});

describe("serializeKeyEvent", () => {
  test("serializes a bare key", () => {
    expect(serializeKeyEvent({ key: "j", ctrl: false, meta: false, shift: false })).toBe("j");
  });

  test("serializes with modifiers", () => {
    expect(serializeKeyEvent({ key: "x", ctrl: true, meta: false, shift: false })).toBe("ctrl+x");
  });

  test("round-trips through parse", () => {
    const original = "ctrl+shift+p";
    expect(serializeKeyEvent(parseKeyString(original))).toBe(original);
  });
});

describe("keyEventFromInput", () => {
  test("converts an opentui KeyboardInput", () => {
    expect(keyEventFromInput({ name: "j", sequence: "j" })).toEqual({
      key: "j",
      ctrl: false,
      meta: false,
      shift: false,
    });
  });

  test("uses sequence as fallback when name is empty", () => {
    expect(keyEventFromInput({ name: "", sequence: "/" })).toEqual({
      key: "/",
      ctrl: false,
      meta: false,
      shift: false,
    });
  });

  test("normalizes raw DEL input as backspace", () => {
    expect(keyEventFromInput({ name: "", sequence: "\x7f" })).toEqual({
      key: "backspace",
      ctrl: false,
      meta: false,
      shift: false,
    });
  });

  test("carries modifier flags", () => {
    expect(keyEventFromInput({ name: "r", shift: true })).toEqual({
      key: "r",
      ctrl: false,
      meta: false,
      shift: true,
    });
  });
});

describe("formatKeyEvent", () => {
  test("formats a bare key", () => {
    expect(formatKeyEvent({ key: "j", ctrl: false, meta: false, shift: false })).toBe("j");
  });

  test("formats shift+/ as ?", () => {
    expect(formatKeyEvent({ key: "/", ctrl: false, meta: false, shift: true })).toBe("?");
  });

  test("formats combined modifiers", () => {
    expect(formatKeyEvent({ key: "p", ctrl: true, meta: false, shift: true })).toBe("ctrl+shift+p");
  });
});

describe("formatKeySequence", () => {
  test("formats a multi-key sequence", () => {
    expect(
      formatKeySequence([
        { key: "x", ctrl: true, meta: false, shift: false },
        { key: "l", ctrl: false, meta: false, shift: false },
      ]),
    ).toBe("ctrl+x l");
  });
});
