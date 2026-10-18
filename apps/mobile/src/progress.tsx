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
  withTimeout,
  type PendingAttempt,
} from "./progress-state";
import { lessons } from "./domain";

interface ProgressContextValue {
  progress: ProgressState;
  hydrated: boolean;
  warning?: string;
  recordAttempt: (scaleId: string | undefined, correct: boolean, exerciseType: ExerciseType) => void;
  lastLessonId?: string;
  lessonHydrated: boolean;
  lessonWarning?: string;
  rememberLesson: (id: string) => void;
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
  const [lastLessonId, setLastLessonId] = useState<string>();
  const [lessonHydrated, setLessonHydrated] = useState(false);
  const [lessonWarning, setLessonWarning] = useState<string>();
  const lessonRevision = useRef(0);
  const progressRef = useRef(progress);
  const hydratedRef = useRef(false);
  const canSaveRef = useRef(false);
  const pendingRef = useRef<PendingAttempt[]>([]);
  const mountedRef = useRef(true);
  const save = useRef(createSerializedSaver(
    (snapshot: ProgressState) => safeSaveProgress(storage, snapshot),
    STORAGE_OPERATION_TIMEOUT_MS,
  )).current;
  // ponytail: a bookmark, not lesson completion; exercise progress stays untouched.
  const saveLesson = useRef(createSerializedSaver(
    (id: string) => AsyncStorage.setItem("notescale.lesson.v1", id),
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

  useEffect(() => {
    let active = true;
    const revision = lessonRevision.current;
    void withTimeout(AsyncStorage.getItem("notescale.lesson.v1"), STORAGE_OPERATION_TIMEOUT_MS).then((id) => {
      if (active && revision === lessonRevision.current && id && lessons.some((lesson) => lesson.id === id)) setLastLessonId(id);
    }).catch(() => {
      if (active && revision === lessonRevision.current) setLessonWarning("La dernière leçon n’a pas pu être retrouvée. Tu peux toujours choisir une leçon.");
    }).finally(() => { if (active) setLessonHydrated(true); });
    return () => { active = false; };
  }, []);

  const rememberLesson = useCallback((id: string) => {
    if (!lessons.some((lesson) => lesson.id === id)) return;
    const revision = ++lessonRevision.current;
    setLastLessonId(id);
    void saveLesson(id).then(() => {
      if (mountedRef.current && revision === lessonRevision.current) setLessonWarning(undefined);
    }).catch(() => {
      if (mountedRef.current && revision === lessonRevision.current) setLessonWarning("La reprise de cette leçon n’a pas été enregistrée. Les leçons restent accessibles.");
    });
  }, [saveLesson]);

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

  const value = useMemo<ProgressContextValue>(() => ({
    progress, hydrated, ...(warning ? { warning } : {}), recordAttempt,
    ...(lastLessonId ? { lastLessonId } : {}), lessonHydrated,
    ...(lessonWarning ? { lessonWarning } : {}), rememberLesson,
  }), [hydrated, progress, recordAttempt, warning, lastLessonId, lessonHydrated, lessonWarning, rememberLesson]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("useProgress must be used inside ProgressProvider");
  return context;
}
