import type { Dispatch, SetStateAction } from "react";
import type { AppPane } from "../../types.ts";
import { clampIndex } from "../../view-model.ts";
import { PR_OVERVIEW_PATH } from "../review/pull-request-overview.ts";

interface FocusableFile {
  path: string;
}

export type FileFocusFallback = "first-file" | "keep-current";

export type FileFocusTarget = { index: number } | { path: string };

export interface FileFocusRequest {
  hasOverview?: boolean;
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
  getHasOverview?: () => boolean;
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
  getHasOverview = () => false,
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
      hasOverview: getHasOverview(),
      fallback: options.fallback,
      files: options.files ?? getCurrentFiles(),
      target,
    });
  }

  function focusFile(request: FileFocusRequest): FileFocusResult | null {
    const files = request.files ?? getCurrentFiles();
    const nextIndex = resolveFileFocusIndex({
      currentIndex: getCurrentIndex(),
      hasOverview: request.hasOverview ?? getHasOverview(),
      fallback: request.fallback,
      files,
      target: request.target,
    });
    const nextPath = nextIndex === -1 ? PR_OVERVIEW_PATH : files[nextIndex]?.path;

    if (request.activatePane != null && request.activatePane !== "preserve") {
      setActivePane(request.activatePane);
    }

    if (nextPath != null && request.reveal !== false) revealFile(nextPath, request.relativeOffset);
    setSelectedFileIndex(nextIndex);
    return nextPath == null ? null : { index: nextIndex, path: nextPath };
  }

  return { focusFile, resolveFileIndex };
}

function resolveFileFocusIndex({
  hasOverview = false,
  currentIndex,
  fallback = "first-file",
  files,
  target,
}: {
  hasOverview?: boolean;
  currentIndex: number;
  fallback?: FileFocusFallback;
  files: readonly FocusableFile[];
  target: FileFocusTarget;
}): number {
  if (
    hasOverview &&
    (("index" in target && target.index < 0) ||
      ("path" in target && target.path === PR_OVERVIEW_PATH))
  )
    return -1;
  if (files.length === 0) {
    return hasOverview ? -1 : 0;
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
