import { MAJOR_SCALES } from "./scale-generator";
import type {
  Attempt,
  MajorScale,
  ProgressState,
  ProgressSummary,
  RandomSource,
  RecordAttemptInput,
  ReviewRecord,
  TonicId,
} from "./types";

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
const WRONG_REVIEW_DELAY_MS = 10 * 60 * 1_000;

export function createEmptyProgress(): ProgressState {
  return { version: 1, attempts: [], reviews: {}, streak: 0, lastTrainingDate: null };
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousLocalDateKey(date: Date): string {
  const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12);
  return localDateKey(previous);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function updateReview(previous: ReviewRecord | undefined, scaleId: TonicId, correct: boolean, now: Date): ReviewRecord {
  const stage = correct ? Math.min((previous?.stage ?? -1) + 1, REVIEW_INTERVAL_DAYS.length - 1) : -1;
  const dueAt = correct
    ? addDays(now, REVIEW_INTERVAL_DAYS[Math.max(0, stage)] ?? 1)
    : new Date(now.getTime() + WRONG_REVIEW_DELAY_MS);
  return { scaleId, stage, dueAt: dueAt.toISOString(), lastReviewedAt: now.toISOString() };
}

export function recordAttempt(
  state: ProgressState,
  input: RecordAttemptInput,
  now: Date = new Date(),
  rng: RandomSource = Math.random,
): ProgressState {
  const latestTimestamp = state.attempts.reduce((latest, attempt) => {
    const parsed = validDate(attempt.answeredAt)?.getTime();
    return parsed === undefined ? latest : Math.max(latest, parsed);
  }, Number.NEGATIVE_INFINITY);
  const requestedTimestamp = now.getTime();
  const effectiveTimestamp = Number.isFinite(requestedTimestamp)
    ? Math.max(requestedTimestamp, latestTimestamp + 1)
    : Number.isFinite(latestTimestamp)
      ? latestTimestamp + 1
      : Date.now();
  const effectiveNow = new Date(effectiveTimestamp);
  const answeredAt = effectiveNow.toISOString();
  const randomValue = rng();
  const nonce = Math.floor(
    (Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.9999999999999999) : 0) * Number.MAX_SAFE_INTEGER,
  )
    .toString(36)
    .padStart(11, "0");
  const attempt: Attempt = {
    id: `${answeredAt}-${nonce}`,
    exerciseType: input.exerciseType,
    ...(input.scaleId ? { scaleId: input.scaleId } : {}),
    correct: input.correct,
    answeredAt,
  };
  return rebuildProgressFromAttempts([...state.attempts, attempt]);
}

export function recentScaleAttempts(state: ProgressState, scaleId: TonicId, limit = 6): readonly Attempt[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  if (safeLimit === 0) return [];
  return state.attempts.filter((attempt) => attempt.scaleId === scaleId).slice(-safeLimit);
}

export function isScaleMastered(state: ProgressState, scaleId: TonicId): boolean {
  const recent = recentScaleAttempts(state, scaleId, 6);
  return recent.length === 6 && recent.filter((attempt) => attempt.correct).length >= 5 && recent.at(-1)?.correct === true;
}

function validDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isScaleDue(state: ProgressState, scaleId: TonicId, now: Date = new Date()): boolean {
  const record = state.reviews[scaleId];
  const due = record ? validDate(record.dueAt) : null;
  return Boolean(due && due.getTime() <= now.getTime());
}

export function summarizeProgress(state: ProgressState, now: Date = new Date()): ProgressSummary {
  const correct = state.attempts.filter((attempt) => attempt.correct).length;
  const mastered = MAJOR_SCALES.filter((scale) => isScaleMastered(state, scale.id)).map((scale) => scale.id);
  const practiced = new Set(state.attempts.flatMap((attempt) => (attempt.scaleId ? [attempt.scaleId] : [])));
  const toReview = MAJOR_SCALES.filter(
    (scale) => isScaleDue(state, scale.id, now) || (practiced.has(scale.id) && !state.reviews[scale.id] && !mastered.includes(scale.id)),
  ).map((scale) => scale.id);
  const today = localDateKey(now);
  const yesterday = previousLocalDateKey(now);
  const streak = state.lastTrainingDate === today || state.lastTrainingDate === yesterday ? state.streak : 0;
  return {
    total: state.attempts.length,
    correct,
    accuracy: state.attempts.length === 0 ? 0 : Math.round((correct / state.attempts.length) * 100),
    mastered,
    toReview,
    streak,
  };
}

