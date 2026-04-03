export interface StartupInstrumentation {
  appRenderRequestedAt?: number;
  importsReadyAt?: number;
  launchStartedAt: number;
  preferencesLoadedAt?: number;
  rendererReadyAt?: number;
  reviewCacheLoadedAt?: number;
  sessionPreparedAt?: number;
  startupScreenRenderedAt?: number;
  themeReadyAt?: number;
}

export type StartupInstrumentationPhase = Exclude<keyof StartupInstrumentation, "launchStartedAt">;

export function createStartupInstrumentation(
  launchStartedAt = getStartupTraceNow(),
): StartupInstrumentation {
  return { launchStartedAt };
}

export function getStartupTraceNow(): number {
  const now = globalThis.performance?.now?.();
  return typeof now === "number" ? now : Date.now();
}

export function markStartupInstrumentationPhase(
  instrumentation: StartupInstrumentation,
  phase: StartupInstrumentationPhase,
  at = getStartupTraceNow(),
): StartupInstrumentation {
  return {
    ...instrumentation,
    [phase]: at,
  };
}

export function summarizeStartupInstrumentation(
  instrumentation: StartupInstrumentation,
  completedAt = getStartupTraceNow(),
): {
  appMountDurationMs?: number;
  appRenderRequestDelayMs?: number;
  completedAt: number;
  importsDurationMs?: number;
  phaseElapsedMs: Record<string, number>;
  preferencesDurationMs?: number;
  rendererDurationMs?: number;
  reviewCacheDurationMs?: number;
  sessionPreparationDurationMs?: number;
  startupScreenDurationMs?: number;
  terminalThemeDurationMs?: number;
  totalDurationMs: number;
} {
  return {
    appMountDurationMs: durationBetween(instrumentation.appRenderRequestedAt, completedAt),
    appRenderRequestDelayMs: durationBetween(
      instrumentation.reviewCacheLoadedAt,
      instrumentation.appRenderRequestedAt,
    ),
    completedAt,
    importsDurationMs: durationBetween(
      instrumentation.launchStartedAt,
      instrumentation.importsReadyAt,
    ),
    phaseElapsedMs: collectPhaseElapsedMs(instrumentation),
    preferencesDurationMs: durationBetween(
      instrumentation.sessionPreparedAt,
      instrumentation.preferencesLoadedAt,
    ),
    rendererDurationMs: durationBetween(
      instrumentation.importsReadyAt,
      instrumentation.rendererReadyAt,
    ),
    reviewCacheDurationMs: durationBetween(
      instrumentation.preferencesLoadedAt,
      instrumentation.reviewCacheLoadedAt,
    ),
    sessionPreparationDurationMs: durationBetween(
      instrumentation.startupScreenRenderedAt,
      instrumentation.sessionPreparedAt,
    ),
    startupScreenDurationMs: durationBetween(
      instrumentation.themeReadyAt,
      instrumentation.startupScreenRenderedAt,
    ),
    terminalThemeDurationMs: durationBetween(
      instrumentation.rendererReadyAt,
      instrumentation.themeReadyAt,
    ),
    totalDurationMs: roundDuration(completedAt - instrumentation.launchStartedAt),
  };
}

function collectPhaseElapsedMs(instrumentation: StartupInstrumentation): Record<string, number> {
  const phaseElapsedMs: Record<string, number> = {
    launchStartedAt: 0,
  };

  for (const phase of [
    "importsReadyAt",
    "rendererReadyAt",
    "themeReadyAt",
    "startupScreenRenderedAt",
    "sessionPreparedAt",
    "preferencesLoadedAt",
    "reviewCacheLoadedAt",
    "appRenderRequestedAt",
  ] as const satisfies readonly StartupInstrumentationPhase[]) {
    const at = instrumentation[phase];
    if (at == null) {
      continue;
    }

    phaseElapsedMs[phase] = roundDuration(at - instrumentation.launchStartedAt);
  }

  return phaseElapsedMs;
}

function durationBetween(startAt?: number, endAt?: number): number | undefined {
  if (startAt == null || endAt == null) {
    return undefined;
  }

  return roundDuration(endAt - startAt);
}

function roundDuration(durationMs: number): number {
  return Math.round(durationMs * 10) / 10;
}
