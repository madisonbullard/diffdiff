import path from "node:path";

// Copied from OpenCode's TUI language mapping and normalized for OpenTUI diffs.
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ".abap": "abap",
  ".astro": "astro",
  ".bat": "bat",
  ".bib": "bibtex",
  ".bibtex": "bibtex",
  ".c": "c",
  ".c++": "cpp",
  ".cc": "cpp",
  ".cjs": "javascript",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  ".coffee": "coffeescript",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".cshtml": "razor",
  ".css": "css",
  ".css.erb": "erb",
  ".cts": "typescript",
  ".ctsx": "typescriptreact",
  ".cxx": "cpp",
  ".d": "d",
  ".dart": "dart",
  ".diff": "diff",
  ".dockerfile": "dockerfile",
  ".edn": "clojure",
  ".erb": "erb",
  ".erl": "erlang",
  ".ets": "typescript",
  ".ex": "elixir",
  ".exs": "elixir",
  ".fs": "fsharp",
  ".fsi": "fsharp",
  ".fsscript": "fsharp",
  ".fsx": "fsharp",
  ".gitcommit": "git-commit",
  ".gitrebase": "git-rebase",
  ".gleam": "gleam",
  ".go": "go",
  ".gemspec": "ruby",
  ".groovy": "groovy",
  ".hbs": "handlebars",
  ".handlebars": "handlebars",
  ".hcl": "hcl",
  ".hrl": "erlang",
  ".hs": "haskell",
  ".htm": "html",
  ".html": "html",
  ".html.erb": "erb",
  ".ini": "ini",
  ".jade": "jade",
  ".java": "java",
  ".jl": "julia",
  ".js": "javascript",
  ".js.erb": "erb",
  ".json": "json",
  ".jsonc": "jsonc",
  ".json.erb": "erb",
  ".jsonl": "jsonl",
  ".jsx": "javascriptreact",
  ".bash": "shellscript",
  ".bash_logout": "shellscript",
  ".bash_profile": "shellscript",
  ".bashrc": "shellscript",
  ".envrc": "shellscript",
  ".ksh": "shellscript",
  ".kshrc": "shellscript",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".latex": "latex",
  ".less": "less",
  ".lhs": "haskell",
  ".lua": "lua",
  ".m": "objective-c",
  ".makefile": "makefile",
  ".markdown": "markdown",
  ".md": "markdown",
  ".mjs": "javascript",
  ".ml": "ocaml",
  ".mli": "ocaml",
  ".mm": "objective-cpp",
  ".mts": "typescript",
  ".mtsx": "typescriptreact",
  ".nix": "nix",
  ".pas": "pascal",
  ".pascal": "pascal",
  ".patch": "diff",
  ".php": "php",
  ".pl": "perl",
  ".pm": "perl",
  ".pm6": "perl6",
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".pug": "jade",
  ".py": "python",
  ".r": "r",
  ".rake": "ruby",
  ".razor": "razor",
  ".rb": "ruby",
  ".rs": "rust",
  ".ru": "ruby",
  ".sass": "sass",
  ".scala": "scala",
  ".scss": "scss",
  ".shader": "shaderlab",
  ".sh": "shellscript",
  ".sql": "sql",
  ".svelte": "svelte",
  ".swift": "swift",
  ".tex": "latex",
  ".tf": "terraform",
  ".tfvars": "terraform-vars",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".typ": "typst",
  ".typc": "typst",
  ".vue": "vue",
  ".xml": "xml",
  ".xsl": "xsl",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".zig": "zig",
  ".zon": "zig",
  ".profile": "shellscript",
  ".zsh": "shellscript",
  ".zlogin": "shellscript",
  ".zlogout": "shellscript",
  ".zprofile": "shellscript",
  makefile: "makefile",
  ".zshenv": "shellscript",
  ".zshrc": "shellscript",
} as const;

const LANGUAGE_ALIASES: Record<string, string> = {
  bash: "shellscript",
  ksh: "shellscript",
  sh: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
};

const PIERRE_LANGUAGE_ALIASES: Record<string, string> = {
  javascriptreact: "jsx",
  "terraform-vars": "tfvars",
  typescriptreact: "tsx",
};

const SHELL_SHEBANG_PATTERN =
  /^[ +-]?#!\s*(?:\/usr\/bin\/env(?:\s+-S)?\s+)?(?:\S*\/)?(?:bash|ksh|sh|zsh)\b/mu;

export function resolveSyntaxLanguage(options: {
  hintedLanguage?: string;
  path?: string;
  patch?: string;
}): string | undefined {
  const hintedLanguage = normalizeSyntaxLanguage(options.hintedLanguage);
  if (hintedLanguage != null) {
    return hintedLanguage;
  }

  const pathLanguage = getPathLanguage(options.path);
  if (pathLanguage != null) {
    return pathLanguage;
  }

  if (options.patch != null && SHELL_SHEBANG_PATTERN.test(options.patch)) {
    return "shellscript";
  }

  return undefined;
}

export function resolvePierreLanguage(options: {
  hintedLanguage?: string;
  path?: string;
  patch?: string;
}): string | undefined {
  const language = resolveSyntaxLanguage(options);
  if (language == null) {
    return undefined;
  }

  return PIERRE_LANGUAGE_ALIASES[language] ?? language;
}

export function getDiffFiletype(input?: string, patch?: string): string | undefined {
  if (!input && !patch) {
    return "none";
  }

  return resolveSyntaxLanguage({ path: input, patch });
}

function getPathLanguage(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }

  const normalizedPath = input.toLowerCase();
  const extension = path.extname(normalizedPath);
  const language =
    LANGUAGE_EXTENSIONS[extension] ?? LANGUAGE_EXTENSIONS[path.basename(normalizedPath)];

  if (language == null) {
    return undefined;
  }

  return normalizeSyntaxLanguage(language);
}

function normalizeSyntaxLanguage(language?: string): string | undefined {
  if (language == null || language.trim() === "") {
    return undefined;
  }

  return LANGUAGE_ALIASES[language.toLowerCase()] ?? language;
}
