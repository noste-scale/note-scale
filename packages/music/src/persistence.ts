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
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value);
}

function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const parsedInstant = new Date(value);

  return !Number.isNaN(parsedInstant.getTime()) && parsedInstant.toISOString() === value;
}

function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedCalendarDay = new Date(Date.UTC(year, month - 1, day));

  return parsedCalendarDay.getUTCFullYear() === year
    && parsedCalendarDay.getUTCMonth() === month - 1
    && parsedCalendarDay.getUTCDate() === day;
}

function parseAttempt(value: unknown): Attempt | null {
  if (!isObject(value)) return null;

  const {
    id,
    exerciseType,
    scaleId,
    correct,
    answeredAt
  } = value;

  if (
    typeof id !== "string" ||
    id.trim() === "" ||
    typeof exerciseType !== "string" ||
    !EXERCISE_TYPES.has(exerciseType as ExerciseType) ||
    typeof correct !== "boolean" ||
    !isCanonicalIsoDate(answeredAt) ||
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
    !isCanonicalIsoDate(dueAt) ||
    !isCanonicalIsoDate(lastReviewedAt)
  ) {
    return null;
  }

  return {
    scaleId,
    stage,
    dueAt,
    lastReviewedAt
  } as ReviewRecord;
}

export function encodeProgress(state: ProgressState): string {
  return JSON.stringify(state);
}

export function decodeProgress(raw: string | null): PersistenceResult {
  if (raw === null || raw.trim() === "") {
    return {
      state: createEmptyProgress(),
      warning: null,
      status: "missing",
      canSave: true
    };
  }

  try {
    const storedProgress: unknown = JSON.parse(raw);

    if (!isObject(storedProgress) || storedProgress.version !== 1) {
      return {
        state: createEmptyProgress(),
        warning: "Progression locale incompatible ; les données existantes ont été conservées.",
        status: "incompatible",
        canSave: false,
      };
    }

    const parsedAttempts = Array.isArray(storedProgress.attempts)
      ? storedProgress.attempts.map(parseAttempt).filter((attempt): attempt is Attempt => attempt !== null)
      : [];
    const normalizedAttempts = normalizeProgressAttempts(parsedAttempts);
    const attempts = normalizedAttempts.attempts;
    const reviews: Partial<Record<TonicId, ReviewRecord>> = {};

    if (isObject(storedProgress.reviews)) {
      for (const [scaleId, storedReview] of Object.entries(storedProgress.reviews)) {
        const review = parseReview(scaleId, storedReview);

        if (review) reviews[review.scaleId] = review;
      }
    }

    const hasValidStreak = typeof storedProgress.streak === "number"
      && Number.isInteger(storedProgress.streak)
      && storedProgress.streak >= 0;
    const streak = hasValidStreak ? storedProgress.streak as number : 0;
    const hasValidTrainingDate = storedProgress.lastTrainingDate === null || isValidLocalDate(storedProgress.lastTrainingDate);
    const lastTrainingDate = isValidLocalDate(storedProgress.lastTrainingDate) ? storedProgress.lastTrainingDate : null;
    const attemptsNeedNormalization = normalizedAttempts.duplicateCount > 0 || normalizedAttempts.outOfOrder;
    const hasInvalidFields =
      !Array.isArray(storedProgress.attempts) ||
      parsedAttempts.length !== storedProgress.attempts.length ||
      normalizedAttempts.duplicateCount > 0 ||
      normalizedAttempts.outOfOrder ||
      !isObject(storedProgress.reviews) ||
      Object.keys(reviews).length !== Object.keys(storedProgress.reviews).length ||
      !hasValidStreak ||
      !hasValidTrainingDate;
    const rebuiltProgress = attemptsNeedNormalization ? rebuildProgressFromAttempts(attempts) : null;
    let warning: string | null = null;

    if (attemptsNeedNormalization) {
      warning = "Des tentatives en double ou hors ordre ont \u00e9t\u00e9 normalis\u00e9es.";
    } else if (hasInvalidFields) {
      warning = "Certaines donn\u00e9es locales invalides ont \u00e9t\u00e9 ignor\u00e9es.";
    }

    return {
      state: rebuiltProgress
        ? {
          ...rebuiltProgress,
          reviews: { ...reviews, ...rebuiltProgress.reviews }
        }
        : {
          version: 1,
          attempts,
          reviews,
          streak,
          lastTrainingDate
        },
      warning,
      status: hasInvalidFields ? "recovered" : "valid",
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
