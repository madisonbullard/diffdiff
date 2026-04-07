const MAX_AUTOCOMPLETE_OPTIONS = 8;

interface ReferenceLineRange {
  endLine?: number;
  startLine: number;
}

interface ParsedReferenceQuery {
  baseQuery: string;
  queryEnd: number;
  lineRange?: ReferenceLineRange;
  query: string;
  queryStart: number;
  tokenKey: string;
}

export interface ReviewComposerAutocompleteOption {
  insertText: string;
  path: string;
}

export interface ReviewComposerAutocompleteState {
  isVisible: boolean;
  options: readonly ReviewComposerAutocompleteOption[];
  query: string;
  tokenKey?: string;
}

export function buildReviewComposerAutocompleteState({
  body,
  cursorOffset,
  dismissedTokenKey,
  paths,
  selectedPath,
}: {
  body: string;
  cursorOffset: number;
  dismissedTokenKey: string | null;
  paths: readonly string[];
  selectedPath?: string;
}): ReviewComposerAutocompleteState {
  const query = parseReferenceQuery(body, cursorOffset);
  if (query == null || query.tokenKey === dismissedTokenKey) {
    return {
      isVisible: false,
      options: [],
      query: query?.query ?? "",
      tokenKey: query?.tokenKey,
    };
  }

  const options = rankPaths(paths, query.baseQuery, selectedPath).map((path) => ({
    insertText:
      query.lineRange == null
        ? path
        : `${path}#${query.lineRange.startLine}${query.lineRange.endLine == null ? "" : `-${query.lineRange.endLine}`}`,
    path,
  }));

  return {
    isVisible: true,
    options,
    query: query.query,
    tokenKey: query.tokenKey,
  };
}

export function insertReviewComposerAutocomplete(
  body: string,
  cursorOffset: number,
  option: ReviewComposerAutocompleteOption,
): { body: string; cursorOffset: number } {
  const query = parseReferenceQuery(body, cursorOffset);
  if (query == null) {
    return { body, cursorOffset };
  }

  const insertedReference = `\`${option.insertText}\` `;
  return {
    body: `${body.slice(0, query.queryStart)}${insertedReference}${body.slice(query.queryEnd)}`,
    cursorOffset: query.queryStart + insertedReference.length,
  };
}

function parseReferenceQuery(body: string, cursorOffset: number): ParsedReferenceQuery | null {
  const prefix = body.slice(0, cursorOffset);
  const match = /(^|\s)@([^\s`]*)$/u.exec(prefix);
  if (match == null) {
    return null;
  }

  const query = match[2] ?? "";
  const queryStart = prefix.length - query.length - 1;
  const { baseQuery, lineRange } = extractLineRange(query);

  return {
    baseQuery,
    queryEnd: prefix.length,
    lineRange,
    query,
    queryStart,
    tokenKey: `${queryStart}:${query}`,
  };
}

function extractLineRange(input: string): { baseQuery: string; lineRange?: ReferenceLineRange } {
  const hashIndex = input.lastIndexOf("#");
  if (hashIndex === -1) {
    return { baseQuery: input };
  }

  const baseQuery = input.slice(0, hashIndex);
  const linePart = input.slice(hashIndex + 1);
  const lineMatch = linePart.match(/^(\d+)(?:-(\d*))?$/u);
  if (lineMatch == null) {
    return { baseQuery };
  }

  const startLine = Number(lineMatch[1]);
  const rawEndLine = lineMatch[2];
  const endLine =
    rawEndLine == null || rawEndLine === "" || Number(rawEndLine) <= startLine
      ? undefined
      : Number(rawEndLine);

  return {
    baseQuery,
    lineRange: {
      endLine,
      startLine,
    },
  };
}

function rankPaths(
  paths: readonly string[],
  baseQuery: string,
  selectedPath: string | undefined,
): string[] {
  const normalizedQuery = baseQuery.toLowerCase();
  const uniquePaths = [...new Set(paths)];

  return uniquePaths
    .filter((path) => matchesPath(path, normalizedQuery))
    .sort((left, right) => comparePaths(left, right, normalizedQuery, selectedPath))
    .slice(0, MAX_AUTOCOMPLETE_OPTIONS);
}

function matchesPath(path: string, normalizedQuery: string): boolean {
  if (normalizedQuery === "") {
    return true;
  }

  const normalizedPath = path.toLowerCase();
  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;
  return normalizedPath.includes(normalizedQuery) || fileName.includes(normalizedQuery);
}

function comparePaths(
  left: string,
  right: string,
  normalizedQuery: string,
  selectedPath: string | undefined,
): number {
  const scoreDifference =
    scorePath(right, normalizedQuery, selectedPath) -
    scorePath(left, normalizedQuery, selectedPath);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const depthDifference = left.split("/").length - right.split("/").length;
  if (depthDifference !== 0) {
    return depthDifference;
  }

  return left.localeCompare(right);
}

function scorePath(
  path: string,
  normalizedQuery: string,
  selectedPath: string | undefined,
): number {
  let score = path === selectedPath ? 1000 : 0;
  if (normalizedQuery === "") {
    return score + 100;
  }

  const normalizedPath = path.toLowerCase();
  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;
  if (normalizedPath.startsWith(normalizedQuery)) {
    score += 160;
  }
  if (fileName.startsWith(normalizedQuery)) {
    score += 140;
  }
  if (normalizedPath.includes(`/${normalizedQuery}`)) {
    score += 120;
  }
  if (fileName.includes(normalizedQuery)) {
    score += 80;
  }
  if (normalizedPath.includes(normalizedQuery)) {
    score += 40;
  }

  return score;
}
