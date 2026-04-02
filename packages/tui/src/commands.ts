export interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
}

export interface CommandDefinition {
  value: string;
  title: string;
  category: string;
  description?: string;
  keybind?: string;
  enabled?: boolean;
  hidden?: boolean;
  suggested?: boolean;
}

interface KeybindInfo {
  ctrl: boolean;
  leader: boolean;
  meta: boolean;
  name: string;
  shift: boolean;
  super: boolean;
}

function normalizeKeyName(name: string): string {
  if (name === " ") {
    return "space";
  }

  if (name === "esc") {
    return "escape";
  }

  return name.toLowerCase();
}

function fromKeyboardInput(input: KeyboardInput, leader: boolean): KeybindInfo {
  const keyName =
    input.name !== ""
      ? input.name
      : input.sequence != null && input.sequence.length === 1
        ? input.sequence
        : input.name;

  return {
    ctrl: input.ctrl === true,
    leader,
    meta: input.meta === true,
    name: normalizeKeyName(keyName),
    shift: input.shift === true,
    super: input.super === true,
  };
}

function parseKeybind(keybind: string): KeybindInfo[] {
  if (keybind === "none") {
    return [];
  }

  return keybind.split(",").map((entry) => {
    const parts = entry.trim().replaceAll("<leader>", "leader+").split("+");
    const parsed: KeybindInfo = {
      ctrl: false,
      leader: false,
      meta: false,
      name: "",
      shift: false,
      super: false,
    };

    for (const rawPart of parts) {
      const part = rawPart.trim().toLowerCase();

      switch (part) {
        case "ctrl":
          parsed.ctrl = true;
          break;
        case "alt":
        case "meta":
        case "option":
          parsed.meta = true;
          break;
        case "shift":
          parsed.shift = true;
          break;
        case "super":
          parsed.super = true;
          break;
        case "leader":
          parsed.leader = true;
          break;
        case "":
          break;
        default:
          parsed.name = normalizeKeyName(part);
      }
    }

    return parsed;
  });
}

function matchesKeybind(expected: KeybindInfo, actual: KeybindInfo): boolean {
  return (
    expected.ctrl === actual.ctrl &&
    expected.leader === actual.leader &&
    expected.meta === actual.meta &&
    expected.name === actual.name &&
    expected.shift === actual.shift &&
    expected.super === actual.super
  );
}

function formatParsedKeybind(keybind: KeybindInfo, leaderLabel?: string): string {
  const parts: string[] = [];

  if (keybind.ctrl) {
    parts.push("ctrl");
  }

  if (keybind.meta) {
    parts.push("alt");
  }

  if (keybind.super) {
    parts.push("super");
  }

  if (keybind.shift) {
    parts.push("shift");
  }

  if (keybind.name !== "") {
    parts.push(keybind.name === "delete" ? "del" : keybind.name);
  }

  const text = parts.join("+");
  if (!keybind.leader) {
    return text;
  }

  return text === "" ? (leaderLabel ?? "leader") : `${leaderLabel ?? "leader"} ${text}`;
}

function commandMatchesQuery(command: CommandDefinition, query: string): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") {
    return 0;
  }

  const title = command.title.toLowerCase();
  const category = command.category.toLowerCase();
  const description = command.description?.toLowerCase() ?? "";
  const words = title.split(/[^a-z0-9]+/u).filter(Boolean);

  if (title === normalizedQuery) {
    return 0;
  }

  if (title.startsWith(normalizedQuery)) {
    return 1;
  }

  if (words.some((word) => word.startsWith(normalizedQuery))) {
    return 2;
  }

  if (title.includes(normalizedQuery)) {
    return 3;
  }

  if (description.includes(normalizedQuery)) {
    return 4;
  }

  if (category.includes(normalizedQuery)) {
    return 5;
  }

  let queryIndex = 0;
  for (const character of title) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === normalizedQuery.length) {
        return 6;
      }
    }
  }

  return null;
}

export function isPrintableKey(input: KeyboardInput): boolean {
  return input.sequence != null && input.sequence.length === 1 && input.sequence >= " ";
}

export function matchCommandKeybind(
  keybind: string | undefined,
  input: KeyboardInput,
  leaderActive = false,
): boolean {
  if (keybind == null) {
    return false;
  }

  const parsedInput = fromKeyboardInput(input, leaderActive);
  return parseKeybind(keybind).some((entry) => matchesKeybind(entry, parsedInput));
}

export function formatCommandKeybind(
  keybind: string | undefined,
  leaderKeybind: string,
): string | undefined {
  if (keybind == null) {
    return undefined;
  }

  const [first] = parseKeybind(keybind);
  if (first == null) {
    return undefined;
  }

  const [leader] = parseKeybind(leaderKeybind);
  const leaderLabel =
    leader == null ? "leader" : formatParsedKeybind({ ...leader, leader: false }, undefined);
  return formatParsedKeybind(first, leaderLabel);
}

export function filterCommands<T extends CommandDefinition>(
  commands: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  return commands
    .map((command) => ({ command, score: commandMatchesQuery(command, normalizedQuery) }))
    .filter((entry) => entry.score != null)
    .sort((left, right) => {
      if (normalizedQuery === "") {
        if (left.command.suggested !== right.command.suggested) {
          return left.command.suggested ? -1 : 1;
        }
      }

      if (left.score !== right.score) {
        return (left.score ?? Number.MAX_SAFE_INTEGER) - (right.score ?? Number.MAX_SAFE_INTEGER);
      }

      const categoryResult = left.command.category.localeCompare(right.command.category);
      if (categoryResult !== 0) {
        return categoryResult;
      }

      return left.command.title.localeCompare(right.command.title);
    })
    .map((entry) => entry.command);
}
