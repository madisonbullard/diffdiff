export interface KeyboardInput {
  name: string;
  sequence?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
}

export type CommandKeybindPrefix = "leader" | "space" | "g";

export type PrefixedCommandKeybindSegment = `<${CommandKeybindPrefix}>${string}`;
export type CommandKeybind = string;

export interface CommandDefinition {
  value: string;
  title: string;
  category: string;
  description?: string;
  disabledReason?: string;
  keybind?: CommandKeybind;
  enabled?: boolean;
  hidden?: boolean;
  keywords?: readonly string[];
  suggested?: boolean;
}

export interface ParsedCommandKeybind {
  ctrl: boolean;
  meta: boolean;
  name: string;
  prefix: CommandKeybindPrefix | null;
  shift: boolean;
  super: boolean;
}

interface CommandKeybindFormatOptions {
  leaderKeybind: string;
}

const KNOWN_PREFIXES = new Set<CommandKeybindPrefix>(["leader", "space", "g"]);

function normalizeKeyName(name: string): string {
  if (name === " ") {
    return "space";
  }

  if (name === "esc") {
    return "escape";
  }

  return name.toLowerCase();
}

function fromKeyboardInput(input: KeyboardInput): ParsedCommandKeybind {
  const keyName =
    input.name !== ""
      ? input.name
      : input.sequence != null && input.sequence.length === 1
        ? input.sequence
        : input.name;

  return {
    ctrl: input.ctrl === true,
    meta: input.meta === true,
    name: normalizeKeyName(keyName),
    prefix: null,
    shift: input.shift === true,
    super: input.super === true,
  };
}

function consumePrefixToken(entry: string): {
  keybind: string;
  prefix: CommandKeybindPrefix | null;
} {
  const prefixedMatch = entry.trim().match(/^<([a-z-]+)>(.*)$/u);
  if (prefixedMatch == null) {
    return {
      keybind: entry,
      prefix: null,
    };
  }

  const rawPrefix = prefixedMatch[1]?.trim().toLowerCase();
  if (rawPrefix == null || !KNOWN_PREFIXES.has(rawPrefix as CommandKeybindPrefix)) {
    return {
      keybind: entry,
      prefix: null,
    };
  }

  return {
    keybind: prefixedMatch[2] ?? "",
    prefix: rawPrefix as CommandKeybindPrefix,
  };
}

export function parseCommandKeybinds(keybind: CommandKeybind | undefined): ParsedCommandKeybind[] {
  if (keybind == null || keybind === "none") {
    return [];
  }

  return keybind.split(",").map((entry) => {
    const { keybind: bindingWithoutPrefix, prefix } = consumePrefixToken(entry);
    const parts = bindingWithoutPrefix.trim().split("+");
    const parsed: ParsedCommandKeybind = {
      ctrl: false,
      meta: false,
      name: "",
      prefix,
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
        case "":
          break;
        default:
          parsed.name = normalizeKeyName(part);
      }
    }

    return parsed;
  });
}

function matchesKeybind(expected: ParsedCommandKeybind, actual: ParsedCommandKeybind): boolean {
  return (
    expected.ctrl === actual.ctrl &&
    expected.meta === actual.meta &&
    expected.name === actual.name &&
    expected.prefix === actual.prefix &&
    expected.shift === actual.shift &&
    expected.super === actual.super
  );
}

function formatPrefixLabel(
  prefix: CommandKeybindPrefix,
  options: CommandKeybindFormatOptions,
): string {
  if (prefix !== "leader") {
    return prefix;
  }

  const [leader] = parseCommandKeybinds(options.leaderKeybind);
  return leader == null
    ? "leader"
    : formatParsedCommandKeybind({ ...leader, prefix: null }, options);
}

