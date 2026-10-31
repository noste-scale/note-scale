import { describe, expect, it } from "vitest";
import {
  chooseTrainingTypeIndex,
  createEmptyProgress,
  createMobileTrainingExercise,
  createWebTrainingExercise,
  MAJOR_SCALES,
  recordAttempt,
  selectMobileTrainingScale,
  TRAINING_EXERCISE_TYPES,
  type TrainingSelection,
} from "../src/index";

const now = new Date("2026-10-31T12:00:00Z");
const progress = createEmptyProgress();
const randomValues = [.18, .83, .46, .71, .02, .97, .35];

function createSequenceRandom(values: readonly number[]) {
  let callCount = 0;
  return { rng: () => values[callCount++ % values.length] ?? 0, calls: () => callCount };
}

function trainingSignature(selection: TrainingSelection | undefined): string {
  const exercise = selection?.exercise;
  return [selection?.scale.id, exercise?.type, exercise?.id, exercise?.promptNotes?.join("/"), exercise?.correctAnswer.join("/")].join(";");
}

describe("framework-free training policies", () => {
  // Golden signatures captured from d4b7e79ee7c1d96d75fd59452928b028f1545f2b, before extraction.
  it("preserves nonconstant web RNG order and scoped retry/fallback outputs for every kind", () => {
    const preferredScale = MAJOR_SCALES.find((scale) => scale.id === "F#")!;
    for (const [exerciseTypeIndex, firstSignature, nextSignature, calls] of [
      [0, "F#;complete-scale;complete-scale-F#-460000;Fa♯/___/La♯/Si/Do♯/Ré♯/___/Fa♯;G#/E#", "F#;complete-scale;complete-scale-F#-0;Fa♯/___/La♯/Si/___/Ré♯/Mi♯/Fa♯;G#/C#", 3],
      [1, "F#;build-scale;build-scale-F#-180000;;F#/G#/A#/B/C#/D#/E#/F#", "F#;complete-scale;complete-scale-F#-0;Fa♯/___/La♯/Si/___/Ré♯/Mi♯/Fa♯;G#/C#", 1],
      [2, "F#;find-accidentals;find-accidentals-F#-180000;;F#/C#/G#/D#/A#/E#", "F#;complete-scale;complete-scale-F#-0;Fa♯/___/La♯/Si/___/Ré♯/Mi♯/Fa♯;G#/C#", 1],
      [3, "F#;identify-interval;identify-interval-EF-830000;;demi-ton", "F#;identify-interval;identify-interval-CD-670000;;ton", 2],
      [4, "F#;find-error;find-error-F#-460000;Fa♯/Sol♯/La♯/Si/Do♯/Ré♯/Mi/Fa♯;E#", "F#;find-error;find-error-F#-0;Fa♯/Sol/La♯/Si/Do♯/Ré♯/Mi♯/Fa♯;G#", 3],
    ] as const) {
      const firstRandom = createSequenceRandom(randomValues);
      const nextRandom = createSequenceRandom(randomValues);
      const options = { exerciseTypeIndex, preferredScale, progress, now };
      const first = createWebTrainingExercise({ ...options, rng: firstRandom.rng });
      const next = createWebTrainingExercise({ ...options, previousSelection: first, rng: nextRandom.rng });
      expect(trainingSignature(first)).toBe(firstSignature);
      expect(trainingSignature(next)).toBe(nextSignature);
      expect([firstRandom.calls(), nextRandom.calls()]).toEqual([calls, calls]);
    }
  });

  it("preserves nonconstant web RNG order through ranking, selection, generation and retry", () => {
    const random = createSequenceRandom(randomValues);
    const options = { exerciseTypeIndex: 0, progress, now, rng: random.rng };
    const first = createWebTrainingExercise(options);
    const next = createWebTrainingExercise({ ...options, previousSelection: first });
    expect(trainingSignature(first)).toBe("A;complete-scale;complete-scale-A-20000;La/Si/___/Ré/Mi/Fa♯/___/La;C#/G#");
    expect(trainingSignature(next)).toBe("D;complete-scale;complete-scale-D-460000;Ré/___/Fa♯/Sol/La/Si/___/Ré;E/C#");
    expect(random.calls()).toBe(38);
  });

  it("preserves nonconstant mobile RNG order and domain variants for every kind", () => {
    for (const [index, expectedSignature, expectedCalls] of [
      [0, "F#;complete-scale;complete-scale-F#-460000;Fa♯/___/La♯/Si/Do♯/Ré♯/___/Fa♯;G#/E#", 4],
      [1, "F#;build-scale;build-scale-F#-180000;;F#/G#/A#/B/C#/D#/E#/F#", 2],
      [2, "F#;find-accidentals;find-accidentals-F#-180000;;F#/C#/G#/D#/A#/E#", 2],
      [3, "F#;identify-interval;identify-interval-EF-830000;;demi-ton", 3],
      [4, "F#;find-error;find-error-F#-460000;Fa♯/Sol♯/La♯/Si/Do♯/Ré♯/Mi/Fa♯;E#", 4],
    ] as const) {
      const random = createSequenceRandom([(index + .1) / 5, ...randomValues]);
      const selection = createMobileTrainingExercise({ generation: 0, preferredScaleId: "F#", progress, now, rng: random.rng });
      expect(trainingSignature(selection)).toBe(expectedSignature);
      expect(random.calls()).toBe(expectedCalls);
    }
  });

  it("keeps every web fixed-scale retry scoped while changing its answer", () => {
    for (const preferredScale of MAJOR_SCALES) {
      for (const exerciseTypeIndex of TRAINING_EXERCISE_TYPES.keys()) {
        const options = { exerciseTypeIndex, preferredScale, progress, rng: () => 0, now };
        const first = createWebTrainingExercise(options);
        const next = createWebTrainingExercise({ ...options, previousSelection: first });
        expect(first?.scale.id).toBe(preferredScale.id);
        expect(next?.scale.id).toBe(preferredScale.id);
        expect(next?.exercise.correctAnswer).not.toEqual(first?.exercise.correctAnswer);
      }
    }
  });

  it("preserves web due priority, weighted selection and exact external RNG consumption", () => {
    const dueProgress = recordAttempt(progress, { exerciseType: "find-error", scaleId: "Eb", correct: false }, new Date("2026-10-30T12:00:00Z"), () => 0);
    let calls = 0;
    const rng = () => { calls += 1; return 0; };
    const first = createWebTrainingExercise({ exerciseTypeIndex: 0, progress: dueProgress, rng, now });
    expect(first?.scale.id).toBe("Eb");
    expect(calls).toBe(19);
    const next = createWebTrainingExercise({ exerciseTypeIndex: 0, progress: dueProgress, previousSelection: first, rng, now });
    expect(next?.exercise.correctAnswer).not.toEqual(first?.exercise.correctAnswer);
    expect(calls).toBe(38);
    expect(createWebTrainingExercise({ exerciseTypeIndex: 1, progress, rng: () => .999, now })?.scale.id).toBe("Cb");
  });

  it("preserves mobile weighted rotation and catalog reachability independently of web anti-repeat", () => {
    const dueProgress = recordAttempt(progress, { exerciseType: "find-error", scaleId: "E", correct: false }, new Date("2026-10-30T12:00:00Z"), () => 0);
    const options = { progress: dueProgress, rng: () => .5, now };
    for (let generation = 0; generation < 5; generation += 1) {
      expect(selectMobileTrainingScale({ ...options, generation })?.id).toBe("E");
    }
    const reached = new Set(Array.from({ length: 19 }, (_, generation) => selectMobileTrainingScale({ ...options, generation })?.id));
    expect(reached.size).toBe(15);
    for (const [index, scale] of MAJOR_SCALES.entries()) {
      expect(selectMobileTrainingScale({ generation: 0, rng: () => (index + .1) / MAJOR_SCALES.length, now })?.id).toBe(scale.id);
    }
  });

  it("preserves mobile type choice, call order, nonfinite randomness and generation bounds", () => {
    for (const [index, type, expectedId, expectedCalls] of [
      [0, "complete-scale", "complete-scale-F#-990000", 4],
      [1, "build-scale", "build-scale-F#-340000", 2],
      [2, "find-accidentals", "find-accidentals-F#-340000", 2],
      [3, "identify-interval", "identify-interval-BC-670000", 3],
      [4, "find-error", "find-error-F#-990000", 4],
    ] as const) {
      const values = [(index + .1) / TRAINING_EXERCISE_TYPES.length, .34, .67, .99];
      let calls = 0;
      const selection = createMobileTrainingExercise({ generation: 0, preferredScaleId: "F#", rng: () => values[calls++] ?? 0, now });
      expect(selection?.exercise.type).toBe(type);
      expect(selection?.exercise.id).toBe(expectedId);
      expect(calls).toBe(expectedCalls);
    }
    for (const value of [NaN, Infinity, -Infinity, -1, 0]) expect(chooseTrainingTypeIndex(() => value)).toBe(0);
    expect(chooseTrainingTypeIndex(() => 1)).toBe(4);
    for (const generation of [NaN, Infinity, -Infinity, -0.8]) {
      expect(selectMobileTrainingScale({ generation, progress, rng: () => 0, now })?.id).toBe("C");
    }
    expect(selectMobileTrainingScale({ generation: -16.9, progress, rng: () => 0, now })?.id).toBe("G");
    for (const preferredScaleId of ["", "H"]) {
      expect(selectMobileTrainingScale({ generation: 0, preferredScaleId, rng: () => .999, now })?.id).toBe("Cb");
    }
  });
});
