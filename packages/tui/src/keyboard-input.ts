export interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
}

export function isPrintableKey(input: KeyboardInput): boolean {
  return input.sequence != null && input.sequence.length === 1 && input.sequence >= " ";
}
