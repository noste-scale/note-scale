import { createEmptyProgress, normalizeProgressAttempts, rebuildProgressFromAttempts } from "./progress";
import { isTonicId } from "./scales";
import type {
  Attempt,
  ExerciseType,
  PersistenceResult,
  ProgressState,
  ReviewRecord,
  StorageAdapter,
  TonicId,
} from "./types";

export const PROGRESS_STORAGE_KEY = "notescale.progress.v1";
const EXERCISE_TYPES = new Set<ExerciseType>([
  "complete-scale",
  "build-scale",
  "find-accidentals",
  "identify-interval",
  "find-error",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function validLocalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function parseAttempt(value: unknown): Attempt | null {
  if (!isObject(value)) return null;
  const { id, exerciseType, scaleId, correct, answeredAt } = value;
  if (
    typeof id !== "string" ||
    id.trim() === "" ||
    typeof exerciseType !== "string" ||
    !EXERCISE_TYPES.has(exerciseType as ExerciseType) ||
    typeof correct !== "boolean" ||
    !validIsoDate(answeredAt) ||
    (scaleId !== undefined && (typeof scaleId !== "string" || !isTonicId(scaleId)))
  ) {
    return null;
  }
  return {
    id,
    exerciseType: exerciseType as ExerciseType,
    ...(typeof scaleId === "string" && isTonicId(scaleId) ? { scaleId } : {}),
    correct,
    answeredAt,
  };
}

function parseReview(key: string, value: unknown): ReviewRecord | null {
  if (!isTonicId(key) || !isObject(value)) return null;
  const { scaleId, stage, dueAt, lastReviewedAt } = value;
  if (
    scaleId !== key ||
    typeof stage !== "number" ||
    !Number.isInteger(stage) ||
    stage < -1 ||
    stage > 4 ||
    !validIsoDate(dueAt) ||
    !validIsoDate(lastReviewedAt)
  ) {
    return null;
  }
  return { scaleId, stage, dueAt, lastReviewedAt } as ReviewRecord;
}

export function encodeProgress(state: ProgressState): string {
  return JSON.stringify(state);
}

export function decodeProgress(raw: string | null): PersistenceResult {
  if (raw === null || raw.trim() === "") {
    return { state: createEmptyProgress(), warning: null, status: "missing", canSave: true };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== 1) {
      return {
        state: createEmptyProgress(),
        warning: "Progression locale incompatible ; les données existantes ont été conservées.",
        status: "incompatible",
        canSave: false,
      };
    }
    const parsedAttempts = Array.isArray(parsed.attempts)
      ? parsed.attempts.map(parseAttempt).filter((item): item is Attempt => item !== null)
      : [];
    const normalizedAttempts = normalizeProgressAttempts(parsedAttempts);
    const attempts = normalizedAttempts.attempts;
    const reviews: Partial<Record<TonicId, ReviewRecord>> = {};
    if (isObject(parsed.reviews)) {
      for (const [key, value] of Object.entries(parsed.reviews)) {
        const record = parseReview(key, value);
        if (record) reviews[record.scaleId] = record;
      }
    }
    const validStreak = typeof parsed.streak === "number" && Number.isInteger(parsed.streak) && parsed.streak >= 0;
    const streak = validStreak ? parsed.streak as number : 0;
    const validTrainingDate = parsed.lastTrainingDate === null || validLocalDate(parsed.lastTrainingDate);
    const lastTrainingDate = validLocalDate(parsed.lastTrainingDate) ? parsed.lastTrainingDate : null;
    const reordered = normalizedAttempts.duplicateCount > 0 || normalizedAttempts.outOfOrder;
    const droppedFields =
      !Array.isArray(parsed.attempts) ||
      parsedAttempts.length !== parsed.attempts.length ||
      normalizedAttempts.duplicateCount > 0 ||
      normalizedAttempts.outOfOrder ||
      !isObject(parsed.reviews) ||
      Object.keys(reviews).length !== Object.keys(parsed.reviews).length ||
      !validStreak ||
      !validTrainingDate;
    const rebuilt = reordered ? rebuildProgressFromAttempts(attempts) : null;
    return {
      state: rebuilt
        ? { ...rebuilt, reviews: { ...reviews, ...rebuilt.reviews } }
        : { version: 1, attempts, reviews, streak, lastTrainingDate },
      warning: reordered
        ? "Des tentatives en double ou hors ordre ont \u00e9t\u00e9 normalis\u00e9es."
        : droppedFields ? "Certaines donn\u00e9es locales invalides ont \u00e9t\u00e9 ignor\u00e9es." : null,
      status: droppedFields ? "recovered" : "valid",
      canSave: true,
    };
  } catch {
    return {
      state: createEmptyProgress(),
      warning: "Progression locale illisible ; les données existantes ont été conservées.",
      status: "unreadable",
      canSave: false,
    };
  }
}

export async function safeLoadProgress(storage: StorageAdapter): Promise<PersistenceResult> {
  try {
    return decodeProgress(await storage.getItem(PROGRESS_STORAGE_KEY));
  } catch {
    return {
      state: createEmptyProgress(),
      warning: "La progression locale n’a pas pu être lue.",
      status: "unavailable",
      canSave: false,
    };
  }
}

export async function safeSaveProgress(storage: StorageAdapter, state: ProgressState): Promise<string | null> {
  try {
    await storage.setItem(PROGRESS_STORAGE_KEY, encodeProgress(state));
    return null;
  } catch {
    return "La progression ne peut pas être enregistrée sur cet appareil.";
  }
}
