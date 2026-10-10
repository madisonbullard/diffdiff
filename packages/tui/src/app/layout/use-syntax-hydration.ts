import { logDiffdiffWarn } from "@madisonbullard/diffdiff-core";
import { useEffect, useRef } from "react";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import type { UiTheme } from "../../theme.ts";
import { createSyntaxHydrator } from "../../diff/syntax-hydrator.ts";
import { getRenderFingerprintKey } from "./preview-helpers.ts";

export function useSyntaxHydration(state: DiffdiffAppState, theme: UiTheme, sessionKey: string) {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const hydrator = createSyntaxHydrator();
    const attempted = new WeakSet<object>();
    let cancelled = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (cancelled || busy || timer != null) return;
      timer = setTimeout(() => void next(), 40);
    };
    const next = async () => {
      timer = undefined;
      const current = latest.current;
      const [first, last] = current.diffScroll.visibleRange();
      const file = current.session.files
        .slice(Math.max(0, first), last + 1)
        .find(
          (candidate) =>
            !current.collapsedPaths.has(candidate.path) &&
            !attempted.has(candidate) &&
            candidate.diff != null &&
            !candidate.isBinary &&
            candidate.renderError == null &&
            (candidate.unifiedLines.length === 0 || candidate.sideBySideRows.length === 0),
        );
      if (file == null) return;
      busy = true;
      attempted.add(file);
      try {
        const result = await hydrator.hydrate({
          file,
          theme,
          themeName: current.session.themeName,
        });
        if (cancelled) return;
        if ("error" in result) throw new Error(result.error);
        current.setSession((session) => {
          if (
            getRenderFingerprintKey(session.renderFingerprint) !== sessionKey ||
            !session.files.includes(file)
          )
            return session;
          return {
            ...session,
            files: session.files.map((existing) => (existing === file ? result.file : existing)),
          };
        });
      } catch (error) {
        if (!cancelled)
          logDiffdiffWarn("render", "deferred_syntax_hydration_failed", { path: file.path, error });
      } finally {
        busy = false;
        schedule();
      }
    };
    const unsubscribe = state.diffScroll.subscribeViewport(schedule);
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
      hydrator.dispose();
    };
  }, [state.diffScroll, theme, sessionKey, state.session.themeName]);
}
