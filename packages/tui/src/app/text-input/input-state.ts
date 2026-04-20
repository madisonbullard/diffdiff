import { getKeyboardInputName, type KeyboardInput } from "../../keyboard-input.ts";

export interface TextInputSnapshot {
  cursorOffset: number;
  preferredColumn: number | null;
  value: string;
}

export interface TextInputState extends TextInputSnapshot {
  redoStack: readonly TextInputSnapshot[];
  undoStack: readonly TextInputSnapshot[];
}

export interface ApplyTextInputKeyOptions {
  allowCtrlELineEnd?: boolean;
  multiline?: boolean;
}

export interface ApplyTextInputKeyResult {
  handled: boolean;
  nextState: TextInputState;
}

export function createTextInputState(value = ""): TextInputState {
  return {
    cursorOffset: value.length,
    preferredColumn: null,
    redoStack: [],
    undoStack: [],
    value,
  };
}

export function replaceTextInput(
  state: TextInputState,
  value: string,
  options: {
    clearHistory?: boolean;
    cursorOffset?: number;
  } = {},
): TextInputState {
  const nextState: TextInputState = {
    cursorOffset: clampCursor(value, options.cursorOffset ?? value.length),
    preferredColumn: null,
    redoStack: options.clearHistory === false ? state.redoStack : [],
    undoStack: options.clearHistory === false ? state.undoStack : [],
    value,
  };

  return areTextInputsEqual(state, nextState) ? state : nextState;
}

export function insertTextInputText(state: TextInputState, text: string): TextInputState {
  if (text === "") {
    return state;
  }

  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  return withSnapshot(state, {
    cursorOffset: cursorOffset + text.length,
    preferredColumn: null,
    value: `${state.value.slice(0, cursorOffset)}${text}${state.value.slice(cursorOffset)}`,
  });
}

export function insertTextInputNewline(state: TextInputState): TextInputState {
  return insertTextInputText(state, "\n");
}

export function backspaceTextInput(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  if (cursorOffset === 0) {
    return state;
  }

  return deleteTextRange(state, cursorOffset - 1, cursorOffset);
}

export function deleteTextInput(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  if (cursorOffset >= state.value.length) {
    return state;
  }

  return deleteTextRange(state, cursorOffset, cursorOffset + 1);
}

export function moveTextInputCursorLeft(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  return moveCursor(state, Math.max(cursorOffset - 1, 0));
}

export function moveTextInputCursorRight(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  return moveCursor(state, Math.min(cursorOffset + 1, state.value.length));
}

export function moveTextInputCursorUp(state: TextInputState): TextInputState {
  return moveCursorVertically(state, -1);
}

export function moveTextInputCursorDown(state: TextInputState): TextInputState {
  return moveCursorVertically(state, 1);
}

export function moveTextInputCursorLineStart(state: TextInputState): TextInputState {
  return moveCursor(state, getLineStart(state.value, state.cursorOffset));
}

export function moveTextInputCursorLineEnd(state: TextInputState): TextInputState {
  return moveCursor(state, getLineEnd(state.value, state.cursorOffset));
}

export function moveTextInputCursorBufferStart(state: TextInputState): TextInputState {
  return moveCursor(state, 0);
}

export function moveTextInputCursorBufferEnd(state: TextInputState): TextInputState {
  return moveCursor(state, state.value.length);
}

export function moveTextInputCursorWordBackward(state: TextInputState): TextInputState {
  return moveCursor(state, getWordBoundaryBackward(state.value, state.cursorOffset));
}

export function moveTextInputCursorWordForward(state: TextInputState): TextInputState {
  return moveCursor(state, getWordBoundaryForward(state.value, state.cursorOffset));
}

export function deleteTextInputToLineStart(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  return deleteTextRange(state, getLineStart(state.value, cursorOffset), cursorOffset);
}

export function deleteTextInputToLineEnd(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  return deleteTextRange(state, cursorOffset, getLineEnd(state.value, cursorOffset));
}

