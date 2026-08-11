export type NoteLetter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type Accidental = "sharp" | "flat" | "natural";
export type NoteId = `${NoteLetter}` | `${NoteLetter}#` | `${NoteLetter}b`;

export type TonicId =
  | "C"
  | "G"
  | "D"
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab"
  | "Db"
  | "Gb"
  | "Cb";

export interface MusicalNote {
  id: NoteId;
  letter: NoteLetter;
  frenchName: string;
  internationalName: string;
  accidental: Accidental;
  displayName: string;
  semitone: number;
}

export type IntervalName = "ton" | "demi-ton";

export interface ConstructionStep {
  index: number;
  currentNote: NoteId;
  interval: IntervalName;
  semitones: 1 | 2;
  expectedLetter: NoteLetter;
  naturalCandidate: NoteId;
  nextNote: NoteId;
  alteration: Accidental;
  explanation: string;
}

export interface MajorScale {
  id: TonicId;
  frenchName: string;
  internationalName: string;
  tonic: TonicId;
  notes: readonly NoteId[];
  accidentals: readonly NoteId[];
  accidentalType: "sharp" | "flat" | "none";
  keySignatureCount: number;
  construction: readonly ConstructionStep[];
}

export interface UnsupportedTonicError {
  code: "UNSUPPORTED_TONIC";
  input: string;
  message: string;
  suggestion?: TonicId;
}

export type ScaleGenerationResult =
  | { ok: true; scale: MajorScale }
  | { ok: false; error: UnsupportedTonicError };

export type ExerciseType =
  | "complete-scale"
  | "build-scale"
  | "find-accidentals"
  | "identify-interval"
  | "find-error";

export interface Exercise {
  id: string;
  type: ExerciseType;
  question: string;
  correctAnswer: readonly string[];
  explanation: string;
  rule: string;
  scaleId?: TonicId;
  promptNotes?: readonly string[];
  options?: readonly string[];
}

export interface AnswerError {
  index?: number;
  expected?: string;
  actual?: string;
  message: string;
}

export interface GradeResult {
  graded: boolean;
  correct: boolean;
  errors: readonly AnswerError[];
  correctAnswer: readonly string[];
  explanation: string;
  rule: string;
  validationMessage?: string;
}

export interface Attempt {
  id: string;
  exerciseType: ExerciseType;
  scaleId?: TonicId;
  correct: boolean;
  answeredAt: string;
}

export interface RecordAttemptInput {
  exerciseType: ExerciseType;
  scaleId?: TonicId;
  correct: boolean;
}

export interface ReviewRecord {
  scaleId: TonicId;
  stage: number;
  dueAt: string;
  lastReviewedAt: string;
}

export interface ProgressState {
  version: 1;
  attempts: readonly Attempt[];
  reviews: Partial<Record<TonicId, ReviewRecord>>;
  streak: number;
  lastTrainingDate: string | null;
}

export interface ProgressSummary {
  total: number;
  correct: number;
  accuracy: number;
  mastered: readonly TonicId[];
  toReview: readonly TonicId[];
  streak: number;
}

export interface DailySession {
  id: string;
  formulaReminder: string;
  naturalSemitoneQuestion: Exercise;
  scaleExercises: readonly Exercise[];
}

export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export interface PersistenceResult {
  state: ProgressState;
  warning: string | null;
  status: "missing" | "valid" | "recovered" | "unreadable" | "incompatible" | "unavailable";
  canSave: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  paragraphs: readonly string[];
  notes?: readonly string[];
}

export type RandomSource = () => number;
