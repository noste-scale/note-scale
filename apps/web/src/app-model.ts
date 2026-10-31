import {
  createWebTrainingExercise,
  chooseTrainingTypeIndex,
  TRAINING_EXERCISE_TYPES,
  formatNote,
  gradeExercise,
  MAJOR_SCALES,
  createEmptyProgress,
  type Exercise,
  type ExerciseType,
  type GradeResult,
  type MajorScale,
  type ProgressState,
  type RandomSource,
} from "@notescale/music";
import { getScale, scales, type UiNote, type UiScale } from "./domain";

export const EXERCISE_TYPES = TRAINING_EXERCISE_TYPES;

export function randomExerciseTypeIndex(rng: RandomSource = Math.random): number {
  return chooseTrainingTypeIndex(rng);
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

const majorScaleById: ReadonlyMap<string, MajorScale> = new Map(MAJOR_SCALES.map((scale) => [scale.id, scale]));

interface RegularExerciseOptions {
  exerciseTypeIndex: number;
  previousSelection?: ExerciseSelection | undefined;
  preferredScale?: UiScale | undefined;
  rng?: RandomSource;
  progress?: ProgressState;
  now?: Date;
}

export function createRegularExercise({
  exerciseTypeIndex,
  previousSelection,
  preferredScale,
  rng = Math.random,
  progress = createEmptyProgress(),
  now = new Date(),
}: RegularExerciseOptions): ExerciseSelection | undefined {
  const preferredMajorScale = preferredScale ? majorScaleById.get(preferredScale.id) : undefined;
  if (preferredScale && !preferredMajorScale) return undefined;
  const selection = createWebTrainingExercise({
    exerciseTypeIndex,
    previousSelection,
    preferredScale: preferredMajorScale,
    rng,
    progress,
    now,
  });
  if (!selection) return undefined;
  const scale = preferredScale ?? getScale(selection.scale.id);
  return scale ? { scale, exercise: selection.exercise } : undefined;
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