function weakness(state: ProgressState, scaleId: TonicId): number {
  const attempts = recentScaleAttempts(state, scaleId, 6);
  if (attempts.length === 0) return -1;
  return 1 - attempts.filter((attempt) => attempt.correct).length / attempts.length;
}

export function selectReviewScales(
  state: ProgressState,
  count: number,
  rng: RandomSource = Math.random,
  now: Date = new Date(),
): readonly MajorScale[] {
  const ranked = MAJOR_SCALES.map((scale, catalogIndex) => {
    const record = state.reviews[scale.id];
    const due = record ? validDate(record.dueAt) : null;
    const dueNow = Boolean(due && due.getTime() <= now.getTime());
    const attempts = recentScaleAttempts(state, scale.id, 6);
    const unseen = attempts.length === 0;
    const unscheduled = !record || !due;
    const randomValue = rng();
    return {
      scale,
      band: dueNow || (!unseen && unscheduled) ? 0 : unseen ? 1 : 2,
      score: dueNow ? due?.getTime() ?? 0 : unseen ? 0 : due?.getTime() ?? Number.MAX_SAFE_INTEGER,
      weakness: weakness(state, scale.id),
      random: Number.isFinite(randomValue) ? randomValue : 0,
      catalogIndex,
    };
  });
  ranked.sort((left, right) =>
    left.band - right.band || left.score - right.score || right.weakness - left.weakness || left.random - right.random || left.catalogIndex - right.catalogIndex,
  );
  const safeCount = Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), MAJOR_SCALES.length) : 0;
  return ranked.slice(0, safeCount).map(({ scale }) => scale);
}

function attemptIdentity(attempt: Attempt): string {
  return [attempt.id, attempt.exerciseType, attempt.scaleId ?? "", attempt.correct ? "1" : "0", attempt.answeredAt].join("|");
}

function compareAttempts(left: Attempt, right: Attempt): number {
  const leftTime = validDate(left.answeredAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightTime = validDate(right.answeredAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || left.answeredAt.localeCompare(right.answeredAt) || left.id.localeCompare(right.id);
}

export interface AttemptNormalization {
  attempts: readonly Attempt[];
  duplicateCount: number;
  outOfOrder: boolean;
}

export function normalizeProgressAttempts(input: readonly Attempt[]): AttemptNormalization {
  const byId = new Map<string, Attempt>();
  let duplicateCount = 0;
  let outOfOrder = false;

  for (let index = 0; index < input.length; index += 1) {
    const attempt = input[index];
    const previousInput = input[index - 1];
    if (attempt && previousInput && compareAttempts(previousInput, attempt) > 0) outOfOrder = true;
    if (!attempt) continue;
    const previous = byId.get(attempt.id);
    if (previous) {
      duplicateCount += 1;
      if (attemptIdentity(attempt) < attemptIdentity(previous)) byId.set(attempt.id, attempt);
    } else {
      byId.set(attempt.id, attempt);
    }
  }

  return { attempts: [...byId.values()].sort(compareAttempts), duplicateCount, outOfOrder };
}

export function rebuildProgressFromAttempts(input: readonly Attempt[]): ProgressState {
  const { attempts } = normalizeProgressAttempts(input);
  const reviews: Partial<Record<TonicId, ReviewRecord>> = {};
  let streak = 0;
  let lastTrainingDate: string | null = null;

  for (const attempt of attempts) {
    const answeredAt = validDate(attempt.answeredAt);
    if (!answeredAt) continue;
    if (attempt.scaleId) {
      reviews[attempt.scaleId] = updateReview(reviews[attempt.scaleId], attempt.scaleId, attempt.correct, answeredAt);
    }
    const trainingDate = localDateKey(answeredAt);
    if (trainingDate === lastTrainingDate) continue;
    streak = lastTrainingDate === previousLocalDateKey(answeredAt) ? streak + 1 : 1;
    lastTrainingDate = trainingDate;
  }

  return { version: 1, attempts, reviews, streak, lastTrainingDate };
}

export function mergeProgressStates(...states: readonly ProgressState[]): ProgressState {
  if (states.length === 0) return createEmptyProgress();
  return rebuildProgressFromAttempts(states.flatMap(({ attempts }) => attempts));
}
