import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { DiffdiffAppPersistence } from "../session/use-app-persistence.ts";
import {
  createReviewInputControllers,
  type ReviewInputControllers,
} from "../review/review-input-controllers.ts";
import {
  createAppTextInputControllers,
  type AppTextInputControllers,
} from "../text-input/input-controllers.ts";

export interface AppInputControllers {
  review: ReviewInputControllers;
  text: AppTextInputControllers;
}

export function createAppInputControllers({
  getSelectedFilePath,
  persistence,
  props,
  state,
}: {
  getSelectedFilePath: () => string | undefined;
  persistence: DiffdiffAppPersistence;
  props: Pick<DiffdiffAppProps, "appendReviewComposerHistory" | "openExternalEditor">;
  state: DiffdiffAppState;
}): AppInputControllers {
  return {
    review: createReviewInputControllers({
      getSelectedFilePath,
      persistence,
      props,
      state,
    }),
    text: createAppTextInputControllers(state),
  };
}
