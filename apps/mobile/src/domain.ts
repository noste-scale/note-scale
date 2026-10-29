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

const createScaleView = (scale: MajorScale): ScaleView => ({
  id: scale.id,
  tonic: scale.tonic,
  frenchName: scale.frenchName,
  internationalName: scale.internationalName,
  notes: scale.notes.map((note) => formatNote(note)),
  accidentals: scale.accidentals.map((note) => formatNote(note)),
  keySignatureCount: scale.keySignatureCount,
  construction: scale.construction.map((step) => {
    let necessaryAlteration = "aucune";
    if (step.alteration === "sharp") necessaryAlteration = "dièse";
    else if (step.alteration === "flat") necessaryAlteration = "bémol";

    return {
      currentNote: formatNote(step.currentNote),
      interval: step.interval,
      intervalLabel: step.interval === "ton" ? "un ton" : "un demi-ton",
      naturalCandidate: formatNote(step.naturalCandidate),
      necessaryAlteration,
      nextNote: formatNote(step.nextNote),
      result: formatNote(step.nextNote),
      explanation: step.explanation,
    };
  }),
});

export const scales = MAJOR_SCALES.map(createScaleView);
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

const exerciseKinds: ExerciseKind[] = ["complete-scale", "build-scale", "find-accidentals", "identify-interval", "find-error"];

function chooseRandomIndex(candidateCount: number, rng: () => number): number {
  const randomValue = rng();
  const boundedRandomValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999999999)
    : 0;
  return Math.floor(boundedRandomValue * candidateCount);
}

function createSeededRandom(seed: number): () => number {
  let randomState = (seed + 1) >>> 0;
  return () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
}

function formatAnswerLabels(type: ExerciseKind, answers: readonly string[]): string {
  if (answers.length === 0 || (type === "find-accidentals" && answers[0]?.toLocaleLowerCase("fr") === "aucune")) return "Aucune";
  const formattedAnswers = answers.map((answer) => formatNote(answer));
  if (type === "build-scale") return formattedAnswers.join(" – ");
  if (type === "complete-scale") return formattedAnswers.join(" et ");
  if (type === "find-accidentals") return formattedAnswers.join(", ");
  if (type === "identify-interval") return formattedAnswers[0] === "demi-ton" ? "Un demi-ton" : "Un ton";
  return formattedAnswers.join(", ");
}

const formatExerciseAnswer = (exercise: Exercise): string => formatAnswerLabels(exercise.type, exercise.correctAnswer);

export function selectExerciseScale(
  generation: number,
  preferredScaleId?: string,
  progress?: ProgressState,
  rng: () => number = Math.random,
  now = new Date(),
): MajorScale | undefined {
  const preferredScale = MAJOR_SCALES.find((scaleOption) => scaleOption.id === preferredScaleId);
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

export function makeExercise(
  generation: number,
  preferredScaleId?: string,
  rng: () => number = Math.random,
  progress?: ProgressState,
  now = new Date(),
): ExerciseView | undefined {
  const scale = selectExerciseScale(generation, preferredScaleId, progress, rng, now);
  if (!scale) return undefined;
  const kind = exerciseKinds[chooseRandomIndex(exerciseKinds.length, rng)] ?? "complete-scale";
  const exercise = createExercise(kind, scale, rng);
  return createExerciseView(exercise, scale, rng);
}

function shuffleValues<T>(values: readonly T[], rng: () => number): T[] {
  const shuffledValues = [...values];
  for (let index = shuffledValues.length - 1; index > 0; index -= 1) {
    const swapIndex = chooseRandomIndex(index + 1, rng);
    [shuffledValues[index], shuffledValues[swapIndex]] = [shuffledValues[swapIndex] as T, shuffledValues[index] as T];
  }
  return shuffledValues;
}

function createExerciseView(exercise: Exercise, scale: MajorScale, rng: () => number): ExerciseView {
  const answer = formatExerciseAnswer(exercise);
  const distractorScale = MAJOR_SCALES.find((scaleOption) => scaleOption.id !== scale.id) ?? scale;
  const distractorExercise = createExercise(exercise.type, distractorScale, rng);
  let answerCandidates = exercise.options;
  if (!answerCandidates) {
    if (exercise.type === "build-scale") {
      answerCandidates = [...scale.notes, ...distractorScale.notes];
    } else if (exercise.type === "find-error") {
      answerCandidates = [...exercise.correctAnswer, ...distractorExercise.correctAnswer, ...(exercise.promptNotes ?? [])];
    } else {
      answerCandidates = [...exercise.correctAnswer, ...distractorExercise.correctAnswer];
    }
  }
  const payloadsByLabel = new Map<string, readonly string[]>();
  for (const option of answerCandidates) {
    let label: string;
    if (option === "demi-ton") label = "Un demi-ton";
    else if (option === "ton") label = "Un ton";
    else if (option.toLocaleLowerCase("fr") === "aucune") label = "Aucune";
    else label = formatNote(option);
    payloadsByLabel.set(label, [option]);
  }
  const options = shuffleValues([...payloadsByLabel.keys()], rng);
  const optionPayloads = Object.fromEntries(payloadsByLabel) as Record<string, readonly string[]>;
  let selectionMode: ExerciseSelectionMode = "single";
  if (exercise.type === "find-accidentals") selectionMode = "multiple";
  else if (exercise.type === "complete-scale" || exercise.type === "build-scale") selectionMode = "ordered";
  const noneOption = options.find((option) => option === "Aucune");
  let question = exercise.question;
  if (exercise.promptNotes?.length) {
    const promptNotes = exercise.promptNotes.map((note) => note === "___" ? note : formatNote(note));
    question = `${exercise.question}\n${promptNotes.join(" – ")}`;
  }
  return {
    id: exercise.id,
    kind: exercise.type,
    ...(exercise.scaleId ? { scaleId: exercise.scaleId } : {}),
    sourceScaleId: scale.id,
    question,
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
  const selectedLabels = typeof selected === "string" ? [selected] : selected;
  return gradeExercise(exercise.domainExercise, selectionPayload(selectedLabels, exercise.optionPayloads));
}

export function displayGradeAnswer(answers: readonly string[], kind: ExerciseKind): string {
  return formatAnswerLabels(kind, answers);
}

export function makeDailyExercises(progress: ProgressState, now = new Date()): ExerciseView[] {
  const dateSeed = Number(localDateKey(now).replaceAll("-", ""));
  const session = createDailySession(progress, createSeededRandom(dateSeed), now);
  return [session.naturalSemitoneQuestion, ...session.scaleExercises].map((exercise, index) => {
    const scale = MAJOR_SCALES.find((scaleOption) => scaleOption.id === exercise.scaleId) ?? MAJOR_SCALES[index] ?? MAJOR_SCALES[0];
    return scale ? createExerciseView(exercise, scale, createSeededRandom(dateSeed + index)) : undefined;
  }).filter((exercise): exercise is ExerciseView => Boolean(exercise));
}
