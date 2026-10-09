import type { PreparedReviewSession } from "../../types.ts";

export function getMonotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function getRenderFingerprintKey(
  fingerprint: PreparedReviewSession["renderFingerprint"],
): string {
  return [
    fingerprint.baseRef,
    fingerprint.headRef,
    fingerprint.comparisonMode,
    fingerprint.baseSha ?? "",
    fingerprint.headSha ?? "",
    String(fingerprint.fileCount),
    fingerprint.patchDigest,
  ].join(":");
}
