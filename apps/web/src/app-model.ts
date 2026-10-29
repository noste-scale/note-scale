import {
  createExercise,
  formatNote,
  gradeExercise,
  MAJOR_SCALES,
  createEmptyProgress,
  selectReviewScales,
  type Exercise,
  type ExerciseType,
  type GradeResult,
  type MajorScale,
  type ProgressState,
  type TonicId,
} from "@notescale/music";
import { getScale, scales, type UiNote, type UiScale } from "./domain";

export const EXERCISE_TYPES: readonly ExerciseType[] = [
  "complete-scale",
  "build-scale",
  "find-accidentals",
  "identify-interval",
  "find-error",
];

export function randomExerciseTypeIndex(rng: () => number = Math.random): number {
  const randomValue = rng();
  const boundedRandomValue = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), .999999999999) : 0;
  return Math.floor(boundedRandomValue * EXERCISE_TYPES.length);
}

export interface ExerciseSelection {
  scale: UiScale;
  exercise: Exercise;
}

export interface RecordedExercise {
  scaleId: string | undefined;
  correct: boolean;
  exerciseType: ExerciseType;
}

export interface ConstructionDetails {
  currentNote: string;
  interval: string;
  expectedNatural: string;
  requiredAccidental: string;
  nextNote: string;
  explanation: string;
}

