import { expect, test } from "vite-plus/test";
import {
  createStartupInstrumentation,
  markStartupInstrumentationPhase,
  summarizeStartupInstrumentation,
} from "../src/startup-tracing.ts";

test("summarizes startup instrumentation durations by phase", () => {
  let instrumentation = createStartupInstrumentation(10);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "importsReadyAt", 20);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "rendererReadyAt", 35);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "themeReadyAt", 50);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "startupScreenRenderedAt", 52);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "sessionPreparedAt", 140);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "preferencesLoadedAt", 145);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "reviewCacheLoadedAt", 149);
  instrumentation = markStartupInstrumentationPhase(instrumentation, "appRenderRequestedAt", 150);

  expect(summarizeStartupInstrumentation(instrumentation, 163)).toEqual({
    appMountDurationMs: 13,
    appRenderRequestDelayMs: 1,
    completedAt: 163,
    importsDurationMs: 10,
    phaseElapsedMs: {
      appRenderRequestedAt: 140,
      importsReadyAt: 10,
      launchStartedAt: 0,
      preferencesLoadedAt: 135,
      rendererReadyAt: 25,
      reviewCacheLoadedAt: 139,
      sessionPreparedAt: 130,
      startupScreenRenderedAt: 42,
      themeReadyAt: 40,
    },
    preferencesDurationMs: 5,
    rendererDurationMs: 15,
    reviewCacheDurationMs: 4,
    sessionPreparationDurationMs: 88,
    startupScreenDurationMs: 2,
    terminalThemeDurationMs: 15,
    totalDurationMs: 153,
  });
});
