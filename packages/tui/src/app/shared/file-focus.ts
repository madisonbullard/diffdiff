import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AppPane } from "../../types.ts";
import { clampIndex } from "../../view-model.ts";
import { ALIGN_SELECTED_FILE_SCROLL_OFFSET } from "./constants.ts";

interface FocusableFile {
  path: string;
}

export type FileFocusRevealMode =
  | "default"
  | "align-under-sticky-header"
  | "preserve-relative-offset"
  | "none";

export type FileFocusFallback = "first-file" | "keep-current";

export type FileFocusTarget = { index: number } | { path: string };

export interface FileFocusRequest {
  activatePane?: AppPane | "preserve";
  fallback?: FileFocusFallback;
  files?: readonly FocusableFile[];
  relativeOffset?: number;
  reveal?: FileFocusRevealMode;
  target: FileFocusTarget;
}

export interface PendingFileFocusRequest {
  index: number;
  mode: FileFocusRevealMode;
  relativeOffset?: number;
}

export interface FileFocusResult {
  index: number;
  path?: string;
}

interface CreateFileFocusControllerOptions {
  getCurrentFiles: () => readonly FocusableFile[];
  getCurrentIndex: () => number;
  pendingFileFocusRequestRef: MutableRefObject<PendingFileFocusRequest | null>;
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
  pendingFileFocusRequestRef,
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

    pendingFileFocusRequestRef.current =
      request.reveal == null
        ? null
        : {
            index: nextIndex,
            mode: request.reveal,
            relativeOffset: request.relativeOffset,
          };

    setSelectedFileIndex(nextIndex);
    return files.length === 0 ? null : { index: nextIndex, path: nextPath };
  }

  return { focusFile, resolveFileIndex };
}

export function resolveFileFocusIndex({
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

export function getFileFocusScrollOffset(request: PendingFileFocusRequest | null): number | null {
  if (request == null) {
    return null;
  }

  switch (request.mode) {
    case "default":
      return 0;
    case "align-under-sticky-header":
      return ALIGN_SELECTED_FILE_SCROLL_OFFSET;
    case "preserve-relative-offset":
      return request.relativeOffset ?? 0;
    case "none":
      return null;
  }
}
