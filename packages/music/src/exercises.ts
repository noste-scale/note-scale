import { formatNote, normalizeNoteId } from "./notes";
import { MAJOR_SCALES } from "./scale-generator";
import type {
  AnswerError,
  DailySession,
  Exercise,
  ExerciseType,
  GradeResult,
  MajorScale,
  NoteId,
  ProgressState,
  RandomSource,
} from "./types";
import { localDateKey, selectReviewScales } from "./progress";

const RULE = "Utilise chaque lettre une seule fois et respecte T – T – ½ – T – T – T – ½.";
const TYPES: readonly ExerciseType[] = [
  "complete-scale",
  "build-scale",
  "find-accidentals",
  "identify-interval",
  "find-error",
];

function chooseRandomIndex(length: number, rng: RandomSource): number {
  if (length <= 0) return 0;

  const randomValue = rng();
  const boundedRandomValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999999999)
    : 0;

  return Math.floor(boundedRandomValue * length);
}

function createExerciseId(
  type: ExerciseType,
  scale: string,
  rng: RandomSource
): string {
  return `${type}-${scale}-${Math.floor(Math.max(0, rng()) * 1_000_000)}`;
}

function createCompleteScaleExercise(scale: MajorScale, rng: RandomSource): Exercise {
  const firstGapIndex = 1 + chooseRandomIndex(3, rng);
  let secondGapIndex = 4 + chooseRandomIndex(3, rng);

  if (secondGapIndex === firstGapIndex) secondGapIndex = Math.min(6, secondGapIndex + 1);

  const gapIndexes = [firstGapIndex, secondGapIndex].sort((left, right) => left - right);
  const promptNotes = scale.notes.map((note, index) => (gapIndexes.includes(index) ? "___" : formatNote(note)));

  return {
    id: createExerciseId("complete-scale", scale.id, rng),
    type: "complete-scale",
    question: `Complète la gamme de ${scale.frenchName}.`,
    correctAnswer: gapIndexes.map((index) => scale.notes[index] ?? ""),
    explanation: `La gamme complète est ${scale.notes.map((note) => formatNote(note)).join(" – ")}.`,
    rule: RULE,
    scaleId: scale.id,
    promptNotes,
  };
}

function createBuildScaleExercise(scale: MajorScale, rng: RandomSource): Exercise {
  return {
    id: createExerciseId("build-scale", scale.id, rng),
    type: "build-scale",
    question: `Construis la gamme de ${scale.frenchName}.`,
    correctAnswer: scale.notes,
    explanation: scale.construction.map((step) => step.explanation).join(" "),
    rule: RULE,
    scaleId: scale.id,
  };
}

function createFindAccidentalsExercise(scale: MajorScale, rng: RandomSource): Exercise {
  let accidentalLabel = "altérations";

  if (scale.accidentalType === "flat") accidentalLabel = "bémols";
  else if (scale.accidentalType === "sharp") accidentalLabel = "dièses";

  return {
    id: createExerciseId("find-accidentals", scale.id, rng),
    type: "find-accidentals",
    question: `Quelles sont les ${accidentalLabel} de ${scale.frenchName} ?`,
    correctAnswer: scale.accidentals.length === 0 ? ["aucune"] : scale.accidentals,
    explanation:
      scale.accidentals.length === 0
        ? `${scale.frenchName} ne contient aucune altération.`
        : `Son armure contient ${scale.accidentals.map((note) => formatNote(note)).join(", ")}.`,
    rule: "L’ordre des dièses est Fa–Do–Sol–Ré–La–Mi–Si ; celui des bémols est l’inverse.",
    scaleId: scale.id,
  };
}

