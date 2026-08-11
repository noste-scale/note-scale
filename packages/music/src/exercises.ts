import { formatNote, normalizeNoteId } from "./notes";
import { MAJOR_SCALES } from "./scale-generator";
import type {
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

function randomIndex(length: number, rng: RandomSource): number {
  if (length <= 0) return 0;
  const value = rng();
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999999) : 0;
  return Math.floor(safe * length);
}

function exerciseId(type: ExerciseType, scale: string, rng: RandomSource): string {
  return `${type}-${scale}-${Math.floor(Math.max(0, rng()) * 1_000_000)}`;
}

function completeScale(scale: MajorScale, rng: RandomSource): Exercise {
  const first = 1 + randomIndex(3, rng);
  let second = 4 + randomIndex(3, rng);
  if (second === first) second = Math.min(6, second + 1);
  const gaps = [first, second].sort((a, b) => a - b);
  const promptNotes = scale.notes.map((note, index) => (gaps.includes(index) ? "___" : formatNote(note)));
  return {
    id: exerciseId("complete-scale", scale.id, rng),
    type: "complete-scale",
    question: `Complète la gamme de ${scale.frenchName}.`,
    correctAnswer: gaps.map((index) => scale.notes[index] ?? ""),
    explanation: `La gamme complète est ${scale.notes.map((note) => formatNote(note)).join(" – ")}.`,
    rule: RULE,
    scaleId: scale.id,
    promptNotes,
  };
}

function buildScale(scale: MajorScale, rng: RandomSource): Exercise {
  return {
    id: exerciseId("build-scale", scale.id, rng),
    type: "build-scale",
    question: `Construis la gamme de ${scale.frenchName}.`,
    correctAnswer: scale.notes,
    explanation: scale.construction.map((step) => step.explanation).join(" "),
    rule: RULE,
    scaleId: scale.id,
  };
}

function findAccidentals(scale: MajorScale, rng: RandomSource): Exercise {
  const kind = scale.accidentalType === "flat" ? "bémols" : scale.accidentalType === "sharp" ? "dièses" : "altérations";
  return {
    id: exerciseId("find-accidentals", scale.id, rng),
    type: "find-accidentals",
    question: `Quelles sont les ${kind} de ${scale.frenchName} ?`,
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
  { notes: ["E", "F"], answer: "demi-ton", explanation: "Mi et Fa sont collés." },
  { notes: ["B", "C"], answer: "demi-ton", explanation: "Si et Do sont collés." },
  { notes: ["C", "D"], answer: "ton", explanation: "Do à Ré couvre deux demi-tons." },
  { notes: ["D", "E"], answer: "ton", explanation: "Ré à Mi couvre deux demi-tons." },
] as const;

function identifyInterval(rng: RandomSource): Exercise {
  const item = INTERVAL_QUESTIONS[randomIndex(INTERVAL_QUESTIONS.length, rng)] ?? INTERVAL_QUESTIONS[0];
  return {
    id: exerciseId("identify-interval", item.notes.join(""), rng),
    type: "identify-interval",
    question: `Quel intervalle se trouve entre ${formatNote(item.notes[0])} et ${formatNote(item.notes[1])} ?`,
    correctAnswer: [item.answer],
    explanation: item.explanation,
    rule: "Mi–Fa et Si–Do sont les deux demi-tons naturels.",
    options: ["ton", "demi-ton"],
  };
}

function findError(scale: MajorScale, rng: RandomSource): Exercise {
  const alteredIndexes = scale.notes
    .slice(1, 7)
    .map((note, index) => ({ note, index: index + 1 }))
    .filter(({ note }) => note.endsWith("#") || note.endsWith("b"));
  const fallbackIndex = 1 + randomIndex(6, rng);
  const target = alteredIndexes[randomIndex(alteredIndexes.length, rng)] ?? {
    note: scale.notes[fallbackIndex] ?? scale.notes[1] ?? "D",
    index: fallbackIndex,
  };
  const wrong = (target.note.endsWith("#") || target.note.endsWith("b") ? target.note[0] ?? "C" : `${target.note}#`) as NoteId;
  const promptNotes = [...scale.notes];
  promptNotes[target.index] = wrong;
  return {
    id: exerciseId("find-error", scale.id, rng),
    type: "find-error",
    question: `Trouve et corrige l’erreur dans cette gamme de ${scale.frenchName}.`,
    correctAnswer: [target.note],
    explanation: `${formatNote(wrong)} doit devenir ${formatNote(target.note)}.`,
    rule: RULE,
    scaleId: scale.id,
    promptNotes: promptNotes.map((note) => formatNote(note)),
  };
}

export function createExercise(type: ExerciseType, scale: MajorScale, rng: RandomSource = Math.random): Exercise {
  switch (type) {
    case "complete-scale":
      return completeScale(scale, rng);
    case "build-scale":
      return buildScale(scale, rng);
    case "find-accidentals":
      return findAccidentals(scale, rng);
    case "identify-interval":
      return identifyInterval(rng);
    case "find-error":
      return findError(scale, rng);
  }
}

export function generateExercise(rng: RandomSource = Math.random, type?: ExerciseType, scale?: MajorScale): Exercise {
  const selectedType = type ?? TYPES[randomIndex(TYPES.length, rng)] ?? "complete-scale";
  const selectedScale = scale ?? MAJOR_SCALES[randomIndex(MAJOR_SCALES.length, rng)] ?? MAJOR_SCALES[0];
  if (!selectedScale) throw new Error("No major scales are available");
  return createExercise(selectedType, selectedScale, rng);
}

function normalizeAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const note = normalizeNoteId(trimmed);
  return note ?? trimmed.toLocaleLowerCase("fr");
}

