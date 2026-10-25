import { describe, expect, it } from "vitest";
import {
  createDailySession,
  createEmptyProgress,
  createExercise,
  formatNote,
  generateExercise,
  getMajorScale,
  gradeExercise,
  localDateKey,
  recordAttempt,
  type ExerciseType,
} from "../src";

function createSequenceRandom(values: readonly number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe("exercise generation and grading", () => {
  const types: readonly ExerciseType[] = [
    "complete-scale",
    "build-scale",
    "find-accidentals",
    "identify-interval",
    "find-error",
  ];

  it("creates all five exercise kinds without revealing answers in the question", () => {
    for (const type of types) {
      const exercise = createExercise(type, getMajorScale("D"), () => 0.25);
      expect(exercise.type).toBe(type);
      expect(exercise.correctAnswer.length).toBeGreaterThan(0);
      expect(exercise.question).not.toContain(exercise.correctAnswer.join(" – "));
    }
  });

  it.each(["C", "E", "Bb"] as const)("renders two answer-matched blanks for %s major", (scaleId) => {
    const scale = getMajorScale(scaleId);
    const exercise = createExercise("complete-scale", scale, createSequenceRandom([0.1, 0.8, 0.3]));
    const blankIndexes = exercise.promptNotes
      ?.map((note, index) => note === "___" ? index : -1)
      .filter((index) => index >= 0) ?? [];
    expect(blankIndexes).toHaveLength(2);
    expect(exercise.correctAnswer).toEqual(blankIndexes.map((index) => scale.notes[index]));
  });

  it.each(["C", "E", "Bb"] as const)("renders exactly one mutated note for %s major", (scaleId) => {
    const scale = getMajorScale(scaleId);
    const exercise = createExercise("find-error", scale, createSequenceRandom([0.2, 0.6, 0.4]));
    const expectedNotes = scale.notes.map((note) => formatNote(note));
    const changedIndexes = exercise.promptNotes
      ?.map((note, index) => note !== expectedNotes[index] ? index : -1)
      .filter((index) => index >= 0) ?? [];
    expect(changedIndexes).toHaveLength(1);
    expect(exercise.correctAnswer).toEqual([scale.notes[changedIndexes[0]!]]);
  });

  it("grades ordered answers per position and rejects enharmonic substitutions", () => {
    const exercise = createExercise("build-scale", getMajorScale("F#"), () => 0);
    const correctGrade = gradeExercise(exercise, [...exercise.correctAnswer]);
    expect(correctGrade).toMatchObject({ graded: true, correct: true, errors: [] });

    const enharmonicAnswer = [...exercise.correctAnswer];
    enharmonicAnswer[6] = "F";
    const incorrectGrade = gradeExercise(exercise, enharmonicAnswer);
    expect(incorrectGrade.correct).toBe(false);
    expect(incorrectGrade.errors).toEqual([expect.objectContaining({ index: 6, expected: "E#", actual: "F" })]);
  });

  it("grades accidental sets without requiring order", () => {
    const exercise = createExercise("find-accidentals", getMajorScale("E"), () => 0);
    expect(gradeExercise(exercise, ["D#", "G#", "C#", "F#"]).correct).toBe(true);
    expect(gradeExercise(exercise, ["D#", "G#", "C#", "Gb"]).errors.length).toBeGreaterThan(0);
    const noAccidentals = createExercise("find-accidentals", getMajorScale("C"), () => 0);
    expect(noAccidentals.correctAnswer).toEqual(["aucune"]);
    expect(gradeExercise(noAccidentals, ["Aucune"]).correct).toBe(true);
  });

  it("leaves empty or malformed answers ungraded with accessible French validation", () => {
    const exercise = createExercise("identify-interval", getMajorScale("C"), () => 0);
    expect(gradeExercise(exercise, [])).toMatchObject({
      graded: false,
      correct: false,
      validationMessage: "Propose une réponse avant de valider.",
    });
    expect(gradeExercise(exercise, [42])).toMatchObject({ graded: false, correct: false });
  });

  it("is deterministic with an injected random source", () => {
    const firstExercise = generateExercise(createSequenceRandom([0.21, 0.41, 0.61]));
    const secondExercise = generateExercise(createSequenceRandom([0.21, 0.41, 0.61]));
    expect(firstExercise).toEqual(secondExercise);
  });

  it("builds a daily session with three distinct scales and prioritizes a wrong due scale", () => {
    const now = new Date("2026-08-11T10:00:00.000Z");
    const progress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "Eb", correct: false },
      new Date(now.getTime() - 20 * 60_000),
    );
    const session = createDailySession(progress, createSequenceRandom([0.8, 0.2, 0.6, 0.4, 0.1]), now);
    const scaleIds = session.scaleExercises.map((exercise) => exercise.scaleId);
    expect(scaleIds[0]).toBe("Eb");
    expect(new Set(scaleIds).size).toBe(3);
    expect(session.naturalSemitoneQuestion.correctAnswer).toEqual(["demi-ton"]);
  });

  it("identifies daily sessions by the injected local calendar day", () => {
    const now = new Date(2026, 7, 11, 0, 1);
    const session = createDailySession(createEmptyProgress(), () => 0, now);
    expect(session.id).toBe(`daily-${localDateKey(now)}`);
  });
});
