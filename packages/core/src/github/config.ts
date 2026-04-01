import { homedir } from "node:os";
import { join } from "node:path";

export interface GitHubAuthConfigPaths {
  primaryDirectoryPath: string;
  primaryFilePath: string;
  legacyDirectoryPath: string;
  legacyFilePath: string;
}

export function getGitHubAuthConfigPaths(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homePath: string = homedir(),
): GitHubAuthConfigPaths {
  const primaryDirectoryPath = getPrimaryConfigDirectory(env, platform, homePath);
  const legacyDirectoryPath = join(homePath, ".diffdiff");

  return {
    primaryDirectoryPath,
    primaryFilePath: join(primaryDirectoryPath, "github-auth.json"),
    legacyDirectoryPath,
    legacyFilePath: join(legacyDirectoryPath, "github-auth.json"),
  };
}

function getPrimaryConfigDirectory(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  homePath: string,
): string {
  if (platform === "darwin") {
    return join(homePath, "Library", "Application Support", "diffdiff");
  }

  if (platform === "win32") {
    return join(env.APPDATA ?? join(homePath, "AppData", "Roaming"), "diffdiff");
  }

  return join(env.XDG_CONFIG_HOME ?? join(homePath, ".config"), "diffdiff");
}
