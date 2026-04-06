interface StartupOptionValues {
  base?: string;
  head?: string;
  repo?: string;
  verbose?: boolean;
}

interface CommandOptionReader {
  optsWithGlobals(): Record<string, unknown>;
}

export function getStartupOptionValues(command: CommandOptionReader): StartupOptionValues {
  const values = command.optsWithGlobals();

  return {
    base: typeof values.base === "string" ? values.base : undefined,
    head: typeof values.head === "string" ? values.head : undefined,
    repo: typeof values.repo === "string" ? values.repo : undefined,
    verbose: values.verbose === true ? true : undefined,
  };
}
