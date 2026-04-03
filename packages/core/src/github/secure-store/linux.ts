import { getSecureStoreServiceName } from "./shared.ts";
import type { SecureStoreCommandRunner } from "./shared.ts";

export async function loadTokenFromLinuxSecretService(
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<string | undefined> {
  try {
    const { stdout } = await secureStoreCommandRunner("secret-tool", [
      "lookup",
      ...getLinuxSecretToolAttributes(host),
    ]);
    const token = stdout.trim();
    return token === "" ? undefined : token;
  } catch {
    return undefined;
  }
}

export async function storeTokenInLinuxSecretService(
  token: string,
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<boolean> {
  try {
    await secureStoreCommandRunner(
      "secret-tool",
      [
        "store",
        "--label",
        `diffdiff GitHub token for ${host}`,
        ...getLinuxSecretToolAttributes(host),
      ],
      { input: token },
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteTokenFromLinuxSecretService(
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<void> {
  try {
    await secureStoreCommandRunner("secret-tool", ["clear", ...getLinuxSecretToolAttributes(host)]);
  } catch {
    return;
  }
}

function getLinuxSecretToolAttributes(host: string): string[] {
  return ["service", getSecureStoreServiceName(host), "account", host];
}
