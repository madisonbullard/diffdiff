import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  CLI_PACKAGE_NAME,
  DEFAULT_RELEASE_DIRECTORY,
  INTERNAL_WORKSPACE_PACKAGES,
  MANIFEST_SNAPSHOT_PATH,
  PUBLISHABLE_PACKAGES,
  RELEASE_MANIFEST_FILENAME,
  RELEASE_STATE_DIRECTORY,
  REPO_ROOT,
  ROOT_PACKAGE_PATH,
  VERSIONED_MANIFEST_PATHS,
} from "./config.mjs";

export {
  CLI_PACKAGE_NAME,
  DEFAULT_RELEASE_DIRECTORY,
  PUBLISHABLE_PACKAGES,
  REPO_ROOT,
  ROOT_PACKAGE_PATH,
};

export function parseArgs(argv) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const trimmed = token.slice(2);
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex >= 0) {
      const key = trimmed.slice(0, equalsIndex);
      const value = trimmed.slice(equalsIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (next != null && !next.startsWith("--")) {
      args[trimmed] = next;
      index += 1;
      continue;
    }

    args[trimmed] = true;
  }

  return args;
}

export function requireStringArg(args, key) {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required --${key} argument.`);
  }
  return value;
}

export function optionalStringArg(args, key) {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function resolveBooleanArg(args, key, defaultValue = false) {
  const value = args[key];
  if (value == null) {
    return defaultValue;
  }
  if (value === true) {
    return true;
  }
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }
  throw new Error(`Expected --${key} to be true or false.`);
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function ensureDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true });
}

export function resetDirectory(directoryPath) {
  rmSync(directoryPath, { recursive: true, force: true });
  mkdirSync(directoryPath, { recursive: true });
}

export function resolveFromRepoRoot(filePath = ".") {
  return path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (options.check !== false && result.status !== 0) {
    const failureMessage = options.capture
      ? result.stderr || result.stdout || `Command failed: ${command} ${args.join(" ")}`
      : `Command failed: ${command} ${args.join(" ")}`;
    throw new Error(failureMessage.trim());
  }

  return result;
}

export function shellQuote(value) {
  return `'${String(value).replaceAll(`'`, `'"'"'`)}'`;
}

export function runShell(command, options = {}) {
  return run("bash", ["-lc", command], options);
}

export async function fetchPublishedVersion(packageName) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = await response.json();
    return typeof payload.version === "string" ? payload.version : undefined;
  } catch {
    return undefined;
  }
}

export function getLatestStableTagVersion() {
  const output = run("git", ["tag", "--list", "v*", "--sort=-v:refname"], {
    capture: true,
  }).stdout.trim();
  if (output.length === 0) {
    return undefined;
  }

  const tags = output
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const stableTag = tags.find((tag) => !tag.includes("-"));
  return stableTag?.slice(1);
}