export function deleteTextInputWordBackward(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  return deleteTextRange(state, getWordBoundaryBackward(state.value, cursorOffset), cursorOffset);
}

export function deleteTextInputWordForward(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  return deleteTextRange(state, cursorOffset, getWordBoundaryForward(state.value, cursorOffset));
}

export function deleteTextInputLine(state: TextInputState): TextInputState {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  const start = getLineStart(state.value, cursorOffset);
  let end = getLineEnd(state.value, cursorOffset);
  if (end < state.value.length) {
    end += 1;
  }
  return deleteTextRange(state, start, end);
}

export function undoTextInput(state: TextInputState): TextInputState {
  const previous = state.undoStack.at(-1);
  if (previous == null) {
    return state;
  }

  return {
    ...previous,
    redoStack: [...state.redoStack, snapshot(state)],
    undoStack: state.undoStack.slice(0, -1),
  };
}

export function redoTextInput(state: TextInputState): TextInputState {
  const next = state.redoStack.at(-1);
  if (next == null) {
    return state;
  }

  return {
    ...next,
    redoStack: state.redoStack.slice(0, -1),
    undoStack: [...state.undoStack, snapshot(state)],
  };
}

export function getTextInputLineIndex(state: TextInputState): number {
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  let lineIndex = 0;
  for (let index = 0; index < cursorOffset; index += 1) {
    if (state.value[index] === "\n") {
      lineIndex += 1;
    }
  }
  return lineIndex;
}

export function getTextInputLineCount(state: TextInputState): number {
  return state.value === "" ? 1 : state.value.split("\n").length;
}

export function isTextInputOnFirstLine(state: TextInputState): boolean {
  return getTextInputLineIndex(state) === 0;
}

export function isTextInputOnLastLine(state: TextInputState): boolean {
  return getTextInputLineIndex(state) === getTextInputLineCount(state) - 1;
}

