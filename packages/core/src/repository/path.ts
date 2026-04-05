import { resolve } from "node:path";

export function getRepositorySearchPath(startPath?: string): string {
  if (startPath == null || startPath.trim() === "") {
    return process.cwd();
  }

  return resolve(process.cwd(), startPath);
}
