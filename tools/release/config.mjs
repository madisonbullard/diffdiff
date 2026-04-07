import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, "../..");
export const ROOT_PACKAGE_PATH = path.join(REPO_ROOT, "package.json");
export const PACKAGES_ROOT = path.join(REPO_ROOT, "packages");
export const RELEASE_STATE_DIRECTORY = path.join(
  REPO_ROOT,
  "node_modules",
  ".cache",
  "diffdiff-release",
);
export const MANIFEST_SNAPSHOT_PATH = path.join(RELEASE_STATE_DIRECTORY, "manifest-snapshot.json");
export const RELEASE_MANIFEST_FILENAME = "release-manifest.json";
export const DEFAULT_RELEASE_DIRECTORY = path.join(REPO_ROOT, ".release-artifacts");
export const CLI_PACKAGE_NAME = "@madisonbullard/diffdiff-tui";

export const PUBLISHABLE_PACKAGES = [
  {
    name: "@madisonbullard/diffdiff-core",
    directory: path.join(PACKAGES_ROOT, "core"),
    manifestPath: path.join(PACKAGES_ROOT, "core", "package.json"),
    publishAccess: "public",
  },
  {
    name: "@madisonbullard/diffdiff-tui",
    directory: path.join(PACKAGES_ROOT, "tui"),
    manifestPath: path.join(PACKAGES_ROOT, "tui", "package.json"),
    publishAccess: "public",
  },
];

export const VERSIONED_MANIFEST_PATHS = [
  ROOT_PACKAGE_PATH,
  ...PUBLISHABLE_PACKAGES.map((pkg) => pkg.manifestPath),
];

export const INTERNAL_WORKSPACE_PACKAGES = new Set(PUBLISHABLE_PACKAGES.map((pkg) => pkg.name));
