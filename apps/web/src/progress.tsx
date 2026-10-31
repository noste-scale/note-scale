import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { Link } from "react-router-dom";
import {
  createEmptyProgress,
  encodeProgress,
  getScaleById,
  mergeProgressStates,
  recordAttempt,
  summarizeProgress,
  type ExerciseType,
  type ProgressState,
} from "@notescale/music";
import { Page, Stat } from "./components";
import { getScale } from "./domain";
import { loadBrowserProgress, saveBrowserProgress, storageEventUpdate } from "./storage";

export const ProgressContext = createContext<{
  progress: ProgressState;
  ready: boolean;
  record: (
    scaleId: string | undefined,
    correct: boolean,
    exerciseType?: ExerciseType
  ) => void;
}>({
  progress: createEmptyProgress(),
  ready: false,
  record: () => undefined
});

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(createEmptyProgress);
  const [warning, setWarning] = useState<string>();
  const [canSave, setCanSave] = useState(false);
  const [ready, setReady] = useState(false);
  const progressRef = useRef(progress);
  const storageEpoch = useRef(0);
  const skipSaveState = useRef<string | undefined>(undefined);
  progressRef.current = progress;

  useEffect(() => {
    let isMounted = true;
    const loadEpoch = storageEpoch.current;
    void loadBrowserProgress().then((loadedProgress) => {
      if (!isMounted || loadEpoch !== storageEpoch.current) return;

      setProgress((currentProgress) => {
        const mergedProgress = mergeProgressStates(loadedProgress.state, currentProgress);
        progressRef.current = mergedProgress;

        return mergedProgress;
      });
      setWarning(loadedProgress.warning ?? undefined);
      setCanSave(loadedProgress.canSave);
      setReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !canSave) return;

    const encodedProgress = encodeProgress(progress);

    if (skipSaveState.current === encodedProgress) {
      skipSaveState.current = undefined;

      return;
    }

    skipSaveState.current = undefined;
    const saveEpoch = storageEpoch.current;
    void saveBrowserProgress(progress).then((saveResult) => {
      if (saveEpoch !== storageEpoch.current) return;

      setWarning(saveResult.warning ?? undefined);

      if (saveResult.saved) {
        setProgress((currentProgress) => {
          const isAlreadySaved = encodeProgress(currentProgress) === encodeProgress(saveResult.state);
          const mergedProgress = isAlreadySaved
            ? currentProgress
            : mergeProgressStates(currentProgress, saveResult.state);
          progressRef.current = mergedProgress;

          return mergedProgress;
        });
      }
    });
  }, [canSave, progress, ready]);

  useEffect(() => {
    const synchronizeProgress = (event: StorageEvent) => {
      const storageUpdate = storageEventUpdate(progressRef.current, event.key, event.newValue);

      if (!storageUpdate) return;

      storageEpoch.current += 1;
      setWarning(storageUpdate.warning ?? undefined);
      setCanSave(storageUpdate.canSave);
      setReady(true);

      if (!storageUpdate.needsSave) skipSaveState.current = encodeProgress(storageUpdate.state);
      if (storageUpdate.canSave) {
        progressRef.current = storageUpdate.state;
        setProgress(storageUpdate.state);
      }
    };
    window.addEventListener("storage", synchronizeProgress);

    return () => window.removeEventListener("storage", synchronizeProgress);
  }, []);

  const recordExerciseAttempt = useCallback((
    scaleId: string | undefined,
    correct: boolean,
    exerciseType: ExerciseType = "build-scale"
  ) => {
    setProgress((currentProgress) => {
      const tonicId = scaleId ? getScaleById(scaleId)?.id : undefined;
      const updatedProgress = recordAttempt(currentProgress, {
        ...(tonicId ? { scaleId: tonicId } : {}),
        exerciseType,
        correct,
      });
      progressRef.current = updatedProgress;

      return updatedProgress;
    });
  }, []);

  return (
    <ProgressContext.Provider value={{
      progress,
      ready,
      record: recordExerciseAttempt
    }}>
      {warning && <p className="banner" role="status">{warning}</p>}
      {children}
    </ProgressContext.Provider>
  );
}

export function ProgressPage() {
  const { progress, ready: isProgressReady } = useContext(ProgressContext);

  if (!isProgressReady) {
    return (
      <Page title="Ma progression" intro="Chargement de ta progression…">
        <p role="status">Lecture des données locales.</p>
      </Page>
    );
  }

  const summary = summarizeProgress(progress);

  return (
    <Page title="Ma progression" intro="Tes données restent uniquement sur cet appareil.">
      {summary.total === 0 && (
        <section className="card">
          <h2>Ta première gamme t’attend</h2>
          <p>Commence un exercice pour suivre tes réponses et les gammes à revoir.</p>
          <Link className="primary" to="/exercices">Commencer un exercice</Link>
        </section>
      )}
      <div className="stats">
        <Stat value={summary.total} label={summary.total === 1 ? "exercice" : "exercices"} />
        <Stat value={summary.correct} label={summary.correct === 1 ? "bonne réponse" : "bonnes réponses"} />
        <Stat value={`${summary.accuracy} %`} label="réussite" />
        <Stat value={summary.streak} label={summary.streak === 1 ? "jour de suite" : "jours de suite"} />
      </div>
      <section className="card">
        <h2>Gammes maîtrisées</h2>
        {summary.mastered.length ? (
          <ul>
            {summary.mastered.map((scaleId) => <li key={scaleId}>{getScale(scaleId)?.frenchName ?? scaleId}</li>)}
          </ul>
        ) : <p>Continue : une gamme est maîtrisée avec 5 bonnes réponses sur 6, dont la plus récente.</p>}
      </section>
      <section className="card">
        <h2>À revoir</h2>
        {summary.toReview.length ? (
          <ul>
            {summary.toReview.map((scaleId) => (
              <li key={scaleId}>
                <Link to={`/gammes/${encodeURIComponent(scaleId)}`}>{getScale(scaleId)?.frenchName ?? scaleId}</Link>
              </li>
            ))}
          </ul>
        ) : <p>Aucune gamme à revoir pour le moment.</p>}
      </section>
    </Page>
  );
}