function selectWeightedIndex(candidateCount: number, rng: () => number): number {
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

function differsFromPreviousExercise(candidateExercise: Exercise, previous: Exercise): boolean {
  return fingerprintExercise(candidateExercise) !== fingerprintExercise(previous)
    && displayedCorrectAnswer(candidateExercise.correctAnswer) !== displayedCorrectAnswer(previous.correctAnswer);
}

function createDomainExercise(exerciseTypeIndex: number, scale: UiScale, rng: () => number): Exercise | undefined {
  // UiScale and MajorScale deliberately share only an id; the domain remains the source of exercise truth.
  const majorScale = majorScaleById.get(scale.id);
  return majorScale ? createExercise(EXERCISE_TYPES[exerciseTypeIndex] ?? "complete-scale", majorScale, rng) : undefined;
}

// Kept at module scope so regular-exercise selection never rebuilds domain data in React renders.
const majorScaleById: ReadonlyMap<string, MajorScale> = new Map(MAJOR_SCALES.map((scale) => [scale.id, scale]));

export function createRegularExercise(
  exerciseTypeIndex: number,
  previousSelection?: ExerciseSelection,
  preferredScale?: UiScale,
  rng: () => number = Math.random,
  progress: ProgressState = createEmptyProgress(),
  now: Date = new Date(),
): ExerciseSelection | undefined {
  const rankedScales = preferredScale
    ? [preferredScale]
    : selectReviewScales(progress, scales.length, rng, now)
      .map((scale) => getScale(scale.id))
      .filter((scale): scale is UiScale => Boolean(scale));
  const dueScales = rankedScales.filter((scale) => {
    const dueAt = progress.reviews[scale.id as TonicId]?.dueAt;
    return !dueAt || !Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= now.getTime();
  });
  const practiceScales = dueScales.length ? dueScales : rankedScales;
  const alternativeScales = preferredScale
    ? [preferredScale]
    : practiceScales.filter((scale) => scale.id !== previousSelection?.scale.id);
  let candidateScales = scales;
  if (alternativeScales.length) candidateScales = alternativeScales;
  else if (practiceScales.length) candidateScales = practiceScales;
  const scale = preferredScale
    ? preferredScale
    : candidateScales[selectWeightedIndex(candidateScales.length, rng)];
  if (!scale) return undefined;

  const firstExercise = createDomainExercise(exerciseTypeIndex, scale, rng);
  if (!firstExercise) return undefined;
  if (!previousSelection || differsFromPreviousExercise(firstExercise, previousSelection.exercise)) {
    return { scale, exercise: firstExercise };
  }

  // ponytail: four seeds cover today's finite variants; replace with domain variant enumeration if kinds grow.
  for (const fallbackScale of preferredScale ? [preferredScale] : candidateScales) {
    for (const seed of [0, .34, .67, .99]) {
      const candidateExercise = createDomainExercise(exerciseTypeIndex, fallbackScale, () => seed);
      if (candidateExercise && differsFromPreviousExercise(candidateExercise, previousSelection.exercise)) {
        return { scale: fallbackScale, exercise: candidateExercise };
      }
    }
  }

  // Fixed-scale exercises such as "build scale" have one form. Rotate the kind instead of escaping the requested scale.
  if (preferredScale) {
    for (const fallbackType of EXERCISE_TYPES) {
      for (const seed of [0, .34, .67, .99]) {
        const candidateExercise = createDomainExercise(EXERCISE_TYPES.indexOf(fallbackType), preferredScale, () => seed);
        if (candidateExercise && differsFromPreviousExercise(candidateExercise, previousSelection.exercise)) {
          return { scale: preferredScale, exercise: candidateExercise };
        }
      }
    }
  }
  return undefined;
}

export function parseExerciseAnswer(exercise: Exercise, answer: string): string[] {
  if (exercise.options) return [answer];
  return answer
    .split(/\s*(?:,|–|—|-)\s*|\s+/u)
    .filter((answerPart) => answerPart && answerPart.toLocaleLowerCase("fr") !== "et");
}

export function displayedCorrectAnswer(answer: readonly string[]): string {
  return answer.map((answerNote) => formatNote(answerNote)).join(" – ") || "aucune altération";
}

export function submitExerciseAnswer(
  exercise: Exercise,
  answer: string,
  hasRecordedAttempt: boolean,
  recordAttempt: (attempt: RecordedExercise) => void,
): GradeResult {
  const gradeResult = gradeExercise(exercise, parseExerciseAnswer(exercise, answer));
  if (gradeResult.graded && !hasRecordedAttempt) {
    recordAttempt({ scaleId: exercise.scaleId, correct: gradeResult.correct, exerciseType: exercise.type });
  }
  return gradeResult;
}

export function filterScales(query: string): UiScale[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  return scales.filter((scale) => `${scale.frenchName} ${scale.internationalName}`.toLocaleLowerCase("fr").includes(normalizedQuery));
}

export function requestedScale(value: string | null): { scale?: UiScale; error?: string } {
  if (value === null) return {};
  if (value === "") return { error: "Le paramètre de gamme est vide." };
  const scale = getScale(value);
  return scale
    ? { scale }
    : { error: `La gamme « ${value} » n’est pas prise en charge.` };
}

export function safeRouteScaleId(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function focusMainContent(root: { getElementById(id: string): { focus(): void } | null }): boolean {
  const mainContent = root.getElementById("contenu");
  if (!mainContent) return false;
  mainContent.focus();
  return true;
}

export function constructionDetails(scaleId: string, completedIntervalCount: number): ConstructionDetails | undefined {
  const construction = majorScaleById.get(scaleId)?.construction[completedIntervalCount - 1];
  if (!construction) return undefined;
  let requiredAccidental = "aucune";
  if (construction.alteration === "sharp") requiredAccidental = "dièse";
  else if (construction.alteration === "flat") requiredAccidental = "bémol";
  return {
    currentNote: formatNote(construction.currentNote),
    interval: construction.interval,
    expectedNatural: formatNote(construction.naturalCandidate),
    requiredAccidental,
    nextNote: formatNote(construction.nextNote),
    explanation: construction.explanation,
  };
}

const SHARP_PIANO_LABELS = ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"] as const;
const FLAT_PIANO_LABELS = ["Do", "Ré♭", "Ré", "Mi♭", "Mi", "Fa", "Sol♭", "Sol", "La♭", "La", "Si♭", "Si"] as const;

export function pianoLabels(notes: readonly UiNote[]): readonly string[] {
  return notes.some((note) => note.id.endsWith("b")) ? FLAT_PIANO_LABELS : SHARP_PIANO_LABELS;
}