export function applyTextInputKey(
  state: TextInputState,
  key: KeyboardInput,
  options: ApplyTextInputKeyOptions = {},
): ApplyTextInputKeyResult {
  const multiline = options.multiline === true;
  const keyName = getKeyboardInputName(key);

  if (isEditablePrintableKey(key)) {
    return { handled: true, nextState: insertTextInputText(state, key.sequence!) };
  }

  if (key.super === true) {
    if (keyName === "left" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorLineStart(state) };
    }
    if (keyName === "right" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorLineEnd(state) };
    }
    if (keyName === "up" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorBufferStart(state) };
    }
    if (keyName === "down" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorBufferEnd(state) };
    }
    if (keyName === "z" && key.shift !== true) {
      return { handled: true, nextState: undoTextInput(state) };
    }
    if (keyName === "z" && key.shift === true) {
      return { handled: true, nextState: redoTextInput(state) };
    }
    if (keyName === "backspace" && !key.shift) {
      return { handled: true, nextState: deleteTextInputLine(state) };
    }
  }

  if (key.ctrl === true) {
    if (keyName === "a" && key.shift !== true) {
      return { handled: true, nextState: moveTextInputCursorLineStart(state) };
    }
    if (keyName === "e" && key.shift !== true && options.allowCtrlELineEnd === true) {
      return { handled: true, nextState: moveTextInputCursorLineEnd(state) };
    }
    if (keyName === "b" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorLeft(state) };
    }
    if (keyName === "f" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorRight(state) };
    }
    if (keyName === "w" && !key.shift) {
      return { handled: true, nextState: deleteTextInputWordBackward(state) };
    }
    if (keyName === "d" && !key.shift) {
      return { handled: true, nextState: deleteTextInput(state) };
    }
    if (keyName === "d" && key.shift === true) {
      return { handled: true, nextState: deleteTextInputLine(state) };
    }
    if (keyName === "k" && !key.shift) {
      return { handled: true, nextState: deleteTextInputToLineEnd(state) };
    }
    if (keyName === "u" && !key.shift) {
      return { handled: true, nextState: deleteTextInputToLineStart(state) };
    }
    if (keyName === "left" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorWordBackward(state) };
    }
    if (keyName === "right" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorWordForward(state) };
    }
    if (keyName === "delete" && !key.shift) {
      return { handled: true, nextState: deleteTextInputWordForward(state) };
    }
    if (keyName === "backspace" && !key.shift) {
      return { handled: true, nextState: deleteTextInputWordBackward(state) };
    }
    if (keyName === "-" && !key.shift) {
      return { handled: true, nextState: undoTextInput(state) };
    }
    if (keyName === "." && !key.shift) {
      return { handled: true, nextState: redoTextInput(state) };
    }
    if (multiline && (keyName === "j" || keyName === "return") && !key.shift) {
      return { handled: true, nextState: insertTextInputNewline(state) };
    }
  }

  if (key.meta === true) {
    if (keyName === "a" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorLineStart(state) };
    }
    if (keyName === "e" && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorLineEnd(state) };
    }
    if ((keyName === "b" || keyName === "left") && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorWordBackward(state) };
    }
    if ((keyName === "f" || keyName === "right") && !key.shift) {
      return { handled: true, nextState: moveTextInputCursorWordForward(state) };
    }
    if (keyName === "d" || keyName === "delete") {
      return { handled: true, nextState: deleteTextInputWordForward(state) };
    }
    if (keyName === "backspace") {
      return { handled: true, nextState: deleteTextInputWordBackward(state) };
    }
    if (multiline && keyName === "return" && !key.shift) {
      return { handled: true, nextState: insertTextInputNewline(state) };
    }
  }

  if (keyName === "left" && !hasModifier(key)) {
    return { handled: true, nextState: moveTextInputCursorLeft(state) };
  }
  if (keyName === "right" && !hasModifier(key)) {
    return { handled: true, nextState: moveTextInputCursorRight(state) };
  }
  if (keyName === "backspace" && key.shift === true && key.ctrl !== true && key.meta !== true) {
    return { handled: true, nextState: backspaceTextInput(state) };
  }
  if (keyName === "backspace" && !hasModifier(key)) {
    return { handled: true, nextState: backspaceTextInput(state) };
  }
  if (keyName === "up" && !hasModifier(key) && multiline) {
    return { handled: true, nextState: moveTextInputCursorUp(state) };
  }
  if (keyName === "down" && !hasModifier(key) && multiline) {
    return { handled: true, nextState: moveTextInputCursorDown(state) };
  }
  if (keyName === "home" && !hasModifier(key)) {
    return { handled: true, nextState: moveTextInputCursorBufferStart(state) };
  }
  if (keyName === "end" && !hasModifier(key)) {
    return { handled: true, nextState: moveTextInputCursorBufferEnd(state) };
  }
  if (keyName === "delete" && key.shift === true && key.ctrl !== true && key.meta !== true) {
    return { handled: true, nextState: deleteTextInput(state) };
  }
  if (keyName === "delete" && !hasModifier(key)) {
    return { handled: true, nextState: deleteTextInput(state) };
  }

  return { handled: false, nextState: state };
}

function isEditablePrintableKey(key: KeyboardInput): boolean {
  return (
    key.sequence != null &&
    key.sequence.length === 1 &&
    key.sequence >= " " &&
    key.sequence !== "\x7f" &&
    key.ctrl !== true &&
    key.meta !== true &&
    key.super !== true
  );
}

function hasModifier(key: KeyboardInput): boolean {
  return key.ctrl === true || key.meta === true || key.shift === true || key.super === true;
}

function moveCursor(state: TextInputState, cursorOffset: number): TextInputState {
  const clampedOffset = clampCursor(state.value, cursorOffset);
  if (clampedOffset === state.cursorOffset && state.preferredColumn == null) {
    return state;
  }

  return {
    ...state,
    cursorOffset: clampedOffset,
    preferredColumn: null,
  };
}

