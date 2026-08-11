import {
  createExercise,
  createDailySession,
  formatNote,
  gradeExercise,
  isScaleDue,
  LESSONS,
  localDateKey,
  MAJOR_SCALES,
  recentScaleAttempts,
  selectReviewScales,
  type Exercise,
  type ExerciseType,
  type GradeResult,
  type MajorScale,
  type ProgressState,
} from "@notescale/music";
import { selectionPayload, type ExerciseSelectionMode } from "./exercise-state";

export interface ScaleView {
  id: string;
  frenchName: string;
  internationalName: string;
  tonic: string;
  notes: string[];
  accidentals: string[];
  keySignatureCount: number;
  construction: {
    currentNote: string;
    interval: "ton" | "demi-ton";
    intervalLabel: string;
    naturalCandidate: string;
    necessaryAlteration: string;
    nextNote: string;
    result: string;
    explanation: string;
  }[];
}

const displayScale = (scale: MajorScale): ScaleView => ({
  id: scale.id,
  tonic: scale.tonic,
  frenchName: scale.frenchName,
  internationalName: scale.internationalName,
  notes: scale.notes.map((note) => formatNote(note)),
  accidentals: scale.accidentals.map((note) => formatNote(note)),
  keySignatureCount: scale.keySignatureCount,
  construction: scale.construction.map((step) => ({
    currentNote: formatNote(step.currentNote),
    interval: step.interval,
    intervalLabel: step.interval === "ton" ? "un ton" : "un demi-ton",
    naturalCandidate: formatNote(step.naturalCandidate),
    necessaryAlteration: step.alteration === "sharp" ? "dièse" : step.alteration === "flat" ? "bémol" : "aucune",
    nextNote: formatNote(step.nextNote),
    result: formatNote(step.nextNote),
    explanation: step.explanation,
  })),
});

export const scales = MAJOR_SCALES.map(displayScale);
export const getScale = (id: string): ScaleView | undefined => scales.find((scale) => scale.id === id);

export interface LessonView {
  id: string;
  title: string;
  body: string[];
}

export const lessons: LessonView[] = LESSONS.map((lesson) => ({
  id: lesson.id,
  title: lesson.title,
  body: [lesson.summary, ...lesson.paragraphs, ...(lesson.notes ?? [])],
}));

export type ExerciseKind = ExerciseType;
export interface ExerciseView {
  id: string;
  kind: ExerciseKind;
  scaleId?: string;
  sourceScaleId: string;
  question: string;
  options: string[];
  selectionMode: ExerciseSelectionMode;
  maximumSelections: number;
  noneOption?: string;
  answer: string;
  explanation: string;
  retainedRule: string;
  domainExercise: Exercise;
  optionPayloads: Record<string, readonly string[]>;
}

const kinds: ExerciseKind[] = ["complete-scale", "build-scale", "find-accidentals", "identify-interval", "find-error"];

function randomIndex(length: number, rng: () => number): number {
  const value = rng();
  return Math.floor((Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999999) : 0) * length);
}

