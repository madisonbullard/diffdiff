export interface StartupOptions {
  repoPath?: string;
  base?: string;
  head?: string;
  verbose?: boolean;
}

export interface ParsedStartupOptions extends StartupOptions {
  target?: string;
  help: boolean;
  version: boolean;
}
