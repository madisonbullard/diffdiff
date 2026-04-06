export interface CommandDefinition {
  value: string;
  title: string;
  category: string;
  description?: string;
  disabledReason?: string;
  enabled?: boolean;
  hidden?: boolean;
  keywords?: readonly string[];
  suggested?: boolean;
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
