import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { GitHubAuthSession } from "../types/github.ts";
import { getGitHubAuthConfigPaths } from "./config.ts";

const execFileAsync = promisify(execFile);
const DEFAULT_GITHUB_HOST = "github.com";
const KEYCHAIN_SERVICE_PREFIX = "diffdiff:github-token:";

interface GitHubAuthFile {
  version: 1;
  host: string;
  token: string;
  updatedAt: string;
}

interface GitHubAuthOptions {
  host?: string;
  env?: NodeJS.ProcessEnv;
  homePath?: string;
  platform?: NodeJS.Platform;
}

export async function resolveGitHubAuth(
  options: GitHubAuthOptions = {},
): Promise<GitHubAuthSession | undefined> {
  const host = options.host ?? DEFAULT_GITHUB_HOST;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const paths = getGitHubAuthConfigPaths(env, platform, options.homePath);
  const envToken = readTokenFromEnv(env);

  if (envToken != null) {
    return {
      host,
      token: envToken,
      tokenSource: "env",
    };
  }

  const keychainToken = await loadTokenFromKeychain(host, platform);
  if (keychainToken != null) {
    return {
      host,
      token: keychainToken,
      tokenSource: "keychain",
    };
  }

  const primaryConfigRecord = await readConfigFile(paths.primaryFilePath);
  const legacyConfigRecord =
    primaryConfigRecord == null ? await readConfigFile(paths.legacyFilePath) : undefined;
  const configRecord = primaryConfigRecord ?? legacyConfigRecord;

  if (configRecord == null || configRecord.host !== host) {
    return undefined;
  }

  return {
    host,
    token: configRecord.token,
    tokenSource: "config",
    configFilePath: primaryConfigRecord != null ? paths.primaryFilePath : paths.legacyFilePath,
  };
}

export async function storeGitHubToken(
  token: string,
  options: GitHubAuthOptions = {},
): Promise<GitHubAuthSession> {
  const host = options.host ?? DEFAULT_GITHUB_HOST;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const paths = getGitHubAuthConfigPaths(env, platform, options.homePath);

  if (await storeTokenInKeychain(token, host, platform)) {
    await Promise.all([
      deleteConfigFile(paths.primaryFilePath).catch(() => undefined),
      deleteConfigFile(paths.legacyFilePath).catch(() => undefined),
    ]);

    return {
      host,
      token,
      tokenSource: "keychain",
    };
  }

  const record: GitHubAuthFile = {
    version: 1,
    host,
    token,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(paths.primaryDirectoryPath, { recursive: true });
  await writeFile(paths.primaryFilePath, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(paths.primaryFilePath, 0o600).catch(() => undefined);

  return {
    host,
    token,
    tokenSource: "config",
    configFilePath: paths.primaryFilePath,
  };
}

export async function clearGitHubToken(options: GitHubAuthOptions = {}): Promise<void> {
  const host = options.host ?? DEFAULT_GITHUB_HOST;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const paths = getGitHubAuthConfigPaths(env, platform, options.homePath);

  await deleteTokenFromKeychain(host, platform);
  await Promise.all([
    deleteConfigFile(paths.primaryFilePath).catch(() => undefined),
    deleteConfigFile(paths.legacyFilePath).catch(() => undefined),
  ]);
}

function readTokenFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const token = env.DIFFDIFF_GITHUB_TOKEN ?? env.GITHUB_TOKEN ?? env.GH_TOKEN;
  return token?.trim() === "" ? undefined : token?.trim();
}

async function loadTokenFromKeychain(
  host: string,
  platform: NodeJS.Platform,
): Promise<string | undefined> {
  if (platform !== "darwin") {
    return undefined;
  }

  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-a",
      host,
      "-s",
      `${KEYCHAIN_SERVICE_PREFIX}${host}`,
      "-w",
    ]);
    const token = stdout.trim();
    return token === "" ? undefined : token;
  } catch {
    return undefined;
  }
}

async function storeTokenInKeychain(
  token: string,
  host: string,
  platform: NodeJS.Platform,
): Promise<boolean> {
  if (platform !== "darwin") {
    return false;
  }

  try {
    await execFileAsync("security", [
      "add-generic-password",
      "-U",
      "-a",
      host,
      "-s",
      `${KEYCHAIN_SERVICE_PREFIX}${host}`,
      "-w",
      token,
    ]);
    return true;
  } catch {
    return false;
  }
}

async function deleteTokenFromKeychain(host: string, platform: NodeJS.Platform): Promise<void> {
  if (platform !== "darwin") {
    return;
  }

  try {
    await execFileAsync("security", [
      "delete-generic-password",
      "-a",
      host,
      "-s",
      `${KEYCHAIN_SERVICE_PREFIX}${host}`,
    ]);
  } catch {
    return;
  }
}

async function readConfigFile(filePath: string): Promise<GitHubAuthFile | undefined> {
  try {
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents) as Partial<GitHubAuthFile>;

    if (
      parsed.version !== 1 ||
      typeof parsed.host !== "string" ||
      typeof parsed.token !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return undefined;
    }

    return {
      version: 1,
      host: parsed.host,
      token: parsed.token,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return undefined;
  }
}

async function deleteConfigFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}