const INTERVAL_QUESTIONS = [
  {
    notes: ["E", "F"],
    answer: "demi-ton",
    explanation: "Mi et Fa sont collés."
  },
  {
    notes: ["B", "C"],
    answer: "demi-ton",
    explanation: "Si et Do sont collés."
  },
  {
    notes: ["C", "D"],
    answer: "ton",
    explanation: "Do à Ré couvre deux demi-tons."
  },
  {
    notes: ["D", "E"],
    answer: "ton",
    explanation: "Ré à Mi couvre deux demi-tons."
  },
] as const;

function createIdentifyIntervalExercise(rng: RandomSource): Exercise {
  const intervalQuestion = INTERVAL_QUESTIONS[chooseRandomIndex(INTERVAL_QUESTIONS.length, rng)] ?? INTERVAL_QUESTIONS[0];

  return {
    id: createExerciseId("identify-interval", intervalQuestion.notes.join(""), rng),
    type: "identify-interval",
    question: `Quel intervalle se trouve entre ${formatNote(intervalQuestion.notes[0])} et ${formatNote(intervalQuestion.notes[1])} ?`,
    correctAnswer: [intervalQuestion.answer],
    explanation: intervalQuestion.explanation,
    rule: "Mi–Fa et Si–Do sont les deux demi-tons naturels.",
    options: ["ton", "demi-ton"],
  };
}

function createFindErrorExercise(scale: MajorScale, rng: RandomSource): Exercise {
  const accidentalNotes = scale.notes
    .slice(1, 7)
    .map((note, index) => ({ note, index: index + 1 }))
    .filter(({ note }) => note.endsWith("#") || note.endsWith("b"));
  const fallbackIndex = 1 + chooseRandomIndex(6, rng);
  const noteToCorrect = accidentalNotes[chooseRandomIndex(accidentalNotes.length, rng)] ?? {
    note: scale.notes[fallbackIndex] ?? scale.notes[1] ?? "D",
    index: fallbackIndex,
  };
  const noteHasAccidental = noteToCorrect.note.endsWith("#") || noteToCorrect.note.endsWith("b");
  const incorrectNote = (noteHasAccidental ? noteToCorrect.note[0] ?? "C" : `${noteToCorrect.note}#`) as NoteId;
  const promptNotes = [...scale.notes];
  promptNotes[noteToCorrect.index] = incorrectNote;

  return {
    id: createExerciseId("find-error", scale.id, rng),
    type: "find-error",
    question: `Trouve et corrige l’erreur dans cette gamme de ${scale.frenchName}.`,
    correctAnswer: [noteToCorrect.note],
    explanation: `${formatNote(incorrectNote)} doit devenir ${formatNote(noteToCorrect.note)}.`,
    rule: RULE,
    scaleId: scale.id,
    promptNotes: promptNotes.map((note) => formatNote(note)),
  };
}

export function createExercise(
  type: ExerciseType,
  scale: MajorScale,
  rng: RandomSource = Math.random
): Exercise {
  switch (type) {
    case "complete-scale":
      return createCompleteScaleExercise(scale, rng);
    case "build-scale":
      return createBuildScaleExercise(scale, rng);
    case "find-accidentals":
      return createFindAccidentalsExercise(scale, rng);
    case "identify-interval":
      return createIdentifyIntervalExercise(rng);
    case "find-error":
      return createFindErrorExercise(scale, rng);
  }
}

export function generateExercise(
  rng: RandomSource = Math.random,
  type?: ExerciseType,
  scale?: MajorScale
): Exercise {
  const selectedType = type ?? TYPES[chooseRandomIndex(TYPES.length, rng)] ?? "complete-scale";
  const selectedScale = scale ?? MAJOR_SCALES[chooseRandomIndex(MAJOR_SCALES.length, rng)] ?? MAJOR_SCALES[0];

  if (!selectedScale) throw new Error("No major scales are available");

  return createExercise(selectedType, selectedScale, rng);
}

function normalizeAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmedAnswer = value.trim();

  if (!trimmedAnswer) return null;

  const noteId = normalizeNoteId(trimmedAnswer);

  return noteId ?? trimmedAnswer.toLocaleLowerCase("fr");
}

