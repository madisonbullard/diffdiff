import { getSecureStoreServiceName } from "./shared.ts";
import type { SecureStoreCommandRunner } from "./shared.ts";

export async function loadTokenFromMacOSKeychain(
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<string | undefined> {
  try {
    const { stdout } = await secureStoreCommandRunner("security", [
      "find-generic-password",
      "-a",
      host,
      "-s",
      getSecureStoreServiceName(host),
      "-w",
    ]);
    const token = stdout.trim();
    return token === "" ? undefined : token;
  } catch {
    return undefined;
  }
}

export async function storeTokenInMacOSKeychain(
  token: string,
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<boolean> {
  try {
    await secureStoreCommandRunner("security", [
      "add-generic-password",
      "-U",
      "-a",
      host,
      "-s",
      getSecureStoreServiceName(host),
      "-w",
      token,
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function deleteTokenFromMacOSKeychain(
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<void> {
  try {
    await secureStoreCommandRunner("security", [
      "delete-generic-password",
      "-a",
      host,
      "-s",
      getSecureStoreServiceName(host),
    ]);
  } catch {
    return;
  }
}
