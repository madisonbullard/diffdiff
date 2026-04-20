export interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
}

const RAW_KEY_NAME_ALIASES: Record<string, string> = {
  "\b": "backspace",
  "\x7f": "backspace",
};

export function getKeyboardInputName(input: KeyboardInput): string {
  const rawName =
    input.name !== ""
      ? input.name
      : input.sequence != null && input.sequence.length === 1
        ? input.sequence
        : input.name;

  return RAW_KEY_NAME_ALIASES[rawName] ?? rawName;
}

export function isPrintableKey(input: KeyboardInput): boolean {
  return (
    input.sequence != null &&
    input.sequence.length === 1 &&
    input.sequence >= " " &&
    input.sequence !== "\x7f"
  );
}
