import type { Dispatch, SetStateAction } from "react";
import type { AppPane } from "../../types.ts";
import { clampIndex } from "../../view-model.ts";

interface FocusableFile {
  path: string;
}

export type FileFocusFallback = "first-file" | "keep-current";

export type FileFocusTarget = { index: number } | { path: string };

export interface FileFocusRequest {
  activatePane?: AppPane | "preserve";
  fallback?: FileFocusFallback;
  files?: readonly FocusableFile[];
  relativeOffset?: number;
  reveal?: boolean;
  target: FileFocusTarget;
}

export interface FileFocusResult {
  index: number;
  path?: string;
}

interface CreateFileFocusControllerOptions {
  getCurrentFiles: () => readonly FocusableFile[];
  getCurrentIndex: () => number;
  revealFile: (path: string, offset?: number) => void;
  setActivePane: Dispatch<SetStateAction<AppPane>>;
  setSelectedFileIndex: Dispatch<SetStateAction<number>>;
}

export interface FileFocusController {
  focusFile: (request: FileFocusRequest) => FileFocusResult | null;
  resolveFileIndex: (
    target: FileFocusTarget,
    options?: { fallback?: FileFocusFallback; files?: readonly FocusableFile[] },
  ) => number;
}

export function createFileFocusController({
  getCurrentFiles,
  getCurrentIndex,
  revealFile,
  setActivePane,
  setSelectedFileIndex,
}: CreateFileFocusControllerOptions): FileFocusController {
  function resolveFileIndex(
    target: FileFocusTarget,
    options: { fallback?: FileFocusFallback; files?: readonly FocusableFile[] } = {},
  ): number {
    return resolveFileFocusIndex({
      currentIndex: getCurrentIndex(),
      fallback: options.fallback,
      files: options.files ?? getCurrentFiles(),
      target,
    });
  }

  function focusFile(request: FileFocusRequest): FileFocusResult | null {
    const files = request.files ?? getCurrentFiles();
    const nextIndex = resolveFileFocusIndex({
      currentIndex: getCurrentIndex(),
      fallback: request.fallback,
      files,
      target: request.target,
    });
    const nextPath = files[nextIndex]?.path;

    if (request.activatePane != null && request.activatePane !== "preserve") {
      setActivePane(request.activatePane);
    }

    if (nextPath != null && request.reveal !== false) revealFile(nextPath, request.relativeOffset);
    setSelectedFileIndex(nextIndex);
    return files.length === 0 ? null : { index: nextIndex, path: nextPath };
  }

  return { focusFile, resolveFileIndex };
}

function resolveFileFocusIndex({
  currentIndex,
  fallback = "first-file",
  files,
  target,
}: {
  currentIndex: number;
  fallback?: FileFocusFallback;
  files: readonly FocusableFile[];
  target: FileFocusTarget;
}): number {
  if (files.length === 0) {
    return 0;
  }

  if ("index" in target) {
    return clampIndex(target.index, files.length);
  }

  const resolvedIndex = files.findIndex((file) => file.path === target.path);
  if (resolvedIndex >= 0) {
    return resolvedIndex;
  }

  return fallback === "keep-current" ? clampIndex(currentIndex, files.length) : 0;
}
