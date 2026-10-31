import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { isTonicId, type GradeResult } from "@notescale/music";
import { Action, Body, Card, Chip, Formula, Heading, Notice, Row, Screen } from "../../src/components";
import { displayGradeAnswer, gradeSelection, makeDailyExercises, makeExercise, type ExerciseView } from "../../src/domain";
import {
  attemptRecordingDecision,
  responseForExercise,
  routeValue,
  updateSelection,
  type ExerciseResponse,
} from "../../src/exercise-state";
import { useProgress } from "../../src/progress";

const exerciseTypeLabels: Record<ExerciseView["kind"], string> = {
  "complete-scale": "Compléter une gamme",
  "build-scale": "Construire une gamme",
  "find-accidentals": "Identifier les altérations",
  "identify-interval": "Reconnaître un intervalle",
  "find-error": "Trouver l’erreur",
};

const createEmptyResponse = (exerciseId = ""): ExerciseResponse<GradeResult> => ({ exerciseId, selected: [] });

export default function ExercisesScreen() {
  const params = useLocalSearchParams<{ scaleId?: string | string[] }>();
  const routeScaleId = routeValue(params.scaleId);
  const scopedScaleId = routeScaleId && isTonicId(routeScaleId) ? routeScaleId : undefined;
  const { progress, hydrated, recordAttempt, warning } = useProgress();
  const [isDailySession, setDailySession] = useState(false);
  const [dailyExercises, setDailyExercises] = useState<ExerciseView[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [response, setResponse] = useState<ExerciseResponse<GradeResult>>(() => createEmptyResponse());
  const lastRecordedExerciseId = useRef<string | undefined>(undefined);
  const exercise = useMemo(
    // ponytail: sample progress only when hydration/generation changes so recording cannot replace the exercise being graded.
    () => isDailySession ? dailyExercises[exerciseIndex] : makeExercise({ generation: exerciseIndex, preferredScaleId: scopedScaleId, progress }),
    [isDailySession, dailyExercises, hydrated, exerciseIndex, scopedScaleId],
  );
  const currentResponse = responseForExercise(response, exercise?.id ?? "");
  const selectedAnswerLabels = currentResponse.selected;
  const grade = currentResponse.grade;
  const isSubmitted = grade?.graded === true;

  useEffect(() => {
    setResponse(createEmptyResponse(exercise?.id));
    lastRecordedExerciseId.current = undefined;
  }, [isDailySession, exercise?.id, scopedScaleId]);

  const selectAnswer = (option: string) => {
    if (!exercise || isSubmitted) return;
    setResponse((previousResponse) => {
      const activeResponse = responseForExercise(previousResponse, exercise.id);
      return {
        exerciseId: exercise.id,
        selected: updateSelection(
          exercise.selectionMode,
          activeResponse.selected,
          option,
          exercise.maximumSelections,
          exercise.noneOption,
        ),
      };
    });
  };

  const submitAnswer = () => {
    if (!hydrated || !exercise || selectedAnswerLabels.length === 0) return;
    const gradeResult = gradeSelection(exercise, selectedAnswerLabels);
    setResponse({ exerciseId: exercise.id, selected: selectedAnswerLabels, grade: gradeResult });
    const recording = attemptRecordingDecision(lastRecordedExerciseId.current, exercise.id, gradeResult.graded);
    lastRecordedExerciseId.current = recording.lastRecordedExerciseId;
    if (recording.record) {
      recordAttempt(exercise.scaleId, gradeResult.correct, exercise.kind);
    }
  };

  const advanceExercise = () => {
    if (isDailySession && exerciseIndex >= dailyExercises.length - 1) {
      setDailySession(false);
      setExerciseIndex(0);
    } else {
      setExerciseIndex((previousIndex) => previousIndex + 1);
    }
    setResponse(createEmptyResponse());
    lastRecordedExerciseId.current = undefined;
  };

  const startDailySession = () => {
    if (!hydrated) return;
    setDailyExercises(makeDailyExercises(progress));
    setDailySession(true);
    setExerciseIndex(0);
    setResponse(createEmptyResponse());
    lastRecordedExerciseId.current = undefined;
  };

  const answerLabel = exercise?.selectionMode === "ordered" ? "Ta réponse ordonnée" : "Ta sélection";
  let chipRole: "radio" | "checkbox" | "button" = "button";
  if (exercise?.selectionMode === "single") chipRole = "radio";
  else if (exercise?.selectionMode === "multiple") chipRole = "checkbox";

  let subtitle = "Propose une réponse avant de voir la correction.";
  if (isDailySession) {
    subtitle = `Question ${exerciseIndex + 1} sur ${dailyExercises.length} · environ 3 à 5 minutes`;
  } else if (scopedScaleId) {
    subtitle = "Tous les prochains exercices restent liés à cette gamme.";
  }

  let validationHint = "Affiche ensuite la correction";
  if (!hydrated) validationHint = "Attends le chargement de ta progression";
  else if (selectedAnswerLabels.length === 0) validationHint = "Choisis d’abord une réponse";

  let answerFeedback = "";
  let correctionFeedback = "";
  if (exercise && isSubmitted && grade) {
    answerFeedback = grade.correct
      ? "Bonne réponse. "
      : `À corriger : tu as choisi « ${selectedAnswerLabels.join(" – ")} ». La réponse attendue est « ${displayGradeAnswer(grade.correctAnswer, exercise.kind)} ». `;
    const errorMessages = grade.errors.map((error) => error.message).join(" ");
    const errorSeparator = grade.errors.length ? " " : "";
    correctionFeedback = `${errorMessages}${errorSeparator}${grade.explanation}\nRègle à retenir : ${grade.rule}`;
  }

  return (
    <Screen
      title={isDailySession ? "Entraînement quotidien" : "Exercices"}
      subtitle={subtitle}
    >
      {warning ? <Notice danger>{warning}</Notice> : null}
      {!hydrated ? <Notice>Chargement de ta progression : la validation sera disponible ensuite.</Notice> : null}
      {!isDailySession ? <Action label="Lancer la session quotidienne" onPress={startDailySession} disabled={!hydrated} /> : null}
      {isDailySession ? <Card>
        <Heading>Rappel</Heading>
        <Formula />
      </Card> : null}
      {exercise ? (
        <Card>
          <Body muted>Type : {exerciseTypeLabels[exercise.kind]}</Body>
          <Heading>{exercise.question}</Heading>
          <View
            accessibilityLabel="Choix de réponse"
            {...(chipRole === "radio" ? { accessibilityRole: "radiogroup" as const } : {})}
          >
            <Row>
              {exercise.options.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  role={chipRole}
                  selected={exercise.selectionMode !== "ordered" && selectedAnswerLabels.includes(option)}
                  disabled={isSubmitted}
                  onPress={() => selectAnswer(option)}
                />
              ))}
            </Row>
          </View>
          {selectedAnswerLabels.length ? <Body live>{answerLabel} : {selectedAnswerLabels.join(" – ")}</Body> : <Body muted>{exercise.selectionMode === "ordered" ? "Choisis les notes une à une, dans l’ordre." : "Aucun choix pour le moment."}</Body>}
          {!isSubmitted && selectedAnswerLabels.length ? (
            <Row>
              {exercise.selectionMode === "ordered" ? <Action
                label="Annuler la dernière note"
                onPress={() => setResponse({ exerciseId: exercise.id, selected: selectedAnswerLabels.slice(0, -1) })}
              /> : null}
              <Action label="Effacer ma réponse" onPress={() => setResponse(createEmptyResponse(exercise.id))} />
            </Row>
          ) : null}
          {!isSubmitted ? <Action
            label="Valider ma réponse"
            onPress={submitAnswer}
            disabled={!hydrated || selectedAnswerLabels.length === 0}
            hint={validationHint}
          /> : null}
          {grade && !grade.graded ? <Notice danger>{grade.validationMessage ?? "Propose une réponse avant de valider."}</Notice> : null}
          {isSubmitted && grade ? (
            <Notice danger={!grade.correct}>
              {answerFeedback}{correctionFeedback}
            </Notice>
          ) : null}
          {isSubmitted ? <Action
            label={isDailySession && exerciseIndex === dailyExercises.length - 1 ? "Terminer la session" : "Question suivante"}
            onPress={advanceExercise}
          /> : null}
        </Card>
      ) : <Card>
        <Body>Les exercices seront disponibles dès que le catalogue musical sera chargé.</Body>
      </Card>}
    </Screen>
  );
}