function seeded(seed: number): () => number {
  let state = (seed + 1) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function answerLabelValues(type: ExerciseKind, answers: readonly string[]): string {
  if (answers.length === 0 || (type === "find-accidentals" && answers[0]?.toLocaleLowerCase("fr") === "aucune")) return "Aucune";
  const values = answers.map((answer) => formatNote(answer));
  if (type === "build-scale") return values.join(" – ");
  if (type === "complete-scale") return values.join(" et ");
  if (type === "find-accidentals") return values.join(", ");
  if (type === "identify-interval") return values[0] === "demi-ton" ? "Un demi-ton" : "Un ton";
  return values.join(", ");
}

const answerLabel = (exercise: Exercise): string => answerLabelValues(exercise.type, exercise.correctAnswer);

export function selectExerciseScale(
  generation: number,
  preferredScaleId?: string,
  progress?: ProgressState,
  rng: () => number = Math.random,
  now = new Date(),
): MajorScale | undefined {
  const preferred = MAJOR_SCALES.find((item) => item.id === preferredScaleId);
  if (preferred) return preferred;
  if (!progress) return MAJOR_SCALES[randomIndex(MAJOR_SCALES.length, rng)];

  const ranked = selectReviewScales(progress, MAJOR_SCALES.length, rng, now);
  const weighted = ranked.flatMap((scale) => {
    const errors = recentScaleAttempts(progress, scale.id, 6).filter((attempt) => !attempt.correct).length;
    const weight = 1 + errors + (isScaleDue(progress, scale.id, now) ? 3 : 0);
    return Array.from({ length: weight }, () => scale);
  });
  const index = Number.isFinite(generation) ? Math.abs(Math.trunc(generation)) : 0;
  return weighted[index % weighted.length] ?? ranked[0];
}

export function makeExercise(
  generation: number,
  preferredScaleId?: string,
  rng: () => number = Math.random,
  progress?: ProgressState,
  now = new Date(),
): ExerciseView | undefined {
  const scale = selectExerciseScale(generation, preferredScaleId, progress, rng, now);
  if (!scale) return undefined;
  const kind = kinds[randomIndex(kinds.length, rng)] ?? "complete-scale";
  const exercise = createExercise(kind, scale, rng);
  return exerciseView(exercise, scale, rng);
}

function shuffled<T>(values: readonly T[], rng: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, rng);
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

function exerciseView(exercise: Exercise, scale: MajorScale, rng: () => number): ExerciseView {
  const answer = answerLabel(exercise);
  const otherScale = MAJOR_SCALES.find((item) => item.id !== scale.id) ?? scale;
  const otherExercise = createExercise(exercise.type, otherScale, rng);
  const candidates = exercise.options ?? (
    exercise.type === "build-scale"
      ? [...scale.notes, ...otherScale.notes]
      : exercise.type === "find-error"
        ? [...exercise.correctAnswer, ...otherExercise.correctAnswer, ...(exercise.promptNotes ?? [])]
      : [...exercise.correctAnswer, ...otherExercise.correctAnswer]
  );
  const entries = new Map<string, readonly string[]>();
  for (const option of candidates) {
    const label = option === "demi-ton" ? "Un demi-ton" : option === "ton" ? "Un ton" : option.toLocaleLowerCase("fr") === "aucune" ? "Aucune" : formatNote(option);
    entries.set(label, [option]);
  }
  const options = shuffled([...entries.keys()], rng);
  const optionPayloads = Object.fromEntries(entries) as Record<string, readonly string[]>;
  const selectionMode: ExerciseSelectionMode = exercise.type === "find-accidentals"
    ? "multiple"
    : exercise.type === "complete-scale" || exercise.type === "build-scale"
      ? "ordered"
      : "single";
  const noneOption = options.find((option) => option === "Aucune");
  return {
    id: exercise.id,
    kind: exercise.type,
    ...(exercise.scaleId ? { scaleId: exercise.scaleId } : {}),
    sourceScaleId: scale.id,
    question: exercise.promptNotes?.length ? `${exercise.question}\n${exercise.promptNotes.map((note) => note === "___" ? note : formatNote(note)).join(" – ")}` : exercise.question,
    options,
    selectionMode,
    maximumSelections: selectionMode === "ordered" ? exercise.correctAnswer.length : options.length,
    ...(noneOption ? { noneOption } : {}),
    answer,
    explanation: exercise.explanation,
    retainedRule: exercise.rule,
    domainExercise: exercise,
    optionPayloads,
  };
}

export function gradeSelection(exercise: ExerciseView, selected: readonly string[] | string): GradeResult {
  const labels = typeof selected === "string" ? [selected] : selected;
  return gradeExercise(exercise.domainExercise, selectionPayload(labels, exercise.optionPayloads));
}

export function displayGradeAnswer(answers: readonly string[], kind: ExerciseKind): string {
  return answerLabelValues(kind, answers);
}

export function makeDailyExercises(progress: ProgressState, now = new Date()): ExerciseView[] {
  const dateSeed = Number(localDateKey(now).replaceAll("-", ""));
  const session = createDailySession(progress, seeded(dateSeed), now);
  return [session.naturalSemitoneQuestion, ...session.scaleExercises].map((exercise, index) => {
    const scale = MAJOR_SCALES.find((item) => item.id === exercise.scaleId) ?? MAJOR_SCALES[index] ?? MAJOR_SCALES[0];
    return scale ? exerciseView(exercise, scale, seeded(dateSeed + index)) : undefined;
  }).filter((exercise): exercise is ExerciseView => Boolean(exercise));
}
