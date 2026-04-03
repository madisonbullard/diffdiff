import { createHash } from "node:crypto";
import type { ChangedFile } from "./types/session.ts";

export interface ReviewedFileState {
  fingerprint: string;
  path: string;
}

export function buildReviewedFileFingerprint(file: ChangedFile): string {
  return createHash("sha256")
    .update(file.path)
    .update("\0")
    .update(file.previousPath ?? "")
    .update("\0")
    .update(file.status)
    .update("\0")
    .update(file.patch)
    .digest("hex");
}
