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
        const displayed = displayedCorrectAnswer(exercise.correctAnswer);
        const record = vi.fn();
        const first = submitExerciseAnswer(exercise, displayed, false, record);
        const duplicate = submitExerciseAnswer(exercise, displayed, true, record);
        expect(first.correct, `${scale.id}/${type}`).toBe(true);
        expect(duplicate.correct, `${scale.id}/${type}`).toBe(true);
        expect(record, `${scale.id}/${type}`).toHaveBeenCalledOnce();
        expect(record).toHaveBeenCalledWith({ scaleId: exercise.scaleId, correct: true, exerciseType: type });
      }
    }
  });

  it("creates a different unrevealed exercise even when randomness repeats", () => {
    for (const type of EXERCISE_TYPES.keys()) {
      const first = createRegularExercise(type, undefined, undefined, () => 0);
      const next = createRegularExercise(type, first, undefined, () => 0);
      expect(first).toBeDefined();
      expect(next).toBeDefined();
      expect(displayedCorrectAnswer(next!.exercise.correctAnswer), EXERCISE_TYPES[type]).not.toBe(displayedCorrectAnswer(first!.exercise.correctAnswer));
    }
  });

  it("honors a valid scale query and explicitly rejects invalid input", () => {
    const requested = requestedScale("F#");
    expect(requested.scale?.id).toBe("F#");
    expect(createRegularExercise(0, undefined, requested.scale, () => 0)?.scale.id).toBe("F#");
    expect(requestedScale("H").error).toContain("H");
    expect(requestedScale("").error).toContain("vide");
    expect(requestedScale(null)).toEqual({});
  });

  it("keeps every requested-scale retry on that scale while changing the exercise", () => {
    const requested = requestedScale("F#").scale!;
    for (const type of EXERCISE_TYPES.keys()) {
      const first = createRegularExercise(type, undefined, requested, () => 0);
      const next = createRegularExercise(type, first, requested, () => 0);
      expect(first?.scale.id).toBe("F#");
      expect(next?.scale.id).toBe("F#");
      expect(
        JSON.stringify([next?.exercise.type, next?.exercise.question, next?.exercise.promptNotes, next?.exercise.correctAnswer]),
        EXERCISE_TYPES[type],
      ).not.toBe(JSON.stringify([first?.exercise.type, first?.exercise.question, first?.exercise.promptNotes, first?.exercise.correctAnswer]));
    }
  });

  it("parses French separators, Unicode accidentals, and every common dash", () => {
    const exercise = createExercise("find-accidentals", MAJOR_SCALES.find((scale) => scale.id === "D")!, () => 0);
    for (const answer of ["Fa♯ et Do♯", "Fa♯, Do♯", "Fa♯ Do♯", "Fa♯–Do♯", "Fa♯—Do♯", "Fa♯-Do♯"]) {
      expect(parseExerciseAnswer(exercise, answer), answer).toEqual(["Fa♯", "Do♯"]);
      expect(submitExerciseAnswer(exercise, answer, false, () => undefined).correct, answer).toBe(true);
    }
    const flats = createExercise("find-accidentals", MAJOR_SCALES.find((scale) => scale.id === "Eb")!, () => 0);
    expect(submitExerciseAnswer(flats, "Si♭ et Mi♭, La♭", false, () => undefined).correct).toBe(true);
  });

  it("deterministically prioritizes due and error-prone progress when no scale is requested", () => {
    const now = new Date("2026-08-11T10:20:00.000Z");
    const wrong = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "Eb", correct: false },
      new Date("2026-08-11T10:00:00.000Z"),
      () => 0,
    );
    expect(createRegularExercise(0, undefined, undefined, () => 0, wrong, now)?.scale.id).toBe("Eb");
    const unscheduled = { ...wrong, reviews: {} };
    expect(createRegularExercise(0, undefined, undefined, () => 0, unscheduled, now)?.scale.id).toBe("Eb");

    const future = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: true },
      now,
      () => 0,
    );
    expect(createRegularExercise(0, undefined, undefined, () => .999, future, now)?.scale.id).not.toBe("C");
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
    const flat = getScale("Db"); const sharp = getScale("C#");
    expect(flat).toBeDefined(); expect(sharp).toBeDefined();
    expect(pianoLabels(flat!.notes)[1]).toBe("Ré♭");
    expect(pianoLabels(flat!.notes)[10]).toBe("Si♭");
    expect(pianoLabels(sharp!.notes)[1]).toBe("Do♯");
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
