export interface StartupOptions {
  repoPath?: string;
  base?: string;
  head?: string;
  verbose?: boolean;
  /** Load expensive branch-browser enrichment. Defaults to true for core callers. */
  loadComparisonDetails?: boolean;
}

export interface ParsedStartupOptions extends StartupOptions {
  target?: string;
  help: boolean;
  version: boolean;
}
