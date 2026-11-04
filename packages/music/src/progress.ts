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
const RECENT_ATTEMPT_WINDOW = 6;
const MASTERY_CORRECT_ATTEMPT_COUNT = 5;

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

function findLatestAnswerTimestamp(attempts: readonly Attempt[]): number {
  return attempts.reduce((latest, attempt) => {
    const answeredTimestamp = parseValidDate(attempt.answeredAt)?.getTime();

    return answeredTimestamp === undefined ? latest : Math.max(latest, answeredTimestamp);
  }, Number.NEGATIVE_INFINITY);
}

// Answers stay strictly ordered, even when the clock is invalid or moves backwards.
function chooseAnswerTimestamp(attempts: readonly Attempt[], now: Date): number {
  const latestTimestamp = findLatestAnswerTimestamp(attempts);
  const requestedTimestamp = now.getTime();

  if (Number.isFinite(requestedTimestamp)) return Math.max(requestedTimestamp, latestTimestamp + 1);
  if (Number.isFinite(latestTimestamp)) return latestTimestamp + 1;

  return Date.now();
}

function createAttemptNonce(rng: RandomSource): string {
  const randomValue = rng();
  const boundedRandomValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.9999999999999999)
    : 0;

  return Math.floor(boundedRandomValue * Number.MAX_SAFE_INTEGER)
    .toString(36)
    .padStart(11, "0");
}

export function recordAttempt(
  state: ProgressState,
  input: RecordAttemptInput,
  now: Date = new Date(),
  rng: RandomSource = Math.random,
): ProgressState {
  const answeredAt = new Date(chooseAnswerTimestamp(state.attempts, now)).toISOString();
  const attempt: Attempt = {
    id: `${answeredAt}-${createAttemptNonce(rng)}`,
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
  limit = RECENT_ATTEMPT_WINDOW
): readonly Attempt[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

  if (safeLimit === 0) return [];

  return state.attempts.filter((attempt) => attempt.scaleId === scaleId).slice(-safeLimit);
}

export function isScaleMastered(state: ProgressState, scaleId: TonicId): boolean {
  const recentAttempts = recentScaleAttempts(state, scaleId);

  if (recentAttempts.length !== RECENT_ATTEMPT_WINDOW) return false;

  const correctAttemptCount = recentAttempts.filter((attempt) => attempt.correct).length;

  return correctAttemptCount >= MASTERY_CORRECT_ATTEMPT_COUNT && recentAttempts.at(-1)?.correct === true;
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
  const attempts = recentScaleAttempts(state, scaleId);

  if (attempts.length === 0) return -1;

  return 1 - attempts.filter((attempt) => attempt.correct).length / attempts.length;
}

interface ReviewRanking {
  scale: MajorScale;
  priorityBand: number;
  reviewDateSortKey: number;
  weakness: number;
  randomTieBreaker: number;
  catalogIndex: number;
}

interface ReviewStatus {
  dueDate: Date | null;
  isDueNow: boolean;
  isUnseen: boolean;
  isUnscheduled: boolean;
}

function describeReviewStatus(state: ProgressState, scaleId: TonicId, now: Date): ReviewStatus {
  const review = state.reviews[scaleId];
  const dueDate = review ? parseValidDate(review.dueAt) : null;

  return {
    dueDate,
    isDueNow: Boolean(dueDate && dueDate.getTime() <= now.getTime()),
    isUnseen: recentScaleAttempts(state, scaleId).length === 0,
    isUnscheduled: !review || !dueDate,
  };
}

// Due or unscheduled practiced scales first, then unseen scales, then scales scheduled later.
function choosePriorityBand({ isDueNow, isUnseen, isUnscheduled }: ReviewStatus): number {
  if (isDueNow || (!isUnseen && isUnscheduled)) return 0;
  if (isUnseen) return 1;

  return 2;
}

function chooseReviewDateSortKey({ dueDate, isDueNow, isUnseen }: ReviewStatus): number {
  if (isDueNow) return dueDate?.getTime() ?? 0;
  if (isUnseen) return 0;

  return dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function rankScaleForReview(
  state: ProgressState,
  scale: MajorScale,
  catalogIndex: number,
  rng: RandomSource,
  now: Date,
): ReviewRanking {
  const reviewStatus = describeReviewStatus(state, scale.id, now);
  const randomValue = rng();

  return {
    scale,
    priorityBand: choosePriorityBand(reviewStatus),
    reviewDateSortKey: chooseReviewDateSortKey(reviewStatus),
    weakness: calculateWeakness(state, scale.id),
    randomTieBreaker: Number.isFinite(randomValue) ? randomValue : 0,
    catalogIndex,
  };
}

function compareReviewRankings(left: ReviewRanking, right: ReviewRanking): number {
  return left.priorityBand - right.priorityBand
    || left.reviewDateSortKey - right.reviewDateSortKey
    || right.weakness - left.weakness
    || left.randomTieBreaker - right.randomTieBreaker
    || left.catalogIndex - right.catalogIndex;
}

export function selectReviewScales(
  state: ProgressState,
  count: number,
  rng: RandomSource = Math.random,
  now: Date = new Date(),
): readonly MajorScale[] {
  const rankedScales = MAJOR_SCALES
    .map((scale, catalogIndex) => rankScaleForReview(state, scale, catalogIndex, rng, now))
    .sort(compareReviewRankings);
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
