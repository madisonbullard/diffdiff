import type { Dispatch, MutableRefObject, SetStateAction } from "react";

export function selectFileIndexWithPendingScrollOffset(
  setSelectedFileIndex: Dispatch<SetStateAction<number>>,
  pendingSelectedFileScrollOffsetRef: MutableRefObject<number | null>,
  index: number,
  scrollOffset: number,
): void {
  pendingSelectedFileScrollOffsetRef.current = scrollOffset;
  setSelectedFileIndex(index);
}
