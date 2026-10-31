import {
  createEmptyProgress,
  isTonicId,
  LESSONS,
  recordAttempt as applyAttempt,
  safeLoadProgress,
  safeSaveProgress,
  type ExerciseType,
  type ProgressState,
  type StorageAdapter,
} from "@notescale/music";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  createSerializedSaver,
  loadProgressWithRetry,
  persistenceWarningAfterSave,
  resolveHydration,
  STORAGE_OPERATION_TIMEOUT_MS,
  withTimeout,
  type PendingAttempt,
} from "./progress-state";

interface ProgressContextValue {
  progress: ProgressState;
  hydrated: boolean;
  warning?: string;
  recordAttempt: (
    scaleId: string | undefined,
    correct: boolean,
    exerciseType: ExerciseType
  ) => void;
  lastLessonId?: string;
  lessonHydrated: boolean;
  lessonWarning?: string;
  rememberLesson: (id: string) => void;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export function ProgressProvider({
  children,
  storage: suppliedStorage
}: PropsWithChildren<{ storage: StorageAdapter }>) {
  const storage = useRef(suppliedStorage).current;
  const [progress, setProgress] = useState<ProgressState>(() => createEmptyProgress());
  const [hydrated, setHydrated] = useState(false);
  const [warning, setWarning] = useState<string>();
  const [lastLessonId, setLastLessonId] = useState<string>();
  const [lessonHydrated, setLessonHydrated] = useState(false);
  const [lessonWarning, setLessonWarning] = useState<string>();
  const lessonBookmarkRevision = useRef(0);
  const progressRef = useRef(progress);
  const hydratedRef = useRef(false);
  const canSaveRef = useRef(false);
  const pendingAttemptsRef = useRef<PendingAttempt[]>([]);
  const mountedRef = useRef(true);
  const saveProgress = useRef(createSerializedSaver(
    (snapshot: ProgressState) => safeSaveProgress(storage, snapshot),
    STORAGE_OPERATION_TIMEOUT_MS,
  )).current;
  // ponytail: a bookmark, not lesson completion; exercise progress stays untouched.
  const saveLessonBookmark = useRef(createSerializedSaver(
    async (id: string) => storage.setItem("notescale.lesson.v1", id),
    STORAGE_OPERATION_TIMEOUT_MS,
  )).current;

  const persistProgress = useCallback((snapshot: ProgressState) => {
    if (!canSaveRef.current) return;

    void saveProgress(snapshot).then((saveWarning) => {
      if (mountedRef.current) setWarning(persistenceWarningAfterSave(saveWarning));
    }).catch(() => {
      if (mountedRef.current) setWarning("La progression ne peut pas être enregistrée sur cet appareil.");
    });
  }, [saveProgress]);

  useEffect(() => {
    let isEffectActive = true;
    mountedRef.current = true;
    loadProgressWithRetry(() => safeLoadProgress(storage)).then((loadedProgress) => {
      if (!isEffectActive) return;

      const pendingAttempts = pendingAttemptsRef.current;
      pendingAttemptsRef.current = [];
      const hydration = resolveHydration(loadedProgress, pendingAttempts);
      progressRef.current = hydration.progress;
      canSaveRef.current = loadedProgress.canSave;
      hydratedRef.current = true;
      setProgress(hydration.progress);
      setWarning(loadedProgress.warning ?? undefined);
      setHydrated(true);

      if (hydration.shouldSave) persistProgress(hydration.progress);
    });

    return () => {
      isEffectActive = false;
      mountedRef.current = false;
    };
  }, [persistProgress, storage]);

  useEffect(() => {
    let isEffectActive = true;
    const bookmarkRevision = lessonBookmarkRevision.current;

    void withTimeout(
      Promise.resolve().then(() => storage.getItem("notescale.lesson.v1")),
      STORAGE_OPERATION_TIMEOUT_MS
    ).then((storedLessonId) => {
      if (!isEffectActive) return;
      if (bookmarkRevision !== lessonBookmarkRevision.current) return;
      if (!storedLessonId) return;
      if (!LESSONS.some((lesson) => lesson.id === storedLessonId)) return;

      setLastLessonId(storedLessonId);
    }).catch(() => {
      if (isEffectActive && bookmarkRevision === lessonBookmarkRevision.current) setLessonWarning(
        "La dernière leçon n’a pas pu être retrouvée. Tu peux toujours choisir une leçon."
      );
    }).finally(() => {
      if (isEffectActive) setLessonHydrated(true);
    });

    return () => {
      isEffectActive = false;
    };
  }, [storage]);

  const rememberLesson = useCallback((id: string) => {
    if (!LESSONS.some((lesson) => lesson.id === id)) return;

    const bookmarkRevision = ++lessonBookmarkRevision.current;
    setLastLessonId(id);
    void saveLessonBookmark(id).then(() => {
      if (mountedRef.current && bookmarkRevision === lessonBookmarkRevision.current) setLessonWarning(undefined);
    }).catch(() => {
      if (mountedRef.current && bookmarkRevision === lessonBookmarkRevision.current) setLessonWarning(
        "La reprise de cette leçon n’a pas été enregistrée. Les leçons restent accessibles."
      );
    });
  }, [saveLessonBookmark]);

  const recordAttempt = useCallback((
    scaleId: string | undefined,
    correct: boolean,
    exerciseType: ExerciseType
  ) => {
    const pendingAttempt: PendingAttempt = {
      input: {
        exerciseType,
        ...(scaleId && isTonicId(scaleId) ? { scaleId } : {}),
        correct,
      },
      at: new Date()
    };

    if (!hydratedRef.current) {
      pendingAttemptsRef.current.push(pendingAttempt);

      return;
    }

    const updatedProgress = applyAttempt(progressRef.current, pendingAttempt.input, pendingAttempt.at);
    progressRef.current = updatedProgress;
    setProgress(updatedProgress);
    persistProgress(updatedProgress);
  }, [persistProgress]);

  const contextValue = useMemo<ProgressContextValue>(() => ({
    progress,
    hydrated,
    ...(warning ? { warning } : {}),
    recordAttempt,
    ...(lastLessonId ? { lastLessonId } : {}),
    lessonHydrated,
    ...(lessonWarning ? { lessonWarning } : {}),
    rememberLesson,
  }), [
    hydrated,
    progress,
    recordAttempt,
    warning,
    lastLessonId,
    lessonHydrated,
    lessonWarning,
    rememberLesson
  ]);

  return (
    <ProgressContext.Provider value={contextValue}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const progressContext = useContext(ProgressContext);

  if (!progressContext) throw new Error("useProgress must be used inside ProgressProvider");

  return progressContext;
}
