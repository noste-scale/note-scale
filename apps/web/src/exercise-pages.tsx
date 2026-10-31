import {
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createDailySession, type Exercise, type GradeResult } from "@notescale/music";
import {
  createRegularExercise,
  displayedCorrectAnswer,
  EXERCISE_TYPES,
  randomExerciseTypeIndex,
  requestedScale,
  submitExerciseAnswer,
  type ExerciseSelection,
} from "./app-model";
import { EmptyDomain, Page } from "./components";
import { getScale, scales, type UiScale } from "./domain";
import { ProgressContext } from "./progress";

const exerciseTypeLabels = [
  "Compléter une gamme",
  "Construire toute la gamme",
  "Identifier les altérations",
  "Reconnaître l’intervalle",
  "Trouver l’erreur"
];

export function Exercises() {
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
  const [exerciseSelection, setExerciseSelection] = useState<ExerciseSelection>();

  useEffect(() => {
    if (isProgressReady && !exerciseSelection) {
      setExerciseSelection(createRegularExercise({
        exerciseTypeIndex,
        preferredScale: requested,
        progress
      }));
    }
  }, [progress, isProgressReady, requested, exerciseSelection, exerciseTypeIndex]);

  const generateNextExercise = (selectedTypeIndex: number) => {
    const nextSelection = createRegularExercise({
      exerciseTypeIndex: selectedTypeIndex,
      previousSelection: exerciseSelection,
      preferredScale: requested,
      progress
    });
    setExerciseSelection(nextSelection);
    setExerciseTypeIndex(nextSelection
      ? Math.max(0, EXERCISE_TYPES.indexOf(nextSelection.exercise.type))
      : selectedTypeIndex);
  };

  const generateAnotherExercise = () => {
    const nextSelection = createRegularExercise({
      exerciseTypeIndex,
      previousSelection: exerciseSelection,
      preferredScale: requested,
      progress
    });
    setExerciseSelection(nextSelection);

    if (nextSelection) setExerciseTypeIndex(Math.max(0, EXERCISE_TYPES.indexOf(nextSelection.exercise.type)));
  };

  return (
    <Page title="Exercices" intro="Propose une réponse avant de voir la correction.">
      <label className="exercise-type">
        Type d’exercice
        <select value={exerciseTypeIndex} onChange={(event) => generateNextExercise(Number(event.target.value))}>
          {exerciseTypeLabels.map((label, typeIndex) => <option value={typeIndex} key={label}>{label}</option>)}
        </select>
      </label>
      <div className="actions">
        <button
          type="button"
          onClick={() => generateNextExercise(exerciseTypeIndex)}
          disabled={!exerciseSelection}
        >Nouvelle question</button>
      </div>
      {exerciseSelection ? (
        <ExerciseCard
          scale={exerciseSelection.scale}
          exercise={exerciseSelection.exercise}
          onNewExercise={generateAnotherExercise}
          key={`${exerciseSelection.exercise.id}-${exerciseSelection.exercise.question}`}
        />
      ) : isProgressReady
        ? <EmptyDomain />
        : <p role="status">Préparation de l’exercice.</p>}
      <button className="daily" onClick={() => navigate('/quotidien')}>
        <b>Session quotidienne</b>
        <span>Commencer →</span>
      </button>
    </Page>
  );
}

export function ExerciseCard({ scale, exercise, onGraded, onNewExercise }: {
  scale: UiScale;
  exercise: Exercise;
  onGraded?: () => void;
  onNewExercise?: () => void
}) {
  const { record: recordExerciseAttempt } = useContext(ProgressContext);
  const [answer, setAnswer] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult>();
  const hasRecordedAttempt = useRef(false);

  function submitAnswer() {
    const submittedGrade = submitExerciseAnswer(
      exercise,
      answer,
      hasRecordedAttempt.current,
      (attempt) => {
        recordExerciseAttempt(attempt.scaleId, attempt.correct, attempt.exerciseType);
        onGraded?.();
      }
    );

    if (submittedGrade.graded) hasRecordedAttempt.current = true;

    setGradeResult(submittedGrade);
  }

  return (
    <section className="card exercise" data-scale={scale.id}>
      <p className="eyebrow">Question</p>
      <h2>{exercise.question}</h2>
      {exercise.promptNotes && <p className="notes">{exercise.promptNotes.join(" – ")}</p>}
      {exercise.options ? (
        <fieldset disabled={gradeResult?.graded}>
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
              disabled={gradeResult?.graded}
              onChange={(event) => setAnswer(event.target.value)}
              aria-describedby={`answer-help-${exercise.id}`}
            />
          </label>
          <small id={`answer-help-${exercise.id}`}>Sépare plusieurs notes par « et », des espaces, virgules ou tirets.</small>
        </>
      )}
      {!gradeResult?.graded ? (
        <div className="actions">
          <button className="primary" onClick={submitAnswer}>Valider ma réponse</button>
        </div>
      ) : (
        <div className={gradeResult.correct ? "feedback good" : "feedback bad"} role="status">
          <h3>{gradeResult.correct ? "Bravo, c’est correct !" : "Pas encore."}</h3>
          {gradeResult.errors.map((error, index) => <p key={index}>{error.message}</p>)}
          <p>Bonne réponse : <b>{displayedCorrectAnswer(gradeResult.correctAnswer)}</b></p>
          <p>{gradeResult.explanation}</p>
          <p>Règle à retenir : {gradeResult.rule}</p>
          {onNewExercise && <button onClick={onNewExercise}>Nouvelle tentative</button>}
        </div>
      )}
      {gradeResult?.validationMessage && <p className="feedback bad" role="alert">{gradeResult.validationMessage}</p>}
    </section>
  );
}

export function Daily() {
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

  if (!exercise || !scale) return <Page title="Entraînement quotidien">
    <EmptyDomain />
  </Page>;

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
      <ExerciseCard
        scale={scale}
        exercise={exercise}
        onGraded={() => setHasAnswered(true)}
        key={exercise.id}
      />
      {continuation}
    </Page>
  );
}