export function gradeExercise(exercise: Exercise, answer: unknown): GradeResult {
  const raw = Array.isArray(answer) ? answer : typeof answer === "string" ? [answer] : [];
  const normalized = raw.map(normalizeAnswer);
  if (normalized.length === 0 || normalized.some((item) => item === null)) {
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

  const expected = exercise.correctAnswer.map((item) => normalizeAnswer(item) ?? item);
  const actual = normalized as string[];
  const unordered = exercise.type === "find-accidentals";
  const errors = [];

  if (unordered) {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    for (const item of expectedSet) {
      if (!actualSet.has(item)) errors.push({ expected: item, message: `${formatNote(item)} manque.` });
    }
    for (const item of actualSet) {
      if (!expectedSet.has(item)) errors.push({ actual: item, message: `${formatNote(item)} n’appartient pas à l’armure.` });
    }
    if (actual.length !== actualSet.size) errors.push({ message: "Une altération a été répétée." });
  } else {
    const length = Math.max(actual.length, expected.length);
    for (let index = 0; index < length; index += 1) {
      const expectedItem = expected[index];
      const actualItem = actual[index];
      if (actualItem !== expectedItem) {
        errors.push({
          index,
          ...(expectedItem ? { expected: expectedItem } : {}),
          ...(actualItem ? { actual: actualItem } : {}),
          message: `Position ${index + 1} : attendu ${expectedItem ? formatNote(expectedItem) : "rien"}, reçu ${actualItem ? formatNote(actualItem) : "rien"}.`,
        });
      }
    }
  }

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
  const naturalSemitoneQuestion = identifyInterval(() => (rng() < 0.5 ? 0 : 0.25));
  const scaleTypes: readonly ExerciseType[] = ["complete-scale", "build-scale", "find-accidentals"];
  return {
    id: `daily-${localDateKey(now)}`,
    formulaReminder: "T – T – ½ | T – T – T – ½",
    naturalSemitoneQuestion,
    scaleExercises: scales.map((scale, index) => createExercise(scaleTypes[index] ?? "complete-scale", scale, rng)),
  };
}