function findUnorderedAnswerErrors(expectedAnswer: readonly string[], actualAnswer: readonly string[]): AnswerError[] {
  const errors: AnswerError[] = [];
  const submittedAccidentals = new Set(actualAnswer);
  const expectedAccidentals = new Set(expectedAnswer);

  for (const expectedAccidental of expectedAccidentals) {
    if (!submittedAccidentals.has(expectedAccidental))
      errors.push({
        expected: expectedAccidental,
        message: `${formatNote(expectedAccidental)} manque.`
      });
  }

  for (const submittedAccidental of submittedAccidentals) {
    if (!expectedAccidentals.has(submittedAccidental))
      errors.push({
        actual: submittedAccidental,
        message: `${formatNote(submittedAccidental)} n’appartient pas à l’armure.`
      });
  }

  if (actualAnswer.length !== submittedAccidentals.size)
    errors.push({ message: "Une altération a été répétée." });

  return errors;
}

function describeAnswerItem(item: string | undefined): string {
  return item ? formatNote(item) : "rien";
}

function findOrderedAnswerErrors(expectedAnswer: readonly string[], actualAnswer: readonly string[]): AnswerError[] {
  const errors: AnswerError[] = [];
  const answerLength = Math.max(actualAnswer.length, expectedAnswer.length);

  for (let index = 0; index < answerLength; index += 1) {
    const expectedItem = expectedAnswer[index];
    const actualItem = actualAnswer[index];

    if (actualItem !== expectedItem) {
      errors.push({
        index,
        ...(expectedItem ? { expected: expectedItem } : {}),
        ...(actualItem ? { actual: actualItem } : {}),
        message: `Position ${index + 1} : attendu ${describeAnswerItem(expectedItem)}, reçu ${describeAnswerItem(actualItem)}.`,
      });
    }
  }

  return errors;
}

export function gradeExercise(exercise: Exercise, answer: unknown): GradeResult {
  let answerItems: unknown[] = [];

  if (Array.isArray(answer)) answerItems = answer;
  else if (typeof answer === "string") answerItems = [answer];

  const normalizedAnswer = answerItems.map(normalizeAnswer);
  const hasInvalidAnswer = normalizedAnswer.length === 0 || normalizedAnswer.some((item) => item === null);

  if (hasInvalidAnswer) {
    return {
      graded: false,
      correct: false,
      errors: [],
      correctAnswer: exercise.correctAnswer,
      explanation: exercise.explanation,
      rule: exercise.rule,
      validationMessage: "Propose une réponse avant de valider.",
    };
  }

  const expectedAnswer = exercise.correctAnswer.map((item) => normalizeAnswer(item) ?? item);
  const actualAnswer = normalizedAnswer as string[];
  const answerOrderDoesNotMatter = exercise.type === "find-accidentals";
  const errors = answerOrderDoesNotMatter
    ? findUnorderedAnswerErrors(expectedAnswer, actualAnswer)
    : findOrderedAnswerErrors(expectedAnswer, actualAnswer);

  return {
    graded: true,
    correct: errors.length === 0,
    errors,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
    rule: exercise.rule,
  };
}

export function createDailySession(
  progress: ProgressState,
  rng: RandomSource = Math.random,
  now: Date = new Date(),
): DailySession {
  const scales = selectReviewScales(progress, 3, rng, now);
  const naturalSemitoneQuestion = createIdentifyIntervalExercise(() => (rng() < 0.5 ? 0 : 0.25));
  const scaleTypes: readonly ExerciseType[] = ["complete-scale", "build-scale", "find-accidentals"];

  return {
    id: `daily-${localDateKey(now)}`,
    formulaReminder: "T – T – ½ | T – T – T – ½",
    naturalSemitoneQuestion,
    scaleExercises: scales.map((scale, index) => createExercise(scaleTypes[index] ?? "complete-scale", scale, rng)),
  };
}
