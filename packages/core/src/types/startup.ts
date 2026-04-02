export interface StartupOptions {
  repoPath?: string;
  base?: string;
  head?: string;
  verbose?: boolean;
}

export interface ParsedStartupOptions extends StartupOptions {
  help: boolean;
  version: boolean;
}
