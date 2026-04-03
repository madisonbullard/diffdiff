import { getSecureStoreServiceName } from "./shared.ts";
import type { SecureStoreCommandRunner } from "./shared.ts";

export async function loadTokenFromWindowsCredentialManager(
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<string | undefined> {
  try {
    const { stdout } = await secureStoreCommandRunner(
      "powershell.exe",
      createWindowsPowerShellArgs(
        [
          "[void][Windows.Security.Credentials.PasswordVault, Windows.Security.Credentials, ContentType = WindowsRuntime]",
          "$vault = New-Object Windows.Security.Credentials.PasswordVault",
          "try {",
          "  $credential = $vault.Retrieve($env:DIFFDIFF_SECURE_STORE_SERVICE, $env:DIFFDIFF_SECURE_STORE_ACCOUNT)",
          "  $credential.RetrievePassword()",
          "  [Console]::Out.Write($credential.Password)",
          "} catch {",
          "  exit 1",
          "}",
        ].join("\n"),
      ),
      {
        env: {
          DIFFDIFF_SECURE_STORE_ACCOUNT: host,
          DIFFDIFF_SECURE_STORE_SERVICE: getSecureStoreServiceName(host),
        },
      },
    );
    const token = stdout.trim();
    return token === "" ? undefined : token;
  } catch {
    return undefined;
  }
}

export async function storeTokenInWindowsCredentialManager(
  token: string,
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<boolean> {
  try {
    await secureStoreCommandRunner(
      "powershell.exe",
      createWindowsPowerShellArgs(
        [
          "[void][Windows.Security.Credentials.PasswordVault, Windows.Security.Credentials, ContentType = WindowsRuntime]",
          "$vault = New-Object Windows.Security.Credentials.PasswordVault",
          "try {",
          "  $vault.Remove($vault.Retrieve($env:DIFFDIFF_SECURE_STORE_SERVICE, $env:DIFFDIFF_SECURE_STORE_ACCOUNT))",
          "} catch {}",
          "$vault.Add((New-Object Windows.Security.Credentials.PasswordCredential($env:DIFFDIFF_SECURE_STORE_SERVICE, $env:DIFFDIFF_SECURE_STORE_ACCOUNT, $env:DIFFDIFF_SECURE_STORE_TOKEN)))",
        ].join("\n"),
      ),
      {
        env: {
          DIFFDIFF_SECURE_STORE_ACCOUNT: host,
          DIFFDIFF_SECURE_STORE_SERVICE: getSecureStoreServiceName(host),
          DIFFDIFF_SECURE_STORE_TOKEN: token,
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteTokenFromWindowsCredentialManager(
  host: string,
  secureStoreCommandRunner: SecureStoreCommandRunner,
): Promise<void> {
  try {
    await secureStoreCommandRunner(
      "powershell.exe",
      createWindowsPowerShellArgs(
        [
          "[void][Windows.Security.Credentials.PasswordVault, Windows.Security.Credentials, ContentType = WindowsRuntime]",
          "$vault = New-Object Windows.Security.Credentials.PasswordVault",
          "try {",
          "  $vault.Remove($vault.Retrieve($env:DIFFDIFF_SECURE_STORE_SERVICE, $env:DIFFDIFF_SECURE_STORE_ACCOUNT))",
          "} catch {",
          "  exit 0",
          "}",
        ].join("\n"),
      ),
      {
        env: {
          DIFFDIFF_SECURE_STORE_ACCOUNT: host,
          DIFFDIFF_SECURE_STORE_SERVICE: getSecureStoreServiceName(host),
        },
      },
    );
  } catch {
    return;
  }
}

function createWindowsPowerShellArgs(script: string): string[] {
  return ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script];
}
