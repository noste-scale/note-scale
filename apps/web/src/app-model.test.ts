import { describe, expect, it, vi } from "vitest";
import { MAJOR_SCALES, createEmptyProgress, createExercise, recordAttempt } from "@notescale/music";
import {
  EXERCISE_TYPES,
  constructionDetails,
  createRegularExercise,
  displayedCorrectAnswer,
  filterScales,
  focusMainContent,
  parseExerciseAnswer,
  pianoLabels,
  randomExerciseTypeIndex,
  requestedScale,
  safeRouteScaleId,
  submitExerciseAnswer,
} from "./app-model";
import { getScale } from "./domain";

describe("web application/domain bridges", () => {
  it("selects every regular exercise kind from bounded injectable randomness", () => {
    expect(randomExerciseTypeIndex(() => 0)).toBe(0);
    expect(randomExerciseTypeIndex(() => .2)).toBe(1);
    expect(randomExerciseTypeIndex(() => .999)).toBe(4);
    expect(randomExerciseTypeIndex(() => Number.NaN)).toBe(0);
  });

  it("grades every displayed correct answer and records each reveal once", () => {
    for (const scale of MAJOR_SCALES) {
      for (const type of EXERCISE_TYPES) {
        const exercise = createExercise(type, scale, () => .67);
        const displayedAnswer = displayedCorrectAnswer(exercise.correctAnswer);
        const recordAnswer = vi.fn();
        const firstGrade = submitExerciseAnswer(exercise, displayedAnswer, false, recordAnswer);
        const repeatedGrade = submitExerciseAnswer(exercise, displayedAnswer, true, recordAnswer);
        expect(firstGrade.correct, `${scale.id}/${type}`).toBe(true);
        expect(repeatedGrade.correct, `${scale.id}/${type}`).toBe(true);
        expect(recordAnswer, `${scale.id}/${type}`).toHaveBeenCalledOnce();
        expect(recordAnswer).toHaveBeenCalledWith({ scaleId: exercise.scaleId, correct: true, exerciseType: type });
      }
    }
  });

  it("creates a different unrevealed exercise even when randomness repeats", () => {
    for (const typeIndex of EXERCISE_TYPES.keys()) {
      const firstSelection = createRegularExercise(typeIndex, undefined, undefined, () => 0);
      const nextSelection = createRegularExercise(typeIndex, firstSelection, undefined, () => 0);
      expect(firstSelection).toBeDefined();
      expect(nextSelection).toBeDefined();
      expect(
        displayedCorrectAnswer(nextSelection!.exercise.correctAnswer),
        EXERCISE_TYPES[typeIndex],
      ).not.toBe(displayedCorrectAnswer(firstSelection!.exercise.correctAnswer));
    }
  });

  it("honors a valid scale query and explicitly rejects invalid input", () => {
    const scaleRequest = requestedScale("F#");
    expect(scaleRequest.scale?.id).toBe("F#");
    expect(createRegularExercise(0, undefined, scaleRequest.scale, () => 0)?.scale.id).toBe("F#");
    expect(requestedScale("H").error).toContain("H");
    expect(requestedScale("").error).toContain("vide");
    expect(requestedScale(null)).toEqual({});
  });

  it("keeps every requested-scale retry on that scale while changing the exercise", () => {
    const requestedMajorScale = requestedScale("F#").scale!;
    for (const typeIndex of EXERCISE_TYPES.keys()) {
      const firstSelection = createRegularExercise(typeIndex, undefined, requestedMajorScale, () => 0);
      const nextSelection = createRegularExercise(typeIndex, firstSelection, requestedMajorScale, () => 0);
      expect(firstSelection?.scale.id).toBe("F#");
      expect(nextSelection?.scale.id).toBe("F#");
      expect(
        JSON.stringify([
          nextSelection?.exercise.type,
          nextSelection?.exercise.question,
          nextSelection?.exercise.promptNotes,
          nextSelection?.exercise.correctAnswer,
        ]),
        EXERCISE_TYPES[typeIndex],
      ).not.toBe(JSON.stringify([
        firstSelection?.exercise.type,
        firstSelection?.exercise.question,
        firstSelection?.exercise.promptNotes,
        firstSelection?.exercise.correctAnswer,
      ]));
    }
  });

  it("parses French separators, Unicode accidentals, and every common dash", () => {
    const exercise = createExercise("find-accidentals", MAJOR_SCALES.find((scale) => scale.id === "D")!, () => 0);
    for (const answer of ["Fa♯ et Do♯", "Fa♯, Do♯", "Fa♯ Do♯", "Fa♯–Do♯", "Fa♯—Do♯", "Fa♯-Do♯"]) {
      expect(parseExerciseAnswer(exercise, answer), answer).toEqual(["Fa♯", "Do♯"]);
      expect(submitExerciseAnswer(exercise, answer, false, () => undefined).correct, answer).toBe(true);
    }
    const flatExercise = createExercise("find-accidentals", MAJOR_SCALES.find((scale) => scale.id === "Eb")!, () => 0);
    expect(submitExerciseAnswer(flatExercise, "Si♭ et Mi♭, La♭", false, () => undefined).correct).toBe(true);
  });

  it("deterministically prioritizes due and error-prone progress when no scale is requested", () => {
    const now = new Date("2026-08-11T10:20:00.000Z");
    const incorrectProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "Eb", correct: false },
      new Date("2026-08-11T10:00:00.000Z"),
      () => 0,
    );
    expect(createRegularExercise(0, undefined, undefined, () => 0, incorrectProgress, now)?.scale.id).toBe("Eb");
    const unscheduledProgress = { ...incorrectProgress, reviews: {} };
    expect(createRegularExercise(0, undefined, undefined, () => 0, unscheduledProgress, now)?.scale.id).toBe("Eb");

    const futureReviewProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: true },
      now,
      () => 0,
    );
    expect(createRegularExercise(0, undefined, undefined, () => .999, futureReviewProgress, now)?.scale.id).not.toBe("C");
  });

  it("handles empty searches and malformed encoded route ids without throwing", () => {
    expect(filterScales("aucune-tonalité")).toEqual([]);
    expect(safeRouteScaleId("%E0%A4%A")).toBeNull();
    expect(safeRouteScaleId("F%23")).toBe("F#");
  });

  it("focuses main content without changing a HashRouter URL", () => {
    const focus = vi.fn();
    expect(focusMainContent({ getElementById: (id) => id === "contenu" ? { focus } : null })).toBe(true);
    expect(focus).toHaveBeenCalledOnce();
    expect(focusMainContent({ getElementById: () => null })).toBe(false);
  });

  it("uses canonical flat black-key labels on flat scales", () => {
    const flatScale = getScale("Db");
    const sharpScale = getScale("C#");
    expect(flatScale).toBeDefined();
    expect(sharpScale).toBeDefined();
    expect(pianoLabels(flatScale!.notes)[1]).toBe("Ré♭");
    expect(pianoLabels(flatScale!.notes)[10]).toBe("Si♭");
    expect(pianoLabels(sharpScale!.notes)[1]).toBe("Do♯");
  });

  it("projects every generator field from construction data", () => {
    expect(constructionDetails("D", 1)).toEqual({
      currentNote: "Ré",
      interval: "ton",
      expectedNatural: "Mi",
      requiredAccidental: "aucune",
      nextNote: "Mi",
      explanation: expect.stringContaining("Depuis Ré"),
    });
    expect(constructionDetails("D", 2)).toMatchObject({
      currentNote: "Mi",
      expectedNatural: "Fa",
      requiredAccidental: "dièse",
      nextNote: "Fa♯",
    });
    expect(constructionDetails("D", 0)).toBeUndefined();
  });
});
