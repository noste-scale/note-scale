import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { isTonicId, type GradeResult } from "@notescale/music";
import {
  Action,
  Body,
  Card,
  Chip,
  Formula,
  Heading,
  Notice,
  Row,
  Screen
} from "../../src/components";
import {
  displayGradeAnswer,
  gradeSelection,
  makeDailyExercises,
  makeExercise,
  type ExerciseView
} from "../../src/domain";
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

type ChipRole = "radio" | "checkbox" | "button";

function chooseChipRole(selectionMode: ExerciseView["selectionMode"]): ChipRole {
  if (selectionMode === "single") return "radio";
  if (selectionMode === "multiple") return "checkbox";

  return "button";
}

function describeSubtitle({ isDailySession, exerciseIndex, dailyExerciseCount, isScopedToScale }: {
  isDailySession: boolean;
  exerciseIndex: number;
  dailyExerciseCount: number;
  isScopedToScale: boolean;
}): string {
  if (isDailySession) return `Question ${exerciseIndex + 1} sur ${dailyExerciseCount} · environ 3 à 5 minutes`;
  if (isScopedToScale) return "Tous les prochains exercices restent liés à cette gamme.";

  return "Propose une réponse avant de voir la correction.";
}

function describeValidationHint(hydrated: boolean, selectedAnswerCount: number): string {
  if (!hydrated) return "Attends le chargement de ta progression";
  if (selectedAnswerCount === 0) return "Choisis d’abord une réponse";

  return "Affiche ensuite la correction";
}

function describeAnswerFeedback(exercise: ExerciseView, grade: GradeResult, selectedAnswerLabels: readonly string[]): string {
  if (grade.correct) return "Bonne réponse. ";

  return `À corriger : tu as choisi « ${selectedAnswerLabels.join(" – ")} ». La réponse attendue est « ${displayGradeAnswer(grade.correctAnswer, exercise.kind)} ». `;
}

function describeCorrection(grade: GradeResult): string {
  const errorMessages = grade.errors.map((error) => error.message).join(" ");
  const errorSeparator = grade.errors.length ? " " : "";

  return `${errorMessages}${errorSeparator}${grade.explanation}\nRègle à retenir : ${grade.rule}`;
}

function AnswerChoices({ exercise, selectedAnswerLabels, disabled, onSelect }: {
  exercise: ExerciseView;
  selectedAnswerLabels: readonly string[];
  disabled: boolean;
  onSelect: (option: string) => void;
}) {
  const chipRole = chooseChipRole(exercise.selectionMode);

  return (
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
            disabled={disabled}
            onPress={() => onSelect(option)}
          />
        ))}
      </Row>
    </View>
  );
}

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
    () => isDailySession ? dailyExercises[exerciseIndex] : makeExercise({
      generation: exerciseIndex,
      preferredScaleId: scopedScaleId,
      progress
    }),
    [isDailySession, dailyExercises, hydrated, exerciseIndex, scopedScaleId],
  );
  const currentResponse = responseForExercise(response, exercise?.id ?? "");
  const selectedAnswerLabels = currentResponse.selected;
  const grade = currentResponse.grade;
  const isSubmitted = grade?.graded === true;

  const clearResponse = (exerciseId?: string) => {
    setResponse(createEmptyResponse(exerciseId));
    lastRecordedExerciseId.current = undefined;
  };

  useEffect(() => {
    clearResponse(exercise?.id);
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
    setResponse({
      exerciseId: exercise.id,
      selected: selectedAnswerLabels,
      grade: gradeResult
    });
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

    clearResponse();
  };

  const startDailySession = () => {
    if (!hydrated) return;

    setDailyExercises(makeDailyExercises(progress));
    setDailySession(true);
    setExerciseIndex(0);
    clearResponse();
  };

  const answerLabel = exercise?.selectionMode === "ordered" ? "Ta réponse ordonnée" : "Ta sélection";
  const subtitle = describeSubtitle({
    isDailySession,
    exerciseIndex,
    dailyExerciseCount: dailyExercises.length,
    isScopedToScale: Boolean(scopedScaleId),
  });
  const isLastDailyExercise = isDailySession && exerciseIndex === dailyExercises.length - 1;

  return (
    <Screen
      title={isDailySession ? "Entraînement quotidien" : "Exercices"}
      subtitle={subtitle}
    >
      {warning
        ? <Notice danger>{warning}</Notice>
        : null}
      {!hydrated
        ? <Notice>Chargement de ta progression : la validation sera disponible ensuite.</Notice>
        : null}
      {!isDailySession
        ? <Action
          label="Lancer la session quotidienne"
          onPress={startDailySession}
          disabled={!hydrated}
        />
        : null}
      {isDailySession ? <Card>
        <Heading>Rappel</Heading>
        <Formula />
      </Card> : null}
      {exercise ? (
        <Card>
          <Body muted>Type : {exerciseTypeLabels[exercise.kind]}</Body>
          <Heading>{exercise.question}</Heading>
          <AnswerChoices
            exercise={exercise}
            selectedAnswerLabels={selectedAnswerLabels}
            disabled={isSubmitted}
            onSelect={selectAnswer}
          />
          {selectedAnswerLabels.length
            ? <Body live>{answerLabel} : {selectedAnswerLabels.join(" – ")}</Body>
            : <Body muted>{exercise.selectionMode === "ordered"
              ? "Choisis les notes une à une, dans l’ordre."
              : "Aucun choix pour le moment."}</Body>}
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
            hint={describeValidationHint(hydrated, selectedAnswerLabels.length)}
          /> : null}
          {grade && !grade.graded
            ? <Notice danger>{grade.validationMessage ?? "Propose une réponse avant de valider."}</Notice>
            : null}
          {isSubmitted && grade ? (
            <Notice danger={!grade.correct}>
              {describeAnswerFeedback(exercise, grade, selectedAnswerLabels)}
              {describeCorrection(grade)}
            </Notice>
          ) : null}
          {isSubmitted ? <Action
            label={isLastDailyExercise ? "Terminer la session" : "Question suivante"}
            onPress={advanceExercise}
          /> : null}
        </Card>
      ) : <Card>
        <Body>Les exercices seront disponibles dès que le catalogue musical sera chargé.</Body>
      </Card>}
    </Screen>
  );
}