export function bumpVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match == null) {
    throw new Error(`Cannot bump non-stable version ${version}.`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unsupported bump type ${bump}.`);
  }
}

export function formatUtcTimestamp(date = new Date()) {
  const year = `${date.getUTCFullYear()}`;
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hour = `${date.getUTCHours()}`.padStart(2, "0");
  const minute = `${date.getUTCMinutes()}`.padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}`;
}

export function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version ${version}.`);
  }
}

export function writeGithubOutputs(output) {
  if (process.env.GITHUB_OUTPUT == null) {
    return;
  }

  const lines = Object.entries(output).map(([key, value]) => `${key}=${String(value)}`);
  writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, { flag: "a" });
}

export function createReleaseContext({ channel, version }) {
  validateVersion(version);

  const normalizedChannel = channel === "latest" ? "latest" : channel;
  const isPreview = normalizedChannel !== "latest";
  const isPrerelease = isPreview || version.includes("-");

  return {
    channel: normalizedChannel,
    version,
    tag: `v${version}`,
    npmTag: isPreview ? normalizedChannel : "latest",
    isPreview,
    isPrerelease,
  };
}

export async function resolveReleaseContext({ channel, bump, version }) {
  const normalizedChannel = channel ?? (version?.includes("-") ? "next" : "latest");

  if (normalizedChannel == null || normalizedChannel.length === 0) {
    throw new Error("Release channel is required.");
  }

  if (version != null) {
    return createReleaseContext({ channel: normalizedChannel, version });
  }

  if (normalizedChannel === "latest") {
    if (bump == null) {
      throw new Error("Stable releases require either --version or --bump.");
    }

    const currentVersion =
      (await fetchPublishedVersion(CLI_PACKAGE_NAME)) ?? getLatestStableTagVersion() ?? "0.0.0";
    const nextVersion = bumpVersion(currentVersion, bump);
    return createReleaseContext({ channel: normalizedChannel, version: nextVersion });
  }

  return createReleaseContext({
    channel: normalizedChannel,
    version: `0.0.0-${normalizedChannel}.${formatUtcTimestamp()}`,
  });
}

export function rewriteVersionedManifests(version, { writeSnapshot = true } = {}) {
  ensureDirectory(RELEASE_STATE_DIRECTORY);

  if (writeSnapshot && !existsSync(MANIFEST_SNAPSHOT_PATH)) {
    const snapshot = {};
    for (const manifestPath of VERSIONED_MANIFEST_PATHS) {
      snapshot[path.relative(REPO_ROOT, manifestPath)] = readFileSync(manifestPath, "utf8");
    }
    writeJson(MANIFEST_SNAPSHOT_PATH, snapshot);
  }

  for (const manifestPath of VERSIONED_MANIFEST_PATHS) {
    const pkg = readJson(manifestPath);
    if (typeof pkg.version === "string") {
      pkg.version = version;
    }

    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      const dependencyMap = pkg[field];
      if (dependencyMap == null || typeof dependencyMap !== "object") {
        continue;
      }

      for (const [dependencyName, currentValue] of Object.entries(dependencyMap)) {
        if (typeof currentValue !== "string") {
          continue;
        }
        if (!currentValue.startsWith("workspace:")) {
          continue;
        }
        if (!INTERNAL_WORKSPACE_PACKAGES.has(dependencyName)) {
          continue;
        }
        dependencyMap[dependencyName] = version;
      }
    }

    writeJson(manifestPath, pkg);
  }
}

export function restoreManifestSnapshot() {
  if (!existsSync(MANIFEST_SNAPSHOT_PATH)) {
    throw new Error("No manifest snapshot found to restore.");
  }

  const snapshot = readJson(MANIFEST_SNAPSHOT_PATH);
  for (const [relativePath, contents] of Object.entries(snapshot)) {
    writeFileSync(path.join(REPO_ROOT, relativePath), contents, "utf8");
  }

  rmSync(MANIFEST_SNAPSHOT_PATH, { force: true });
}

export function packPackage(pkg, directoryPath) {
  // `vp pm` is not reliably invocable from inside `vp run` subprocesses, so the
  // release scripts call the workspace package manager directly for tarball
  // pack/publish after Vite+ has already handled install/build/test orchestration.
  const result = runShell(
    `pnpm --filter ${shellQuote(pkg.name)} pack --pack-destination ${shellQuote(directoryPath)} --json`,
    { capture: true },
  );

  const packed = JSON.parse(result.stdout.trim());
  return {
    name: packed.name,
    version: packed.version,
    filename: path.basename(packed.filename),
    publishAccess: pkg.publishAccess,
  };
}

export function writeReleaseManifest(directoryPath, manifest) {
  ensureDirectory(directoryPath);
  writeJson(path.join(directoryPath, RELEASE_MANIFEST_FILENAME), manifest);
}

export function loadReleaseManifest(directoryPath) {
  return readJson(path.join(directoryPath, RELEASE_MANIFEST_FILENAME));
}

export function getPackageConfig(packageName) {
  return PUBLISHABLE_PACKAGES.find((pkg) => pkg.name === packageName);
}

export function configureGitUser() {
  const userName = process.env.GIT_AUTHOR_NAME ?? process.env.GITHUB_ACTOR ?? "github-actions[bot]";
  const userEmail =
    process.env.GIT_AUTHOR_EMAIL ??
    (process.env.GITHUB_ACTOR != null
      ? `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
      : "github-actions[bot]@users.noreply.github.com");

  run("git", ["config", "user.name", userName]);
  run("git", ["config", "user.email", userEmail]);
}

export function gitRefName() {
  return (
    process.env.GITHUB_REF_NAME ??
    run("git", ["branch", "--show-current"], { capture: true }).stdout.trim()
  );
}

export function gitTagExists(tag) {
  return run("git", ["tag", "--list", tag], { capture: true }).stdout.trim() === tag;
}

export function gitHasTrackedChanges(paths) {
  const output = run("git", ["status", "--short", "--", ...paths], { capture: true }).stdout.trim();
  return output.length > 0;
}
