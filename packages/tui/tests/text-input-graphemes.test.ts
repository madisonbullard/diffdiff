import { expect, test } from "vite-plus/test";
import {
  applyTextInputKey,
  createTextInputState,
  replaceTextInput,
} from "../src/app/text-input/input-state.ts";

test("typing accepts a multi-codepoint grapheme", () => {
  const result = applyTextInputKey(createTextInputState(), { name: "👩🏽‍💻", sequence: "👩🏽‍💻" });
  expect(result.handled).toBe(true);
  expect(result.nextState.value).toBe("👩🏽‍💻");
});

test("arrows, backspace, and delete cross whole graphemes", () => {
  const text = "A👩🏽‍💻e\u0301李";
  let state = createTextInputState(text);
  state = applyTextInputKey(state, { name: "left" }).nextState;
  expect(state.cursorOffset).toBe(10);
  state = applyTextInputKey(state, { name: "left" }).nextState;
  expect(state.cursorOffset).toBe(8);
  state = applyTextInputKey(state, { name: "backspace" }).nextState;
  expect(state.value).toBe("Ae\u0301李");
  state = applyTextInputKey(state, { name: "delete" }).nextState;
  expect(state.value).toBe("A李");
  state = applyTextInputKey(state, { name: "right" }).nextState;
  expect(state.cursorOffset).toBe(2);
});

test("vertical movement keeps a logical grapheme column without splitting an emoji", () => {
  let state = createTextInputState("a\n👩🏽‍💻x");
  state = applyTextInputKey(state, { name: "home" }).nextState;
  state = applyTextInputKey(state, { name: "right" }).nextState;
  state = applyTextInputKey(state, { name: "down" }, { multiline: true }).nextState;
  expect(state.cursorOffset).toBe(9);
  state = applyTextInputKey(state, { name: "up" }, { multiline: true }).nextState;
  expect(state.cursorOffset).toBe(1);
});

test("word deletion does not separate a combining mark from its whitespace base", () => {
  const state = applyTextInputKey(createTextInputState(" \u0301word"), {
    name: "w",
    ctrl: true,
  }).nextState;
  expect(state.value).toBe(" \u0301");
});

test("restoring an input clamps a stale UTF-16 cursor to a grapheme boundary", () => {
  const state = replaceTextInput(createTextInputState(), "A👩🏽‍💻B", { cursorOffset: 4 });
  expect(state.cursorOffset).toBe(1);
  expect(applyTextInputKey(state, { name: "delete" }).nextState.value).toBe("AB");
});

test("inserting before a combining mark places the caret after the composed grapheme", () => {
  let state = replaceTextInput(createTextInputState(), "\u0301x", { cursorOffset: 0 });
  state = applyTextInputKey(state, { name: "e", sequence: "e" }).nextState;
  expect(state.value).toBe("e\u0301x");
  expect(state.cursorOffset).toBe(2);
});
