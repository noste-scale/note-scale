import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createDailySession, createEmptyProgress, encodeProgress, getScaleById, mergeProgressStates,
  LESSONS, recordAttempt, summarizeProgress,
  type Exercise, type ExerciseType, type GradeResult, type Lesson, type ProgressState,
} from "@notescale/music";
import { getScale, scales, type UiNote, type UiScale } from "./domain";
import { WebScaleAudio, type AudioDirection as Direction, type AudioSpeed as Speed } from "./audio";
import {
  createRegularExercise,
  constructionDetails,
  displayedCorrectAnswer,
  EXERCISE_TYPES,
  filterScales,
  focusMainContent,
  pianoLabels,
  randomExerciseTypeIndex,
  requestedScale,
  safeRouteScaleId,
  submitExerciseAnswer,
  type ExerciseSelection,
} from "./app-model";
import { loadBrowserProgress, saveBrowserProgress, storageEventUpdate } from "./storage";

export const ProgressContext = createContext<{
  progress: ProgressState;
  ready: boolean;
  record: (scaleId: string | undefined, correct: boolean, exerciseType?: ExerciseType) => void;
}>({ progress: createEmptyProgress(), ready: false, record: () => undefined });

function ProgressProvider({ children }: { children: ReactNode }) {
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
  const recordExerciseAttempt = useCallback((scaleId: string | undefined, correct: boolean, exerciseType: ExerciseType = "build-scale") => {
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
    <ProgressContext.Provider value={{ progress, ready, record: recordExerciseAttempt }}>
      {warning && <p className="banner" role="status">{warning}</p>}
      {children}
    </ProgressContext.Provider>
  );
}

function Layout() {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    try {
      return localStorage.getItem("notescale.theme") === "dark";
    } catch {
      return false;
    }
  });
  const [offlineWarning, setOfflineWarning] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = isDarkTheme ? "dark" : "light";
    try {
      localStorage.setItem("notescale.theme", isDarkTheme ? "dark" : "light");
    } catch { /* Progress storage already surfaces the non-blocking persistence warning. */ }
  }, [isDarkTheme]);
  useEffect(() => {
    const showOfflineWarning = () => setOfflineWarning(true);
    window.addEventListener("notescale-offline-error", showOfflineWarning);
    return () => window.removeEventListener("notescale-offline-error", showOfflineWarning);
  }, []);
  return (
    <>
      <button type="button" className="skip" onClick={() => focusMainContent(document)}>Aller au contenu</button>
      <header>
        <Link className="brand" to="/" aria-label="NoteScale, accueil">♪ NoteScale</Link>
        <button
          className="theme"
          onClick={() => setIsDarkTheme(!isDarkTheme)}
          aria-label={isDarkTheme ? "Activer le thème clair" : "Activer le thème sombre"}
        >
          {isDarkTheme ? "☀" : "☾"}
        </button>
      </header>
      {offlineWarning && <p className="banner" role="status">Mode hors ligne non installé. Recharge la page en ligne pour réessayer.</p>}
      <nav className="tabs" aria-label="Navigation principale">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink key={to} end={to === '/'} to={to}>
            <span aria-hidden="true">{icon}</span>{label}
          </NavLink>
        ))}
      </nav>
      <main id="contenu" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/apprendre" element={<Learn />} />
          <Route path="/gammes" element={<ScaleList />} />
          <Route path="/gammes/:id" element={<ScaleDetail />} />
          <Route path="/generateur" element={<Generator />} />
          <Route path="/exercices" element={<Exercises />} />
          <Route path="/quotidien" element={<Daily />} />
          <Route path="/progression" element={<ProgressPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

const NAV_ITEMS = [
  { to: "/", icon: "⌂", label: "Accueil" },
  { to: "/apprendre", icon: "◎", label: "Apprendre" },
  { to: "/exercices", icon: "✎", label: "Exercices" },
  { to: "/progression", icon: "▥", label: "Progression" },
] as const;

function Home() {
  return (
    <section className="hero">
      <p className="eyebrow">La musique, pas à pas</p>
      <h1>Construis toutes les gammes majeures</h1>
      <p className="lead">Une seule formule. Des explications claires. Quelques minutes par jour.</p>
      <div className="formula" aria-label="Ton, ton, demi-ton, ton, ton, ton, demi-ton">
        <span>T · T · ½</span><span><b aria-hidden="true">|</b> T · T · T · ½</span>
      </div>
      <div className="actions">
        <Link className="primary" to="/apprendre">Apprendre</Link>
        <Link className="button" to="/gammes">Toutes les gammes</Link>
        <Link className="button" to="/exercices">Exercices</Link>
        <Link className="button" to="/progression">Ma progression</Link>
      </div>
      <Link className="daily" to="/quotidien">
        <b>Entraînement du jour</b>
        <span>3 à 5 minutes →</span>
      </Link>
    </section>
  );
}

const MAJOR_INTERVALS = ["ton", "ton", "demi-ton", "ton", "ton", "ton", "demi-ton"] as const;

function IntervalPattern() {
  return (
    <div className="interval-pattern" aria-label="Ton, ton, demi-ton, ton, ton, ton, demi-ton">
      {MAJOR_INTERVALS.map((interval, index) => (
        <span className={interval === "ton" ? "tone" : "semitone"} key={index}>
          <b>{interval === "ton" ? "T" : "½"}</b>
          <small>{interval}</small>
        </span>
      ))}
    </div>
  );
}

function LessonBody({ lesson }: { lesson: Lesson }) {
  let exampleScale: UiScale | undefined;
  if (lesson.id === "c-major") exampleScale = getScale("C");
  else if (lesson.id === "d-major") exampleScale = getScale("D");
  return (
    <>
      {lesson.summary && <p className="notes">{lesson.summary}</p>}
      {lesson.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {lesson.notes && <p>{lesson.notes.join(" · ")}</p>}
      {lesson.id === "tones" && (
        <>
          <div className="tone-guide">
            <span className="semitone"><b>½ ton</b> · 1 touche</span>
            <span className="tone"><b>1 ton</b> · 2 demi-tons</span>
          </div>
          <Piano notes={[]} />
        </>
      )}
      {["formula", "c-major", "d-major"].includes(lesson.id) && <IntervalPattern />}
      {exampleScale && (
        <ol className="lesson-steps">
          {exampleScale.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      )}
    </>
  );
}

function Learn() {
  return (
    <Page title="Apprendre" intro="Comprends la règle avant de mémoriser.">
      <div className="stack">
        {LESSONS.map((lesson, index) => (
          <details className="card lesson" key={lesson.id} open={index === 0}>
            <summary><span>{index + 1}</span>{lesson.title.replace(/^\d+\.\s*/, "")}</summary>
            <div><LessonBody lesson={lesson} /></div>
          </details>
        ))}
      </div>
      <div className="actions">
        <Link className="primary" to="/generateur">Essayer le générateur</Link>
        <Link className="button" to="/gammes">Voir les 15 gammes</Link>
      </div>
    </Page>
  );
}

function ScaleList() {
  const [query, setQuery] = useState("");
  const matchingScales = filterScales(query);
  return (
    <Page title="Toutes les gammes" intro="15 écritures conventionnelles, de Do majeur à Do♭ majeur.">
      <label className="search">
        Rechercher une gamme
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" />
      </label>
      {!scales.length ? (
        <EmptyDomain />
      ) : !matchingScales.length ? (
        <p className="banner" role="status">Aucune gamme ne correspond à « {query} ».</p>
      ) : null}
      <div className="grid">
        {matchingScales.map((scale) => (
          <article className="card scale-card" key={scale.id}>
            <h2>{scale.frenchName}</h2>
            <p className="muted">{scale.internationalName}</p>
            <NoteRow notes={scale.notes} />
            <p>{describeKeySignature(scale)}</p>
            <div className="inline">
              <AudioPlayer notes={scale.notes} label={scale.frenchName} compact />
              <Link className="button" to={`/gammes/${encodeURIComponent(scale.id)}`} aria-label={`Détails de ${scale.frenchName}`}>Détails</Link>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function ScaleDetail() {
  const { id = "" } = useParams();
  const decodedScaleId = safeRouteScaleId(id);
  const scale = decodedScaleId ? getScale(decodedScaleId) : undefined;
  if (!scale) return <NotFound />;
  return (
    <Page title={scale.frenchName} intro={`${scale.internationalName} · ${describeKeySignature(scale)}`}>
      <NoteRow notes={scale.notes} />
      <AudioPlayer notes={scale.notes} label={scale.frenchName} />
      <section className="card">
        <h2>Clavier</h2>
        <Piano notes={scale.notes} />
      </section>
      <section className="card">
        <h2>Construction</h2>
        <div className="intervals">
          {scale.notes.slice(0, -1).map((note, index) => (
            <span key={`${note.id}-${index}`}>
              <b>{note.label}</b>
              <small>{["ton", "ton", "½ ton", "ton", "ton", "ton", "½ ton"][index]}</small>
            </span>
          ))}
        </div>
        {scale.steps.map((step) => <p key={step}>{step}</p>)}
      </section>
      <Link className="primary" to={`/exercices?gamme=${encodeURIComponent(scale.id)}`}>Commencer un exercice</Link>
    </Page>
  );
}

function Generator() {
  const [scaleId, setScaleId] = useState(scales[0]?.id ?? "");
  const [constructionStep, setConstructionStep] = useState(0);
  const scale = getScale(scaleId);
  const construction = constructionDetails(scaleId, constructionStep);
  return (
    <Page title="Générateur" intro="Choisis une tonique, puis avance intervalle par intervalle.">
      <label>
        Note de départ
        <select value={scaleId} onChange={(event) => {
          setScaleId(event.target.value);
          setConstructionStep(0);
        }}>
          {scales.map((scaleOption) => <option key={scaleOption.id} value={scaleOption.id}>{scaleOption.frenchName}</option>)}
        </select>
      </label>
      {scale && (
        <section className="card">
          <NoteRow notes={scale.notes.slice(0, constructionStep + 1)} />
          <div aria-live="polite">
            {construction ? (
              <>
                <dl className="construction-data">
                  <div><dt>Note actuelle</dt><dd>{construction.currentNote}</dd></div>
                  <div><dt>Intervalle</dt><dd>{construction.interval}</dd></div>
                  <div><dt>Lettre naturelle attendue</dt><dd>{construction.expectedNatural}</dd></div>
                  <div><dt>Altération requise</dt><dd>{construction.requiredAccidental}</dd></div>
                </dl>
                <p>Note obtenue : <b>{construction.nextNote}</b>.</p>
                <p>{construction.explanation}</p>
              </>
            ) : <p>Commence sur la tonique {scale.notes[0]?.label}.</p>}
          </div>
          <div className="inline">
            <button onClick={() => setConstructionStep(Math.max(0, constructionStep - 1))} disabled={!constructionStep}>Précédent</button>
            <button className="primary" onClick={() => setConstructionStep(Math.min(7, constructionStep + 1))} disabled={constructionStep >= 7}>Étape suivante</button>
          </div>
        </section>
      )}
      <EmptyWhen needed={!scale} />
    </Page>
  );
}

const exerciseNames = ["Compléter une gamme", "Construire toute la gamme", "Identifier les altérations", "Reconnaître l’intervalle", "Trouver l’erreur"];
function Exercises() {
  const [query] = useSearchParams();
  const requestedScaleId = query.get("gamme");
  const scaleRequest = requestedScale(requestedScaleId);
  if (scaleRequest.error) {
    return (
      <Page title="Exercices" intro="La demande ne peut pas être ouverte.">
        <p className="banner" role="alert">{scaleRequest.error} Choisis une gamme dans le catalogue.</p>
        <Link className="primary" to="/gammes">Voir les gammes</Link>
      </Page>
    );
  }
  return <ExerciseWorkspace key={requestedScaleId ?? "random"} requested={scaleRequest.scale} />;
}

function ExerciseWorkspace({ requested }: { requested: UiScale | undefined }) {
  const navigate = useNavigate();
  const { progress, ready: isProgressReady } = useContext(ProgressContext);
  const [exerciseTypeIndex, setExerciseTypeIndex] = useState(() => randomExerciseTypeIndex());
  const [selection, setSelection] = useState<ExerciseSelection>();
  useEffect(() => {
    if (isProgressReady && !selection) {
      setSelection(createRegularExercise(exerciseTypeIndex, undefined, requested, Math.random, progress));
    }
  }, [progress, isProgressReady, requested, selection, exerciseTypeIndex]);
  const changeExerciseType = (selectedTypeIndex: number) => {
    const nextSelection = createRegularExercise(selectedTypeIndex, selection, requested, Math.random, progress);
    setSelection(nextSelection);
    setExerciseTypeIndex(nextSelection ? Math.max(0, EXERCISE_TYPES.indexOf(nextSelection.exercise.type)) : selectedTypeIndex);
  };
  const retryExercise = () => {
    const nextSelection = createRegularExercise(exerciseTypeIndex, selection, requested, Math.random, progress);
    setSelection(nextSelection);
    if (nextSelection) setExerciseTypeIndex(Math.max(0, EXERCISE_TYPES.indexOf(nextSelection.exercise.type)));
  };
  return (
    <Page title="Exercices" intro="Propose une réponse avant de voir la correction.">
      <label className="exercise-type">
        Type d’exercice
        <select value={exerciseTypeIndex} onChange={(event) => changeExerciseType(Number(event.target.value))}>
          {exerciseNames.map((name, index) => <option value={index} key={name}>{name}</option>)}
        </select>
      </label>
      <div className="actions">
        <button type="button" onClick={() => changeExerciseType(exerciseTypeIndex)} disabled={!selection}>Nouvelle question</button>
      </div>
      {selection ? (
        <ExerciseCard
          scale={selection.scale}
          exercise={selection.exercise}
          onNewExercise={retryExercise}
          key={`${selection.exercise.id}-${selection.exercise.question}`}
        />
      ) : isProgressReady ? <EmptyDomain /> : <p role="status">Préparation de l’exercice.</p>}
      <button className="daily" onClick={() => navigate('/quotidien')}>
        <b>Session quotidienne</b>
        <span>Commencer →</span>
      </button>
    </Page>
  );
}

export function ExerciseCard({ scale, exercise, onGraded, onNewExercise }: { scale: UiScale; exercise: Exercise; onGraded?: () => void; onNewExercise?: () => void }) {
  const { record: recordExerciseAttempt } = useContext(ProgressContext);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<GradeResult>();
  const hasRecordedAttempt = useRef(false);
  function submitAnswer() {
    const gradeResult = submitExerciseAnswer(exercise, answer, hasRecordedAttempt.current, (attempt) => {
      recordExerciseAttempt(attempt.scaleId, attempt.correct, attempt.exerciseType);
      onGraded?.();
    });
    if (gradeResult.graded) hasRecordedAttempt.current = true;
    setResult(gradeResult);
  }
  return (
    <section className="card exercise" data-scale={scale.id}>
      <p className="eyebrow">Question</p>
      <h2>{exercise.question}</h2>
      {exercise.promptNotes && <p className="notes">{exercise.promptNotes.join(" – ")}</p>}
      {exercise.options ? (
        <fieldset disabled={result?.graded}>
          <legend>Ta réponse</legend>
          {exercise.options.map((option) => (
            <label className="radio" key={option}>
              <input
                type="radio"
                name={`answer-${exercise.id}`}
                value={option}
                checked={answer === option}
                onChange={(event) => setAnswer(event.target.value)}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <>
          <label>
            Ta réponse
            <textarea
              rows={2}
              value={answer}
              disabled={result?.graded}
              onChange={(event) => setAnswer(event.target.value)}
              aria-describedby={`answer-help-${exercise.id}`}
            />
          </label>
          <small id={`answer-help-${exercise.id}`}>Sépare plusieurs notes par « et », des espaces, virgules ou tirets.</small>
        </>
      )}
      {!result?.graded ? (
        <div className="actions"><button className="primary" onClick={submitAnswer}>Valider ma réponse</button></div>
      ) : (
        <div className={result.correct ? "feedback good" : "feedback bad"} role="status">
          <h3>{result.correct ? "Bravo, c’est correct !" : "Pas encore."}</h3>
          {result.errors.map((error, index) => <p key={index}>{error.message}</p>)}
          <p>Bonne réponse : <b>{displayedCorrectAnswer(result.correctAnswer)}</b></p>
          <p>{result.explanation}</p>
          <p>Règle à retenir : {result.rule}</p>
          {onNewExercise && <button onClick={onNewExercise}>Nouvelle tentative</button>}
        </div>
      )}
      {result?.validationMessage && <p className="feedback bad" role="alert">{result.validationMessage}</p>}
    </section>
  );
}

function Daily() {
  const { progress, ready: isProgressReady } = useContext(ProgressContext);
  const [session, setSession] = useState<ReturnType<typeof createDailySession>>();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  useEffect(() => {
    if (isProgressReady && !session) setSession(createDailySession(progress));
  }, [progress, isProgressReady, session]);
  if (!session) {
    return (
      <Page title="Entraînement quotidien" intro="Chargement de ta progression…">
        <p role="status">Préparation de la session.</p>
      </Page>
    );
  }
  const questions = [session.naturalSemitoneQuestion, ...session.scaleExercises];
  const exercise = questions[questionIndex];
  const scale = getScale(exercise?.scaleId ?? "") ?? scales[0];
  if (!exercise || !scale) return <Page title="Entraînement quotidien"><EmptyDomain /></Page>;
  const isLastQuestion = questionIndex >= questions.length - 1;
  let continuation: ReactNode;
  if (!hasAnswered) {
    continuation = <p className="muted">Valide ta réponse pour continuer.</p>;
  } else if (isLastQuestion) {
    continuation = <Link className="primary" to="/progression">Voir ma progression</Link>;
  } else {
    continuation = (
      <button onClick={() => {
        setQuestionIndex(questionIndex + 1);
        setHasAnswered(false);
      }}>Question suivante</button>
    );
  }
  return (
    <Page title="Entraînement quotidien" intro={`Question ${questionIndex + 1} sur ${questions.length} · ${session.formulaReminder}`}>
      <ExerciseCard scale={scale} exercise={exercise} onGraded={() => setHasAnswered(true)} key={exercise.id} />
      {continuation}
    </Page>
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
          <ul>{summary.mastered.map((scaleId) => <li key={scaleId}>{getScale(scaleId)?.frenchName ?? scaleId}</li>)}</ul>
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

function AudioPlayer({ notes, label, compact = false }: { notes: UiNote[]; label: string; compact?: boolean }) {
  const [direction, setDirection] = useState<Direction>("up");
  const [speed, setSpeed] = useState<Speed>("normal");
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioPlayer = useRef<WebScaleAudio | undefined>(undefined);
  if (!audioPlayer.current) {
    audioPlayer.current = new WebScaleAudio(undefined, () => {
      setIsPlaying(false);
      setError("La lecture audio a échoué. Réessaie ou utilise les autres activités.");
    }, () => setIsPlaying(false));
  }
  const stopPlayback = useCallback(() => {
    audioPlayer.current?.stop();
    setIsPlaying(false);
  }, []);
  const notesKey = notes.map((note) => note.id).join("|");
  useEffect(() => () => audioPlayer.current?.stop(), []);
  useEffect(() => {
    stopPlayback();
  }, [direction, notesKey, speed, stopPlayback]);
  function playScale() {
    const playablePitches = notes.map((note) => note.pitch).filter((pitch) => pitch >= 0);
    const hasStartedPlayback = audioPlayer.current?.play(playablePitches, direction, speed) ?? false;
    setIsPlaying(hasStartedPlayback);
    setError(hasStartedPlayback ? "" : "Audio indisponible sur ce navigateur.");
  }
  if (compact) {
    return (
      <>
        <button onClick={playScale} aria-label={`Écouter ${label}`}>▶ Écouter</button>
        {error && <span role="status">{error}</span>}
      </>
    );
  }
  return (
    <section className="card audio">
      <h2>Écouter</h2>
      <div className="inline">
        <label>
          Sens
          <select value={direction} onChange={(event) => setDirection(event.target.value as Direction)}>
            <option value="up">Ascendant</option>
            <option value="down">Descendant</option>
          </select>
        </label>
        <label>
          Vitesse
          <select value={speed} onChange={(event) => setSpeed(event.target.value as Speed)}>
            <option value="normal">Normale</option>
            <option value="slow">Lente</option>
          </select>
        </label>
      </div>
      <div className="inline">
        <button className="primary" onClick={playScale}>▶ {isPlaying ? "Recommencer" : "Écouter"}</button>
        <button onClick={() => void audioPlayer.current?.pauseResume().then((isActive) => {
          if (!isActive) setIsPlaying(false);
        })} disabled={!isPlaying}>Pause / reprendre</button>
        <button onClick={stopPlayback} disabled={!isPlaying}>Arrêter</button>
      </div>
      {error && <p role="status">{error}</p>}
    </section>
  );
}

function Piano({ notes }: { notes: UiNote[] }) {
  const highlightedPitches = new Set(notes.map((note) => note.pitch));
  const [error, setError] = useState("");
  const audioPlayer = useRef<WebScaleAudio | undefined>(undefined);
  if (!audioPlayer.current) {
    audioPlayer.current = new WebScaleAudio(undefined, () => setError("Le son du piano n’a pas pu être lu."));
  }
  useEffect(() => () => audioPlayer.current?.stop(), []);
  const labels = pianoLabels(notes);
  const playNote = (pitch: number) => {
    const hasStartedPlayback = audioPlayer.current?.play([pitch], "up", "normal") ?? false;
    setError(hasStartedPlayback ? "" : "Piano audio indisponible sur ce navigateur.");
  };
  return (
    <>
      <div className="piano" role="group" aria-label={notes.length ? `Clavier montrant ${notes.map((note) => note.label).join(", ")}` : "Clavier de piano interactif"}>
        {labels.map((label, pitch) => (
          <button
            type="button"
            key={label}
            onClick={() => playNote(pitch)}
            className={`${[1,3,6,8,10].includes(pitch) ? "black" : "white"} ${highlightedPitches.has(pitch) ? "active" : ""}`}
            aria-label={`Écouter ${label}`}
          >
            <small>{label}</small>
          </button>
        ))}
      </div>
      {error && <p role="status">{error}</p>}
    </>
  );
}

function NoteRow({ notes }: { notes: UiNote[] }) {
  return (
    <div className="note-row" aria-label={notes.map((note) => note.label).join(", ")}>
      {notes.map((note, index) => <span key={`${note.id}-${index}`}>{note.label}</span>)}
    </div>
  );
}

function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      {intro && <p className="lead">{intro}</p>}
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

function describeKeySignature(scale: UiScale) {
  if (!scale.keySignatureCount) return "Sans altération";
  return `${scale.keySignatureCount} altération${scale.keySignatureCount > 1 ? "s" : ""} : ${scale.accidentals.join(", ")}`;
}

function EmptyDomain() {
  return <p className="banner" role="status">Le catalogue musical est indisponible. Réessaie après le chargement de l’application.</p>;
}

function EmptyWhen({ needed }: { needed: boolean }) {
  return needed ? <EmptyDomain /> : null;
}

function NotFound() {
  return (
    <Page title="Page introuvable">
      <p>Cette page n’existe pas ou cette gamme n’est pas prise en charge.</p>
      <Link className="primary" to="/">Retour à l’accueil</Link>
    </Page>
  );
}

export default function App() {
  return <ProgressProvider><Layout /></ProgressProvider>;
}
