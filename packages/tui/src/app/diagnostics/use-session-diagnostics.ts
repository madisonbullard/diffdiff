import { logDiffdiffError } from "@madisonbullard/diffdiff-core";
import { useCallback, useRef, useState } from "react";
import { closeDialog as closeAppDialog, openDialog as openAppDialog } from "../dialogs/stack.ts";
import type { DiffdiffAppProps } from "../state/app-props.ts";
import type { DiffdiffAppState } from "../state/use-app-state.ts";
import { clampIndex } from "../../view-model.ts";
import { loadSessionDiagnosticEvents, type SessionDiagnosticEvent } from "./session-events.ts";

export function useSessionDiagnostics({
  loadSessionDiagnostics,
  logFilePath,
  state,
}: {
  loadSessionDiagnostics: DiffdiffAppProps["loadSessionDiagnostics"];
  logFilePath: string;
  state: Pick<DiffdiffAppState, "setDialogStack" | "setStatusMessage">;
}) {
  const [diagnosticEvents, setDiagnosticEvents] = useState<SessionDiagnosticEvent[]>([]);
  const [diagnosticEventIndex, setDiagnosticEventIndex] = useState(0);
  const [diagnosticErrorMessage, setDiagnosticErrorMessage] = useState<string | null>(null);
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const diagnosticLoadIdRef = useRef(0);

  const loadDiagnostics = useCallback(async () => {
    const loadId = diagnosticLoadIdRef.current + 1;
    diagnosticLoadIdRef.current = loadId;
    setIsDiagnosticsLoading(true);
    setDiagnosticEvents([]);
    setDiagnosticErrorMessage(null);

    try {
      const loader = loadSessionDiagnostics ?? loadSessionDiagnosticEvents;
      const nextEvents = await loader(logFilePath);
      if (diagnosticLoadIdRef.current !== loadId) {
        return;
      }

      const orderedEvents = [...nextEvents].reverse();
      setDiagnosticEvents(orderedEvents);
      setDiagnosticEventIndex((currentIndex) => clampIndex(currentIndex, orderedEvents.length));
    } catch (error) {
      if (diagnosticLoadIdRef.current !== loadId) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unable to load the current session event log.";
      setDiagnosticEvents([]);
      setDiagnosticErrorMessage(message);
      logDiffdiffError("app", "session_diagnostics_load_failed", error, {
        logFilePath,
      });
    } finally {
      if (diagnosticLoadIdRef.current === loadId) {
        setIsDiagnosticsLoading(false);
      }
    }
  }, [loadSessionDiagnostics, logFilePath]);

  const openDiagnostics = useCallback((): void => {
    setDiagnosticEventIndex(0);
    state.setDialogStack((currentStack) =>
      openAppDialog(currentStack, "diagnostics", { clear: true }),
    );
    state.setStatusMessage("Opened diagnostics.");
    void loadDiagnostics();
  }, [loadDiagnostics, state]);

  const closeDiagnostics = useCallback((): void => {
    state.setDialogStack((currentStack) => closeAppDialog(currentStack, "diagnostics", "dismiss"));
    state.setStatusMessage("Closed diagnostics.");
  }, [state]);

  const moveDiagnosticSelection = useCallback(
    (delta: number): void => {
      setDiagnosticEventIndex((currentIndex) =>
        clampIndex(currentIndex + delta, diagnosticEvents.length),
      );
    },
    [diagnosticEvents.length],
  );

  const jumpToFirstDiagnostic = useCallback((): void => {
    setDiagnosticEventIndex(0);
  }, []);

  const jumpToLastDiagnostic = useCallback((): void => {
    setDiagnosticEventIndex(Math.max(diagnosticEvents.length - 1, 0));
  }, [diagnosticEvents.length]);

  return {
    closeDiagnostics,
    diagnosticErrorMessage,
    diagnosticEventIndex,
    diagnosticEvents,
    isDiagnosticsLoading,
    jumpToFirstDiagnostic,
    jumpToLastDiagnostic,
    moveDiagnosticSelection,
    openDiagnostics,
  };
}
