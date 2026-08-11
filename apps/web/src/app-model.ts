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
  const value = rng();
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), .999999999999) : 0;
  return Math.floor(safe * EXERCISE_TYPES.length);
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

function weightedIndex(length: number, rng: () => number): number {
  const total = length * (length + 1) / 2;
  const value = rng();
  let target = (Number.isFinite(value) ? Math.min(Math.max(value, 0), .999999999999) : 0) * total;
  for (let index = 0; index < length; index += 1) {
    target -= length - index;
    if (target < 0) return index;
  }
  return Math.max(0, length - 1);
}

function fingerprint(exercise: Exercise): string {
  return JSON.stringify([exercise.type, exercise.question, exercise.promptNotes, exercise.correctAnswer]);
}

function isFresh(candidate: Exercise, previous: Exercise): boolean {
  return fingerprint(candidate) !== fingerprint(previous)
    && displayedCorrectAnswer(candidate.correctAnswer) !== displayedCorrectAnswer(previous.correctAnswer);
}

function domainExercise(type: number, scale: UiScale, rng: () => number): Exercise | undefined {
  // UiScale and MajorScale deliberately share only an id; the domain remains the source of exercise truth.
  const source = majorScaleById.get(scale.id);
  return source ? createExercise(EXERCISE_TYPES[type] ?? "complete-scale", source, rng) : undefined;
}

// Kept at module scope so regular-exercise selection never rebuilds domain data in React renders.
const majorScaleById: ReadonlyMap<string, MajorScale> = new Map(MAJOR_SCALES.map((scale) => [scale.id, scale]));

export function createRegularExercise(
  type: number,
  previous?: ExerciseSelection,
  preferredScale?: UiScale,
  rng: () => number = Math.random,
  progress: ProgressState = createEmptyProgress(),
  now: Date = new Date(),
): ExerciseSelection | undefined {
  const rankedWithFuture = preferredScale ? [preferredScale] : selectReviewScales(progress, scales.length, rng, now)
    .map((scale) => getScale(scale.id))
    .filter((scale): scale is UiScale => Boolean(scale));
  const readyForPractice = rankedWithFuture.filter((scale) => {
    const dueAt = progress.reviews[scale.id as TonicId]?.dueAt;
    return !dueAt || !Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= now.getTime();
  });
  const ranked = readyForPractice.length ? readyForPractice : rankedWithFuture;
  const pool = preferredScale
    ? [preferredScale]
    : ranked.filter((scale) => scale.id !== previous?.scale.id);
  const candidates = pool.length ? pool : ranked.length ? ranked : scales;
  const scale = preferredScale
    ? preferredScale
    : candidates[weightedIndex(candidates.length, rng)];
  if (!scale) return undefined;

  const first = domainExercise(type, scale, rng);
  if (!first || !previous || isFresh(first, previous.exercise)) return first ? { scale, exercise: first } : undefined;

  // ponytail: four seeds cover today's finite variants; replace with domain variant enumeration if kinds grow.
  for (const fallbackScale of preferredScale ? [preferredScale] : candidates) {
    for (const seed of [0, .34, .67, .99]) {
      const candidate = domainExercise(type, fallbackScale, () => seed);
      if (candidate && isFresh(candidate, previous.exercise)) return { scale: fallbackScale, exercise: candidate };
    }
  }

  // Fixed-scale exercises such as "build scale" have one form. Rotate the kind instead of escaping the requested scale.
  if (preferredScale) {
    for (const fallbackType of EXERCISE_TYPES) {
      for (const seed of [0, .34, .67, .99]) {
        const candidate = domainExercise(EXERCISE_TYPES.indexOf(fallbackType), preferredScale, () => seed);
        if (candidate && isFresh(candidate, previous.exercise)) return { scale: preferredScale, exercise: candidate };
      }
    }
  }
  return undefined;
}

export function parseExerciseAnswer(exercise: Exercise, answer: string): string[] {
  return exercise.options
    ? [answer]
    : answer
      .split(/\s*(?:,|–|—|-)\s*|\s+/u)
      .filter((item) => item && item.toLocaleLowerCase("fr") !== "et");
}

export function displayedCorrectAnswer(answer: readonly string[]): string {
  return answer.map((item) => formatNote(item)).join(" – ") || "aucune altération";
}

export function submitExerciseAnswer(
  exercise: Exercise,
  answer: string,
  alreadyRecorded: boolean,
  record: (attempt: RecordedExercise) => void,
): GradeResult {
  const result = gradeExercise(exercise, parseExerciseAnswer(exercise, answer));
  if (result.graded && !alreadyRecorded) {
    record({ scaleId: exercise.scaleId, correct: result.correct, exerciseType: exercise.type });
  }
  return result;
}

export function filterScales(query: string): UiScale[] {
  const needle = query.trim().toLocaleLowerCase("fr");
  return scales.filter((scale) => `${scale.frenchName} ${scale.internationalName}`.toLocaleLowerCase("fr").includes(needle));
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
  try { return decodeURIComponent(value); }
  catch { return null; }
}

export function focusMainContent(root: { getElementById(id: string): { focus(): void } | null }): boolean {
  const main = root.getElementById("contenu");
  if (!main) return false;
  main.focus();
  return true;
}

export function constructionDetails(scaleId: string, step: number): ConstructionDetails | undefined {
  const construction = majorScaleById.get(scaleId)?.construction[step - 1];
  if (!construction) return undefined;
  return {
    currentNote: formatNote(construction.currentNote),
    interval: construction.interval,
    expectedNatural: formatNote(construction.naturalCandidate),
    requiredAccidental: construction.alteration === "sharp" ? "dièse" : construction.alteration === "flat" ? "bémol" : "aucune",
    nextNote: formatNote(construction.nextNote),
    explanation: construction.explanation,
  };
}

const SHARP_PIANO_LABELS = ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"] as const;
const FLAT_PIANO_LABELS = ["Do", "Ré♭", "Ré", "Mi♭", "Mi", "Fa", "Sol♭", "Sol", "La♭", "La", "Si♭", "Si"] as const;

export function pianoLabels(notes: readonly UiNote[]): readonly string[] {
  return notes.some((note) => note.id.endsWith("b")) ? FLAT_PIANO_LABELS : SHARP_PIANO_LABELS;
}
