import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createEmptyProgress,
  isTonicId,
  recordAttempt as applyAttempt,
  safeLoadProgress,
  safeSaveProgress,
  type ExerciseType,
  type ProgressState,
} from "@notescale/music";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createSerializedSaver,
  loadProgressWithRetry,
  persistenceWarningAfterSave,
  resolveHydration,
  STORAGE_OPERATION_TIMEOUT_MS,
  type PendingAttempt,
} from "./progress-state";

interface ProgressContextValue {
  progress: ProgressState;
  hydrated: boolean;
  warning?: string;
  recordAttempt: (scaleId: string | undefined, correct: boolean, exerciseType: ExerciseType) => void;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);
const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};

export function ProgressProvider({ children }: PropsWithChildren) {
  const [progress, setProgress] = useState<ProgressState>(() => createEmptyProgress());
  const [hydrated, setHydrated] = useState(false);
  const [warning, setWarning] = useState<string>();
  const progressRef = useRef(progress);
  const hydratedRef = useRef(false);
  const canSaveRef = useRef(false);
  const pendingRef = useRef<PendingAttempt[]>([]);
  const mountedRef = useRef(true);
  const save = useRef(createSerializedSaver(
    (snapshot: ProgressState) => safeSaveProgress(storage, snapshot),
    STORAGE_OPERATION_TIMEOUT_MS,
  )).current;

  const persist = useCallback((snapshot: ProgressState) => {
    if (!canSaveRef.current) return;
    void save(snapshot).then((saveWarning) => {
      if (mountedRef.current) setWarning(persistenceWarningAfterSave(saveWarning));
    }).catch(() => {
      if (mountedRef.current) setWarning("La progression ne peut pas être enregistrée sur cet appareil.");
    });
  }, [save]);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    loadProgressWithRetry(() => safeLoadProgress(storage)).then((result) => {
      if (!active) return;
      const pending = pendingRef.current;
      pendingRef.current = [];
      const hydration = resolveHydration(result, pending);
      progressRef.current = hydration.progress;
      canSaveRef.current = result.canSave;
      hydratedRef.current = true;
      setProgress(hydration.progress);
      setWarning(result.warning ?? undefined);
      setHydrated(true);
      if (hydration.shouldSave) persist(hydration.progress);
    });
    return () => { active = false; mountedRef.current = false; };
  }, [persist]);

  const recordAttempt = useCallback((scaleId: string | undefined, correct: boolean, exerciseType: ExerciseType) => {
    const pending: PendingAttempt = { input: {
      exerciseType,
      ...(scaleId && isTonicId(scaleId) ? { scaleId } : {}),
      correct,
    }, at: new Date() };
    if (!hydratedRef.current) {
      pendingRef.current.push(pending);
      return;
    }
    const next = applyAttempt(progressRef.current, pending.input, pending.at);
    progressRef.current = next;
    setProgress(next);
    persist(next);
  }, [persist]);

  const value = useMemo<ProgressContextValue>(() => ({ progress, hydrated, ...(warning ? { warning } : {}), recordAttempt }), [hydrated, progress, recordAttempt, warning]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("useProgress must be used inside ProgressProvider");
  return context;
}
