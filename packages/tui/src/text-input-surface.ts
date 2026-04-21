export interface TextInputSurface {
  cursorOffset: number;
  value: string;
}

export function createTextInputSurface(input: TextInputSurface): TextInputSurface {
  return {
    cursorOffset: input.cursorOffset,
    value: input.value,
  };
}