export function formatParsedCommandKeybind(
  keybind: ParsedCommandKeybind,
  options: CommandKeybindFormatOptions,
): string {
  const isQuestionMarkKeybind =
    keybind.shift && keybind.name === "/" && !keybind.ctrl && !keybind.meta && !keybind.super;
  const prefixLabel = keybind.prefix == null ? null : formatPrefixLabel(keybind.prefix, options);

  if (isQuestionMarkKeybind) {
    return prefixLabel == null ? "?" : `${prefixLabel} ?`;
  }

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
  if (prefixLabel == null) {
    return text;
  }

  return text === "" ? prefixLabel : `${prefixLabel} ${text}`;
}

function commandMatchesQuery(command: CommandDefinition, query: string): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") {
    return 0;
  }

  const title = command.title.toLowerCase();
  const category = command.category.toLowerCase();
  const description = command.description?.toLowerCase() ?? "";
  const value = command.value.toLowerCase();
  const keywords = command.keywords?.map((keyword) => keyword.toLowerCase()) ?? [];
  const words = title.split(/[^a-z0-9]+/u).filter(Boolean);

  if (title === normalizedQuery) {
    return 0;
  }

  if (value === normalizedQuery || keywords.includes(normalizedQuery)) {
    return 1;
  }

  if (title.startsWith(normalizedQuery)) {
    return 2;
  }

  if (words.some((word) => word.startsWith(normalizedQuery))) {
    return 3;
  }

  if (
    value.startsWith(normalizedQuery) ||
    keywords.some((keyword) => keyword.startsWith(normalizedQuery))
  ) {
    return 4;
  }

  if (title.includes(normalizedQuery)) {
    return 5;
  }

  if (description.includes(normalizedQuery)) {
    return 6;
  }

  if (
    value.includes(normalizedQuery) ||
    keywords.some((keyword) => keyword.includes(normalizedQuery))
  ) {
    return 7;
  }

  if (category.includes(normalizedQuery)) {
    return 8;
  }

  let queryIndex = 0;
  for (const character of title) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === normalizedQuery.length) {
        return 9;
      }
    }
  }

  return null;
}

export function isPrintableKey(input: KeyboardInput): boolean {
  return input.sequence != null && input.sequence.length === 1 && input.sequence >= " ";
}

export function matchCommandKeybind(
  keybind: CommandKeybind | undefined,
  input: KeyboardInput,
  options: {
    prefix?: CommandKeybindPrefix | null;
  } = {},
): boolean {
  if (keybind == null) {
    return false;
  }

  const parsedInput = fromKeyboardInput(input);
  return parseCommandKeybinds(keybind).some((entry) =>
    matchesKeybind(entry, { ...parsedInput, prefix: options.prefix ?? null }),
  );
}

export function getCommandBindingsForPrefix(
  keybind: CommandKeybind | undefined,
  prefix: CommandKeybindPrefix,
): ParsedCommandKeybind[] {
  return parseCommandKeybinds(keybind).filter((entry) => entry.prefix === prefix);
}

export function formatCommandKeybind(
  keybind: CommandKeybind | undefined,
  leaderKeybind: string,
): string | undefined {
  const [first] = parseCommandKeybinds(keybind);
  if (first == null) {
    return undefined;
  }

  return formatParsedCommandKeybind(first, { leaderKeybind });
}

export function formatCommandShortcuts(
  command: Pick<CommandDefinition, "keybind">,
  leaderKeybind: string,
): string | undefined {
  const parsedBindings = parseCommandKeybinds(command.keybind);
  if (parsedBindings.length === 0) {
    return undefined;
  }

  const formattedBindings: string[] = [];
  for (const binding of parsedBindings) {
    const label = formatParsedCommandKeybind(binding, { leaderKeybind });
    if (!formattedBindings.includes(label)) {
      formattedBindings.push(label);
    }
  }

  return formattedBindings.join(" / ");
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
      const leftEnabled = left.command.enabled !== false;
      const rightEnabled = right.command.enabled !== false;

      if (normalizedQuery === "") {
        if (left.command.suggested !== right.command.suggested) {
          return left.command.suggested ? -1 : 1;
        }
      }

      if (leftEnabled !== rightEnabled) {
        return leftEnabled ? -1 : 1;
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
