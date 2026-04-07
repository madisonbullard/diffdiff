export type KeymapPrefixId = "leader" | "space" | "g" | "s";

export interface KeymapPrefixDefinition {
  readonly nodeLabel: string;
  readonly prefix: KeymapPrefixId;
  readonly triggerKeybind: string;
}

export const LEADER_PREFIX: KeymapPrefixDefinition = {
  nodeLabel: "Leader",
  prefix: "leader",
  triggerKeybind: "ctrl+x",
};

export const SPACE_PREFIX: KeymapPrefixDefinition = {
  nodeLabel: "Modal Picker",
  prefix: "space",
  triggerKeybind: "space",
};

export const GOTO_PREFIX: KeymapPrefixDefinition = {
  nodeLabel: "Goto",
  prefix: "g",
  triggerKeybind: "g",
};

export const IN_FILE_PREFIX: KeymapPrefixDefinition = {
  nodeLabel: "In File",
  prefix: "s",
  triggerKeybind: "s",
};

const KEYMAP_PREFIXES: Readonly<Record<KeymapPrefixId, KeymapPrefixDefinition>> = {
  g: GOTO_PREFIX,
  leader: LEADER_PREFIX,
  s: IN_FILE_PREFIX,
  space: SPACE_PREFIX,
};

export function getKeymapPrefix(prefix: KeymapPrefixId): KeymapPrefixDefinition {
  return KEYMAP_PREFIXES[prefix];
}

export function findKeymapPrefixByNodeLabel(label: string): KeymapPrefixDefinition | undefined {
  return Object.values(KEYMAP_PREFIXES).find((prefix) => prefix.nodeLabel === label);
}
