import { createExercise } from "./exercises";
import { formatNote } from "./notes";
import { isScaleDue, recentScaleAttempts, selectReviewScales } from "./progress";
import { MAJOR_SCALES } from "./scale-generator";
import type { Exercise, ExerciseType, MajorScale, ProgressState, RandomSource } from "./types";

export const TRAINING_EXERCISE_TYPES: readonly ExerciseType[] = [
  "complete-scale", "build-scale", "find-accidentals", "identify-interval", "find-error",
];

export interface TrainingSelection {
  scale: MajorScale;
  exercise: Exercise;
}

export function chooseTrainingTypeIndex(rng: RandomSource): number {
  return chooseRandomIndex(TRAINING_EXERCISE_TYPES.length, rng);
}

function chooseRandomIndex(candidateCount: number, rng: RandomSource): number {
  const randomValue = rng();
  const boundedRandomValue = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), .999999999999) : 0;
  return Math.floor(boundedRandomValue * candidateCount);
}

function selectWeightedIndex(candidateCount: number, rng: RandomSource): number {
  const totalWeight = candidateCount * (candidateCount + 1) / 2;
  const randomValue = rng();
  let remainingWeight = (Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), .999999999999) : 0) * totalWeight;
  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    remainingWeight -= candidateCount - candidateIndex;
    if (remainingWeight < 0) return candidateIndex;
  }
  return Math.max(0, candidateCount - 1);
}

function fingerprintExercise(exercise: Exercise): string {
  return JSON.stringify([exercise.type, exercise.question, exercise.promptNotes, exercise.correctAnswer]);
}

function answerIdentity(exercise: Exercise): string {
  return exercise.correctAnswer.map((answer) => formatNote(answer)).join(" – ") || "aucune altération";
}

function differsFromPreviousExercise(candidate: Exercise, previous: Exercise): boolean {
  return fingerprintExercise(candidate) !== fingerprintExercise(previous)
    && answerIdentity(candidate) !== answerIdentity(previous);
}

export interface WebTrainingOptions {
  exerciseTypeIndex: number;
  previousSelection?: { scale: { id: string }; exercise: Exercise } | undefined;
  preferredScale?: MajorScale | undefined;
  progress: ProgressState;
  rng: RandomSource;
  now: Date;
}

export function createWebTrainingExercise({
  exerciseTypeIndex, previousSelection, preferredScale, progress, rng, now,
}: WebTrainingOptions): TrainingSelection | undefined {
  const rankedScales = preferredScale ? [preferredScale] : selectReviewScales(progress, MAJOR_SCALES.length, rng, now);
  const dueScales = rankedScales.filter((scale) => {
    const dueAt = progress.reviews[scale.id]?.dueAt;
    return !dueAt || !Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= now.getTime();
  });
  const practiceScales = dueScales.length ? dueScales : rankedScales;
  const alternativeScales = preferredScale ? [preferredScale] : practiceScales.filter((scale) => scale.id !== previousSelection?.scale.id);
  let candidateScales = MAJOR_SCALES;
  if (alternativeScales.length) candidateScales = alternativeScales;
  else if (practiceScales.length) candidateScales = practiceScales;
  const scale = preferredScale ?? candidateScales[selectWeightedIndex(candidateScales.length, rng)];
  if (!scale) return undefined;

  const firstExercise = createExercise(TRAINING_EXERCISE_TYPES[exerciseTypeIndex] ?? "complete-scale", scale, rng);
  if (!previousSelection || differsFromPreviousExercise(firstExercise, previousSelection.exercise)) {
    return { scale, exercise: firstExercise };
  }

  // ponytail: four seeds cover today's finite variants; enumerate domain variants if kinds grow.
  for (const fallbackScale of preferredScale ? [preferredScale] : candidateScales) {
    for (const seed of [0, .34, .67, .99]) {
      const exercise = createExercise(TRAINING_EXERCISE_TYPES[exerciseTypeIndex] ?? "complete-scale", fallbackScale, () => seed);
      if (differsFromPreviousExercise(exercise, previousSelection.exercise)) return { scale: fallbackScale, exercise };
    }
  }

  // Fixed-scale exercises may have one form; rotate kinds without escaping the requested scale.
  if (preferredScale) {
    for (const fallbackType of TRAINING_EXERCISE_TYPES) {
      for (const seed of [0, .34, .67, .99]) {
        const exercise = createExercise(fallbackType, preferredScale, () => seed);
        if (differsFromPreviousExercise(exercise, previousSelection.exercise)) return { scale: preferredScale, exercise };
      }
    }
  }
  return undefined;
}

export interface MobileTrainingOptions {
  generation: number;
  preferredScaleId?: string | undefined;
  progress?: ProgressState | undefined;
  rng: RandomSource;
  now: Date;
}

export function selectMobileTrainingScale({
  generation, preferredScaleId, progress, rng, now,
}: MobileTrainingOptions): MajorScale | undefined {
  const preferredScale = MAJOR_SCALES.find((scale) => scale.id === preferredScaleId);
  if (preferredScale) return preferredScale;
  if (!progress) return MAJOR_SCALES[chooseRandomIndex(MAJOR_SCALES.length, rng)];

  const rankedScales = selectReviewScales(progress, MAJOR_SCALES.length, rng, now);
  const weightedScales = rankedScales.flatMap((scale) => {
    const recentErrorCount = recentScaleAttempts(progress, scale.id, 6).filter((attempt) => !attempt.correct).length;
    const weight = 1 + recentErrorCount + (isScaleDue(progress, scale.id, now) ? 3 : 0);
    return Array.from({ length: weight }, () => scale);
  });
  const rotatedScaleIndex = Number.isFinite(generation) ? Math.abs(Math.trunc(generation)) : 0;
  return weightedScales[rotatedScaleIndex % weightedScales.length] ?? rankedScales[0];
}

export function createMobileTrainingExercise(options: MobileTrainingOptions): TrainingSelection | undefined {
  const scale = selectMobileTrainingScale(options);
  if (!scale) return undefined;
  const kind = TRAINING_EXERCISE_TYPES[chooseTrainingTypeIndex(options.rng)] ?? "complete-scale";
  return { scale, exercise: createExercise(kind, scale, options.rng) };
}
