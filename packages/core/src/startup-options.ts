import { parseArgs } from "node:util";
import type { ParsedStartupOptions } from "./types.ts";

export function parseStartupOptions(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ParsedStartupOptions {
  const { values } = parseArgs({
    args: [...argv],
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
        short: "h",
      },
      help: {
        type: "boolean",
      },
      version: {
        type: "boolean",
      },
    },
  });

  const repoPath = typeof values.repo === "string" ? values.repo : env.DIFFDIFF_REPO;
  const base = typeof values.base === "string" ? values.base : env.DIFFDIFF_BASE;
  const head = typeof values.head === "string" ? values.head : env.DIFFDIFF_HEAD;
  const help = values.help === true;
  const version = values.version === true;

  return {
    repoPath,
    base,
    head,
    help,
    version,
  };
}

export function formatHelpText(): string {
  return [
    "diffdiff",
    "",
    "A git-backed terminal code review tool.",
    "",
    "Options:",
    "  --repo, -r   Path inside the repository to review",
    "  --base, -b   Base branch or commit to compare from",
    "  --head, -h   Head branch or commit to compare to",
    "  --help       Show this help text",
    "  --version    Show the current package version",
    "",
    "Environment:",
    "  DIFFDIFF_REPO",
    "  DIFFDIFF_BASE",
    "  DIFFDIFF_HEAD",
  ].join("\n");
}
