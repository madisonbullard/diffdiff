import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { GitHubAuthSession } from "../types/github.ts";
import { getGitHubAuthConfigPaths } from "./config.ts";
import {
  deleteTokenFromMacOSKeychain,
  loadTokenFromMacOSKeychain,
  storeTokenInMacOSKeychain,
} from "./secure-store/darwin.ts";
import {
  deleteTokenFromLinuxSecretService,
  loadTokenFromLinuxSecretService,
  storeTokenInLinuxSecretService,
} from "./secure-store/linux.ts";
import { runSecureStoreCommand, type SecureStoreCommandRunner } from "./secure-store/shared.ts";
import {
  deleteTokenFromWindowsCredentialManager,
  loadTokenFromWindowsCredentialManager,
  storeTokenInWindowsCredentialManager,
} from "./secure-store/win32.ts";

const DEFAULT_GITHUB_HOST = "github.com";

interface GitHubAuthFile {
  version: 1;
  host: string;
  token: string;
  updatedAt: string;
}

interface GitHubAuthOptions {
  secureStoreCommandRunner?: SecureStoreCommandRunner;
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
  const secureStoreCommandRunner = options.secureStoreCommandRunner ?? runSecureStoreCommand;
  const paths = getGitHubAuthConfigPaths(env, platform, options.homePath);
  const envToken = readTokenFromEnv(env);

  if (envToken != null) {
    return {
      host,
      token: envToken,
      tokenSource: "env",
    };
  }

  const secureStoreToken = await loadTokenFromSecureStore(host, platform, secureStoreCommandRunner);
  if (secureStoreToken != null) {
    return {
      host,
      token: secureStoreToken,
      tokenSource: "secure-store",
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
  const secureStoreCommandRunner = options.secureStoreCommandRunner ?? runSecureStoreCommand;
  const paths = getGitHubAuthConfigPaths(env, platform, options.homePath);

  if (await storeTokenInSecureStore(token, host, platform, secureStoreCommandRunner)) {
    await Promise.all([
      deleteConfigFile(paths.primaryFilePath).catch(() => undefined),
      deleteConfigFile(paths.legacyFilePath).catch(() => undefined),
    ]);

    return {
      host,
      token,
      tokenSource: "secure-store",
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
  const secureStoreCommandRunner = options.secureStoreCommandRunner ?? runSecureStoreCommand;
  const paths = getGitHubAuthConfigPaths(env, platform, options.homePath);

  await deleteTokenFromSecureStore(host, platform, secureStoreCommandRunner);
  await Promise.all([
    deleteConfigFile(paths.primaryFilePath).catch(() => undefined),
    deleteConfigFile(paths.legacyFilePath).catch(() => undefined),
  ]);
}

function readTokenFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const token = env.DIFFDIFF_GITHUB_TOKEN ?? env.GITHUB_TOKEN ?? env.GH_TOKEN;
  return token?.trim() === "" ? undefined : token?.trim();
}

async function loadTokenFromSecureStore(
  host: string,
  platform: NodeJS.Platform,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<string | undefined> {
  switch (platform) {
    case "darwin":
      return loadTokenFromMacOSKeychain(host, secureStoreCommandRunner);
    case "linux":
      return loadTokenFromLinuxSecretService(host, secureStoreCommandRunner);
    case "win32":
      return loadTokenFromWindowsCredentialManager(host, secureStoreCommandRunner);
    default:
      return undefined;
  }
}

async function storeTokenInSecureStore(
  token: string,
  host: string,
  platform: NodeJS.Platform,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<boolean> {
  switch (platform) {
    case "darwin":
      return storeTokenInMacOSKeychain(token, host, secureStoreCommandRunner);
    case "linux":
      return storeTokenInLinuxSecretService(token, host, secureStoreCommandRunner);
    case "win32":
      return storeTokenInWindowsCredentialManager(token, host, secureStoreCommandRunner);
    default:
      return false;
  }
}

async function deleteTokenFromSecureStore(
  host: string,
  platform: NodeJS.Platform,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<void> {
  switch (platform) {
    case "darwin":
      await deleteTokenFromMacOSKeychain(host, secureStoreCommandRunner);
      return;
    case "linux":
      await deleteTokenFromLinuxSecretService(host, secureStoreCommandRunner);
      return;
    case "win32":
      await deleteTokenFromWindowsCredentialManager(host, secureStoreCommandRunner);
      return;
    default:
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
