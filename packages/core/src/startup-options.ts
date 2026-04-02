import { parseArgs } from "node:util";
import type { ParsedStartupOptions, StartupOptions } from "./types/startup.ts";

export interface StartupOptionValues {
  repo?: string;
  base?: string;
  head?: string;
}

export function resolveStartupOptions(
  values: StartupOptionValues = {},
  env: NodeJS.ProcessEnv = process.env,
): StartupOptions {
  const repoPath = typeof values.repo === "string" ? values.repo : env.DIFFDIFF_REPO;
  const base = typeof values.base === "string" ? values.base : env.DIFFDIFF_BASE;
  const head = typeof values.head === "string" ? values.head : env.DIFFDIFF_HEAD;

  return {
    repoPath,
    base,
    head,
  };
}

export function parseStartupOptions(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ParsedStartupOptions {
  const normalizedArgv = argv[0] === "tui" ? argv.slice(1) : argv;
  const { values } = parseArgs({
    args: [...normalizedArgv],
    allowPositionals: false,
    strict: false,
    options: {
      repo: {
        type: "string",
        short: "r",
      },
      base: {
        type: "string",
        short: "b",
      },
      head: {
        type: "string",
        short: "H",
      },
      help: {
        type: "boolean",
      },
      version: {
        type: "boolean",
      },
    },
  });

  const help = values.help === true;
  const version = values.version === true;

  return {
    ...resolveStartupOptions(
      {
        base: typeof values.base === "string" ? values.base : undefined,
        head: typeof values.head === "string" ? values.head : undefined,
        repo: typeof values.repo === "string" ? values.repo : undefined,
      },
      env,
    ),
    help,
    version,
  };
}

export function formatHelpText(): string {
  return [
    "diffdiff [tui]",
    "diffdiff auth login --token-stdin",
    "diffdiff session list [--json]",
    "diffdiff session remove <session-id>",
    "diffdiff session remove-all",
    "",
    "A git-backed terminal code review tool.",
    "Defaults to reviewing staged, unstaged, and untracked changes against HEAD.",
    "",
    "Options:",
    "  --repo, -r   Path inside the repository to review",
    "  --base, -b   Base branch or commit to compare from",
    "  --head, -H   Head branch or commit to compare to",
    "  --help       Show this help text",
    "  --version    Show the current package version",
    "",
    "Environment:",
    "  DIFFDIFF_REPO",
    "  DIFFDIFF_BASE",
    "  DIFFDIFF_HEAD",
    "  DIFFDIFF_GITHUB_TOKEN",
  ].join("\n");
}
