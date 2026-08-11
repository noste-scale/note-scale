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

const kindLabels: Record<ExerciseView["kind"], string> = {
  "complete-scale": "Compléter une gamme",
  "build-scale": "Construire une gamme",
  "find-accidentals": "Identifier les altérations",
  "identify-interval": "Reconnaître un intervalle",
  "find-error": "Trouver l’erreur",
};

const emptyResponse = (exerciseId = ""): ExerciseResponse<GradeResult> => ({ exerciseId, selected: [] });

export default function ExercisesScreen() {
  const params = useLocalSearchParams<{ scaleId?: string | string[] }>();
  const routeScaleId = routeValue(params.scaleId);
  const scopedScaleId = routeScaleId && isTonicId(routeScaleId) ? routeScaleId : undefined;
  const { progress, hydrated, recordAttempt, warning } = useProgress();
  const [daily, setDaily] = useState(false);
  const [dailyExercises, setDailyExercises] = useState<ExerciseView[]>([]);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<ExerciseResponse<GradeResult>>(() => emptyResponse());
  const recordedExercise = useRef<string | undefined>(undefined);
  const exercise = useMemo(
    // ponytail: sample progress only when hydration/generation changes so recording cannot replace the exercise being graded.
    () => daily ? dailyExercises[index] : makeExercise(index, scopedScaleId, Math.random, progress),
    [daily, dailyExercises, hydrated, index, scopedScaleId],
  );
  const currentResponse = responseForExercise(response, exercise?.id ?? "");
  const selected = currentResponse.selected;
  const grade = currentResponse.grade;
  const submitted = grade?.graded === true;

  useEffect(() => {
    setResponse(emptyResponse(exercise?.id));
    recordedExercise.current = undefined;
  }, [daily, exercise?.id, scopedScaleId]);

  const choose = (option: string) => {
    if (!exercise || submitted) return;
    setResponse((current) => {
      const active = responseForExercise(current, exercise.id);
      return {
        exerciseId: exercise.id,
        selected: updateSelection(
          exercise.selectionMode,
          active.selected,
          option,
          exercise.maximumSelections,
          exercise.noneOption,
        ),
      };
    });
  };

  const submit = () => {
    if (!hydrated || !exercise || selected.length === 0) return;
    const result = gradeSelection(exercise, selected);
    setResponse({ exerciseId: exercise.id, selected, grade: result });
    const recording = attemptRecordingDecision(recordedExercise.current, exercise.id, result.graded);
    recordedExercise.current = recording.lastRecordedExerciseId;
    if (recording.record) {
      recordAttempt(exercise.scaleId, result.correct, exercise.kind);
    }
  };

  const next = () => {
    if (daily && index >= dailyExercises.length - 1) {
      setDaily(false);
      setIndex(0);
    } else {
      setIndex((value) => value + 1);
    }
    setResponse(emptyResponse());
    recordedExercise.current = undefined;
  };

  const startDaily = () => {
    if (!hydrated) return;
    setDailyExercises(makeDailyExercises(progress));
    setDaily(true);
    setIndex(0);
    setResponse(emptyResponse());
    recordedExercise.current = undefined;
  };

  const answerLabel = exercise?.selectionMode === "ordered" ? "Ta réponse ordonnée" : "Ta sélection";
  const chipRole = exercise?.selectionMode === "single" ? "radio" : exercise?.selectionMode === "multiple" ? "checkbox" : "button";

  return (
    <Screen title={daily ? "Entraînement quotidien" : "Exercices"} subtitle={daily ? `Question ${index + 1} sur ${dailyExercises.length} · environ 3 à 5 minutes` : scopedScaleId ? "Tous les prochains exercices restent liés à cette gamme." : "Propose une réponse avant de voir la correction."}>
      {warning ? <Notice danger>{warning}</Notice> : null}
      {!hydrated ? <Notice>Chargement de ta progression : la validation sera disponible ensuite.</Notice> : null}
      {!daily ? <Action label="Lancer la session quotidienne" onPress={startDaily} disabled={!hydrated} /> : null}
      {daily ? <Card><Heading>Rappel</Heading><Formula /></Card> : null}
      {exercise ? (
        <Card>
          <Body muted>Type : {kindLabels[exercise.kind]}</Body>
          <Heading>{exercise.question}</Heading>
          <View
            accessibilityLabel="Choix de réponse"
            {...(chipRole === "radio" ? { accessibilityRole: "radiogroup" as const } : {})}
          >
            <Row>{exercise.options.map((option) => (
              <Chip
                key={option}
                label={option}
                role={chipRole}
                selected={exercise.selectionMode !== "ordered" && selected.includes(option)}
                disabled={submitted}
                onPress={() => choose(option)}
              />
            ))}</Row>
          </View>
          {selected.length ? <Body live>{answerLabel} : {selected.join(" – ")}</Body> : <Body muted>{exercise.selectionMode === "ordered" ? "Choisis les notes une à une, dans l’ordre." : "Aucun choix pour le moment."}</Body>}
          {!submitted && selected.length ? (
            <Row>
              {exercise.selectionMode === "ordered" ? <Action label="Annuler la dernière note" onPress={() => setResponse({ exerciseId: exercise.id, selected: selected.slice(0, -1) })} /> : null}
              <Action label="Effacer ma réponse" onPress={() => setResponse(emptyResponse(exercise.id))} />
            </Row>
          ) : null}
          {!submitted ? <Action label="Valider ma réponse" onPress={submit} disabled={!hydrated || selected.length === 0} hint={!hydrated ? "Attends le chargement de ta progression" : selected.length === 0 ? "Choisis d’abord une réponse" : "Affiche ensuite la correction"} /> : null}
          {grade && !grade.graded ? <Notice danger>{grade.validationMessage ?? "Propose une réponse avant de valider."}</Notice> : null}
          {submitted && grade ? (
            <Notice danger={!grade.correct}>
              {grade.correct ? "Bonne réponse. " : `À corriger : tu as choisi « ${selected.join(" – ")} ». La réponse attendue est « ${displayGradeAnswer(grade.correctAnswer, exercise.kind)} ». `}
              {grade.errors.map((error) => error.message).join(" ")}{grade.errors.length ? " " : ""}{grade.explanation}{"\n"}Règle à retenir : {grade.rule}
            </Notice>
          ) : null}
          {submitted ? <Action label={daily && index === dailyExercises.length - 1 ? "Terminer la session" : "Question suivante"} onPress={next} /> : null}
        </Card>
      ) : <Card><Body>Les exercices seront disponibles dès que le catalogue musical sera chargé.</Body></Card>}
    </Screen>
  );
}
