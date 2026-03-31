import { copyTextToClipboard } from "./clipboard.ts";

export interface SelectionClipboardRenderer {
  getSelection(): { getSelectedText(): string } | null;
  clearSelection(): void;
}

export interface SelectionCopyOptions {
  copyText?: (text: string) => Promise<boolean>;
  onSuccess?: () => void;
  onError?: () => void;
}

export function copySelection(
  renderer: SelectionClipboardRenderer,
  options: SelectionCopyOptions = {},
): boolean {
  const selectedText = renderer.getSelection()?.getSelectedText();

  if (!selectedText) {
    return false;
  }

  const copyText = options.copyText ?? copyTextToClipboard;

  void copyText(selectedText)
    .then((copied) => {
      if (copied) {
        options.onSuccess?.();
      } else {
        options.onError?.();
      }
    })
    .catch(() => {
      options.onError?.();
    });

  renderer.clearSelection();
  return true;
}
