import type { UiTheme } from "../../theme.ts";
import { LOADING_INDICATOR_FRAMES } from "../shared/constants.ts";

export interface FooterEventPresentation {
  color: string;
  message: string;
}

export function getFooterEventPresentation({
  activePrefix,
  baseBranchLoadingMessage,
  isReloading,
  loadingIndicatorFrame,
  statusMessage,
  theme,
  toastMessage,
}: {
  activePrefix: string | null;
  baseBranchLoadingMessage: string | null;
  isReloading: boolean;
  loadingIndicatorFrame: number;
  statusMessage: string;
  theme: UiTheme;
  toastMessage: string | null;
}): FooterEventPresentation {
  return {
    color:
      toastMessage != null
        ? theme.success
        : baseBranchLoadingMessage != null || isReloading || activePrefix != null
          ? theme.accent
          : theme.textMuted,
    message:
      toastMessage != null
        ? `✓ ${toastMessage}`
        : baseBranchLoadingMessage != null
          ? `${LOADING_INDICATOR_FRAMES[loadingIndicatorFrame]} ${baseBranchLoadingMessage}`
          : statusMessage,
  };
}
