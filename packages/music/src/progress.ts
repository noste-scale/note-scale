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
  return {
    version: 1,
    attempts: [],
    reviews: {},
    streak: 0,
    lastTrainingDate: null
  };
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function previousLocalDateKey(date: Date): string {
  const previousLocalDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12);

  return localDateKey(previousLocalDay);
}

function addLocalCalendarDays(date: Date, dayCount: number): Date {
  const futureDate = new Date(date);
  futureDate.setDate(futureDate.getDate() + dayCount);

  return futureDate;
}

function updateReview(
  previous: ReviewRecord | undefined,
  scaleId: TonicId,
  correct: boolean,
  now: Date
): ReviewRecord {
  const stage = correct ? Math.min((previous?.stage ?? -1) + 1, REVIEW_INTERVAL_DAYS.length - 1) : -1;
  const dueAt = correct
    ? addLocalCalendarDays(now, REVIEW_INTERVAL_DAYS[Math.max(0, stage)] ?? 1)
    : new Date(now.getTime() + WRONG_REVIEW_DELAY_MS);

  return {
    scaleId,
    stage,
    dueAt: dueAt.toISOString(),
    lastReviewedAt: now.toISOString()
  };
}

export function recordAttempt(
  state: ProgressState,
  input: RecordAttemptInput,
  now: Date = new Date(),
  rng: RandomSource = Math.random,
): ProgressState {
  const latestTimestamp = state.attempts.reduce((latest, attempt) => {
    const answeredTimestamp = parseValidDate(attempt.answeredAt)?.getTime();

    return answeredTimestamp === undefined ? latest : Math.max(latest, answeredTimestamp);
  }, Number.NEGATIVE_INFINITY);
  const requestedTimestamp = now.getTime();
  let effectiveTimestamp: number;

  if (Number.isFinite(requestedTimestamp)) {
    effectiveTimestamp = Math.max(requestedTimestamp, latestTimestamp + 1);
  } else if (Number.isFinite(latestTimestamp)) {
    effectiveTimestamp = latestTimestamp + 1;
  } else {
    effectiveTimestamp = Date.now();
  }

  const effectiveNow = new Date(effectiveTimestamp);
  const answeredAt = effectiveNow.toISOString();
  const randomValue = rng();
  const boundedRandomValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.9999999999999999)
    : 0;
  const nonce = Math.floor(boundedRandomValue * Number.MAX_SAFE_INTEGER)
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

export function recentScaleAttempts(
  state: ProgressState,
  scaleId: TonicId,
  limit = 6
): readonly Attempt[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

  if (safeLimit === 0) return [];

  return state.attempts.filter((attempt) => attempt.scaleId === scaleId).slice(-safeLimit);
}

export function isScaleMastered(state: ProgressState, scaleId: TonicId): boolean {
  const recentAttempts = recentScaleAttempts(state, scaleId, 6);

  if (recentAttempts.length !== 6) return false;

  const correctAttemptCount = recentAttempts.filter((attempt) => attempt.correct).length;

  return correctAttemptCount >= 5 && recentAttempts.at(-1)?.correct === true;
}