function moveCursorVertically(state: TextInputState, delta: -1 | 1): TextInputState {
  const lines = state.value.split("\n");
  const cursorOffset = clampCursor(state.value, state.cursorOffset);
  const currentLineIndex = getTextInputLineIndex(state);
  const targetLineIndex = Math.max(0, Math.min(currentLineIndex + delta, lines.length - 1));

  if (currentLineIndex === targetLineIndex) {
    return state;
  }

  const currentLineStart = getLineStart(state.value, cursorOffset);
  const preferredColumn = state.preferredColumn ?? cursorOffset - currentLineStart;
  const targetLineStart = getLineStartOffset(lines, targetLineIndex);
  const targetLineLength = lines[targetLineIndex]?.length ?? 0;
  const targetOffset = targetLineStart + Math.min(preferredColumn, targetLineLength);

  return {
    ...state,
    cursorOffset: targetOffset,
    preferredColumn,
  };
}

function deleteTextRange(state: TextInputState, start: number, end: number): TextInputState {
  const normalizedStart = Math.max(0, Math.min(start, end));
  const normalizedEnd = Math.min(state.value.length, Math.max(start, end));
  if (normalizedStart === normalizedEnd) {
    return state;
  }

  return withSnapshot(state, {
    cursorOffset: normalizedStart,
    preferredColumn: null,
    value: `${state.value.slice(0, normalizedStart)}${state.value.slice(normalizedEnd)}`,
  });
}

function withSnapshot(state: TextInputState, next: TextInputSnapshot): TextInputState {
  const nextState: TextInputState = {
    ...next,
    cursorOffset: clampCursor(next.value, next.cursorOffset),
    redoStack: [],
    undoStack: [...state.undoStack, snapshot(state)],
  };

  return areTextInputsEqual(state, nextState) ? state : nextState;
}

function snapshot(state: TextInputState): TextInputSnapshot {
  return {
    cursorOffset: clampCursor(state.value, state.cursorOffset),
    preferredColumn: state.preferredColumn,
    value: state.value,
  };
}

function areTextInputsEqual(left: TextInputState, right: TextInputState): boolean {
  return (
    left.value === right.value &&
    left.cursorOffset === right.cursorOffset &&
    left.preferredColumn === right.preferredColumn &&
    left.undoStack === right.undoStack &&
    left.redoStack === right.redoStack
  );
}

function clampCursor(value: string, cursorOffset: number): number {
  return Math.max(0, Math.min(cursorOffset, value.length));
}

function getLineStart(value: string, cursorOffset: number): number {
  const clampedOffset = clampCursor(value, cursorOffset);
  return value.lastIndexOf("\n", Math.max(clampedOffset - 1, 0)) + 1;
}

function getLineEnd(value: string, cursorOffset: number): number {
  const clampedOffset = clampCursor(value, cursorOffset);
  const lineEnd = value.indexOf("\n", clampedOffset);
  return lineEnd === -1 ? value.length : lineEnd;
}

function getWordBoundaryBackward(value: string, cursorOffset: number): number {
  let nextOffset = clampCursor(value, cursorOffset);

  while (nextOffset > 0 && isWordSeparator(value[nextOffset - 1]!)) {
    nextOffset -= 1;
  }
  while (nextOffset > 0 && !isWordSeparator(value[nextOffset - 1]!)) {
    nextOffset -= 1;
  }

  return nextOffset;
}

function getWordBoundaryForward(value: string, cursorOffset: number): number {
  let nextOffset = clampCursor(value, cursorOffset);

  while (nextOffset < value.length && isWordSeparator(value[nextOffset]!)) {
    nextOffset += 1;
  }
  while (nextOffset < value.length && !isWordSeparator(value[nextOffset]!)) {
    nextOffset += 1;
  }

  return nextOffset;
}

function getLineStartOffset(lines: readonly string[], lineIndex: number): number {
  let offset = 0;
  for (let index = 0; index < lineIndex; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }
  return offset;
}

function isWordSeparator(character: string): boolean {
  return /\s/u.test(character);
}
