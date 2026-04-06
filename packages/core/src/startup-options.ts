import { parseArgs } from "node:util";
import type { ParsedStartupOptions, StartupOptions } from "./types/startup.ts";

interface StartupOptionValues {
  repo?: string;
  base?: string;
  head?: string;
  verbose?: boolean;
}

export function resolveStartupOptions(
  values: StartupOptionValues = {},
  env: NodeJS.ProcessEnv = process.env,
): StartupOptions {
  const repoPath = typeof values.repo === "string" ? values.repo : env.DIFFDIFF_REPO;
  const base = typeof values.base === "string" ? values.base : env.DIFFDIFF_BASE;
  const head = typeof values.head === "string" ? values.head : env.DIFFDIFF_HEAD;
  const verbose = values.verbose ?? parseBooleanEnvValue(env.DIFFDIFF_VERBOSE);

  return {
    repoPath,
    base,
    head,
    verbose,
  };
}

export function parseStartupOptions(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ParsedStartupOptions {
  const normalizedArgv = argv[0] === "tui" ? argv.slice(1) : argv;
  const { positionals, values } = parseArgs({
    args: [...normalizedArgv],
    allowPositionals: true,
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
      verbose: {
        type: "boolean",
        short: "v",
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
        verbose: values.verbose === true ? true : undefined,
      },
      env,
    ),
    help,
    target: typeof positionals[0] === "string" ? positionals[0] : undefined,
    version,
  };
}

export function formatHelpText(): string {
  return [
    "diffdiff [tui] [target]",
    "diffdiff pr",
    "diffdiff 42",
    "diffdiff https://github.com/diffdiff/diffdiff/pull/42",
    "diffdiff auth login --token-stdin",
    "diffdiff session list [--json]",
    "diffdiff session remove <session-id>",
    "diffdiff session remove-all",
    "",
    "A git-backed terminal code review tool.",
    "Defaults to reviewing staged, unstaged, and untracked changes against HEAD.",
    "Recognizes PR shortcuts like `pr`, PR numbers, GitHub PR URLs, and owner/repo/number.",
    "",
    "Options:",
    "  --repo, -r   Path inside the repository to review",
    "  --base, -b   Base branch or commit to compare from",
    "  --head, -H   Head branch or commit to compare to",
    "  --verbose, -v  Preserve full command/API payloads in logs",
    "  --help       Show this help text",
    "  --version    Show the current package version",
    "",
    "Environment:",
    "  DIFFDIFF_REPO",
    "  DIFFDIFF_BASE",
    "  DIFFDIFF_HEAD",
    "  DIFFDIFF_VERBOSE",
    "  DIFFDIFF_GITHUB_TOKEN",
  ].join("\n");
}

function parseBooleanEnvValue(value: string | undefined): boolean | undefined {
  if (value == null) {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return undefined;
  }
}