function parseValidDate(value: string): Date | null {
  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function isScaleDue(
  state: ProgressState,
  scaleId: TonicId,
  now: Date = new Date()
): boolean {
  const review = state.reviews[scaleId];
  const dueDate = review ? parseValidDate(review.dueAt) : null;

  return Boolean(dueDate && dueDate.getTime() <= now.getTime());
}

export function summarizeProgress(state: ProgressState, now: Date = new Date()): ProgressSummary {
  const correct = state.attempts.filter((attempt) => attempt.correct).length;
  const mastered = MAJOR_SCALES.filter((scale) => isScaleMastered(state, scale.id)).map((scale) => scale.id);
  const practicedScales = new Set(state.attempts.flatMap((attempt) => (attempt.scaleId ? [attempt.scaleId] : [])));
  const toReview = MAJOR_SCALES.filter((scale) => {
    if (isScaleDue(state, scale.id, now)) return true;

    return practicedScales.has(scale.id)
      && !state.reviews[scale.id]
      && !mastered.includes(scale.id);
  }).map((scale) => scale.id);
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

function calculateWeakness(state: ProgressState, scaleId: TonicId): number {
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
  const rankedScales = MAJOR_SCALES.map((scale, catalogIndex) => {
    const review = state.reviews[scale.id];
    const dueDate = review ? parseValidDate(review.dueAt) : null;
    const isDueNow = Boolean(dueDate && dueDate.getTime() <= now.getTime());
    const attempts = recentScaleAttempts(state, scale.id, 6);
    const isUnseen = attempts.length === 0;
    const isUnscheduled = !review || !dueDate;
    const randomValue = rng();
    let priorityBand = 2;

    if (isDueNow || (!isUnseen && isUnscheduled)) priorityBand = 0;
    else if (isUnseen) priorityBand = 1;

    let reviewDateSortKey: number;

    if (isDueNow) reviewDateSortKey = dueDate?.getTime() ?? 0;
    else if (isUnseen) reviewDateSortKey = 0;
    else reviewDateSortKey = dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return {
      scale,
      priorityBand,
      reviewDateSortKey,
      weakness: calculateWeakness(state, scale.id),
      randomTieBreaker: Number.isFinite(randomValue) ? randomValue : 0,
      catalogIndex,
    };
  });
  rankedScales.sort((left, right) =>
    left.priorityBand - right.priorityBand ||
    left.reviewDateSortKey - right.reviewDateSortKey ||
    right.weakness - left.weakness ||
    left.randomTieBreaker - right.randomTieBreaker ||
    left.catalogIndex - right.catalogIndex,
  );
  const safeCount = Number.isFinite(count) && count > 0
    ? Math.min(Math.floor(count), MAJOR_SCALES.length)
    : 0;

  return rankedScales.slice(0, safeCount).map(({ scale }) => scale);
}

function createAttemptIdentity(attempt: Attempt): string {
  return [attempt.id, attempt.exerciseType, attempt.scaleId ?? "", attempt.correct ? "1" : "0", attempt.answeredAt].join("|");
}

function compareAttempts(left: Attempt, right: Attempt): number {
  const leftTime = parseValidDate(left.answeredAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightTime = parseValidDate(right.answeredAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;

  return leftTime - rightTime
    || left.answeredAt.localeCompare(right.answeredAt)
    || left.id.localeCompare(right.id);
}

export interface AttemptNormalization {
  attempts: readonly Attempt[];
  duplicateCount: number;
  outOfOrder: boolean;
}

export function normalizeProgressAttempts(input: readonly Attempt[]): AttemptNormalization {
  const attemptsById = new Map<string, Attempt>();
  let duplicateCount = 0;
  let outOfOrder = false;

  for (let index = 0; index < input.length; index += 1) {
    const attempt = input[index];
    const previousInputAttempt = input[index - 1];

    if (attempt && previousInputAttempt && compareAttempts(previousInputAttempt, attempt) > 0) outOfOrder = true;
    if (!attempt) continue;

    const existingAttemptWithSameId = attemptsById.get(attempt.id);

    if (existingAttemptWithSameId) {
      duplicateCount += 1;

      if (createAttemptIdentity(attempt) < createAttemptIdentity(existingAttemptWithSameId)) attemptsById.set(attempt.id, attempt);
    } else {
      attemptsById.set(attempt.id, attempt);
    }
  }

  return {
    attempts: [...attemptsById.values()].sort(compareAttempts),
    duplicateCount,
    outOfOrder
  };
}

export function rebuildProgressFromAttempts(input: readonly Attempt[]): ProgressState {
  const { attempts } = normalizeProgressAttempts(input);
  const reviews: Partial<Record<TonicId, ReviewRecord>> = {};
  let streak = 0;
  let lastTrainingDate: string | null = null;

  for (const attempt of attempts) {
    const answeredAt = parseValidDate(attempt.answeredAt);

    if (!answeredAt) continue;
    if (attempt.scaleId) {
      reviews[attempt.scaleId] = updateReview(reviews[attempt.scaleId], attempt.scaleId, attempt.correct, answeredAt);
    }

    const trainingDate = localDateKey(answeredAt);

    if (trainingDate === lastTrainingDate) continue;

    streak = lastTrainingDate === previousLocalDateKey(answeredAt) ? streak + 1 : 1;
    lastTrainingDate = trainingDate;
  }

  return {
    version: 1,
    attempts,
    reviews,
    streak,
    lastTrainingDate
  };
}

export function mergeProgressStates(...states: readonly ProgressState[]): ProgressState {
  if (states.length === 0) return createEmptyProgress();

  return rebuildProgressFromAttempts(states.flatMap(({ attempts }) => attempts));
}
