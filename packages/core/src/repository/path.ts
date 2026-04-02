import { dirname } from "node:path";

export function getRepositorySearchPath(startPath?: string): string {
  if (startPath == null || startPath.trim() === "") {
    return process.cwd();
  }

  return startPath.startsWith("/")
    ? startPath
    : dirname(new URL(`file://${process.cwd()}/${startPath}`).pathname);
}
