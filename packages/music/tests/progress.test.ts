import { describe, expect, it } from "vitest";
import {
  createEmptyProgress,
  isScaleMastered,
  mergeProgressStates,
  recentScaleAttempts,
  recordAttempt,
  REVIEW_INTERVAL_DAYS,
  selectReviewScales,
  summarizeProgress,
  type ProgressState,
} from "../src";

describe("progress and spaced review", () => {
  it("masters exactly when at least five of six recent attempts and latest are correct", () => {
    let progress = createEmptyProgress();
    [true, true, false, true, true, true].forEach((correct, index) => {
      progress = recordAttempt(
        progress,
        { exerciseType: "build-scale", scaleId: "D", correct },
        new Date(2026, 7, 1 + index, 10),
      );
    });
    expect(isScaleMastered(progress, "D")).toBe(true);
    expect(summarizeProgress(progress).mastered).toContain("D");

    progress = recordAttempt(
      progress,
      { exerciseType: "build-scale", scaleId: "D", correct: false },
      new Date(2026, 7, 8, 10),
    );
    expect(isScaleMastered(progress, "D")).toBe(false);
    expect(summarizeProgress(progress).toReview).toContain("D");
  });

  it("schedules successes at 1/3/7/14/30 days and wrong answers soon", () => {
    let progress = createEmptyProgress();
    for (let index = 0; index < REVIEW_INTERVAL_DAYS.length; index += 1) {
      const now = new Date(Date.UTC(2026, 7, 1 + index, 12));
      progress = recordAttempt(progress, { exerciseType: "complete-scale", scaleId: "A", correct: true }, now);
      const review = progress.reviews.A;
      expect(review?.stage).toBe(index);
      expect(new Date(review?.dueAt ?? 0).getTime() - now.getTime()).toBe(REVIEW_INTERVAL_DAYS[index]! * 86_400_000);
    }
    const wrongAt = new Date("2026-09-01T12:00:00.000Z");
    progress = recordAttempt(progress, { exerciseType: "complete-scale", scaleId: "A", correct: false }, wrongAt);
    expect(progress.reviews.A?.stage).toBe(-1);
    expect(new Date(progress.reviews.A?.dueAt ?? 0).getTime() - wrongAt.getTime()).toBe(10 * 60_000);
  });

  it("counts at most one streak day and handles local-calendar boundaries", () => {
    let progress = createEmptyProgress();
    progress = recordAttempt(progress, { exerciseType: "identify-interval", correct: true }, new Date(2026, 7, 10, 23, 59));
    progress = recordAttempt(progress, { exerciseType: "identify-interval", correct: true }, new Date(2026, 7, 10, 23, 59, 30));
    expect(progress.streak).toBe(1);
    progress = recordAttempt(progress, { exerciseType: "identify-interval", correct: true }, new Date(2026, 7, 11, 0, 1));
    expect(progress.streak).toBe(2);
    progress = recordAttempt(progress, { exerciseType: "identify-interval", correct: true }, new Date(2026, 7, 13, 9));
    expect(progress.streak).toBe(1);
  });

  it("reports total, correct and rounded accuracy", () => {
    let progress = createEmptyProgress();
    progress = recordAttempt(progress, { exerciseType: "identify-interval", correct: true }, new Date());
    progress = recordAttempt(progress, { exerciseType: "identify-interval", correct: false }, new Date());
    progress = recordAttempt(progress, { exerciseType: "identify-interval", correct: true }, new Date());
    expect(summarizeProgress(progress)).toMatchObject({ total: 3, correct: 2, accuracy: 67 });
  });

  it("falls back deterministically when review dates and RNG values are invalid", () => {
    const malformed = {
      ...createEmptyProgress(),
      reviews: {
        Eb: { scaleId: "Eb", stage: 0, dueAt: "not-a-date", lastReviewedAt: "not-a-date" },
      },
    } as ProgressState;
    const first = selectReviewScales(malformed, 3, () => Number.NaN, new Date("2026-08-11T00:00:00Z"));
    const second = selectReviewScales(malformed, 3, () => Number.NaN, new Date("2026-08-11T00:00:00Z"));
    expect(first.map(({ id }) => id)).toEqual(second.map(({ id }) => id));
    expect(new Set(first.map(({ id }) => id)).size).toBe(3);
  });

  it("treats nonpositive and nonfinite recent-attempt limits as empty", () => {
    const progress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: true },
      new Date("2026-08-11T10:00:00.000Z"),
    );
    for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(recentScaleAttempts(progress, "C", limit)).toEqual([]);
    }
  });

  it("defers future reviews while prioritizing due and unseen scales", () => {
    const now = new Date("2026-08-11T12:00:00.000Z");
    let progress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: false },
      new Date(now.getTime() - 20 * 60_000),
    );
    progress = recordAttempt(progress, { exerciseType: "build-scale", scaleId: "G", correct: true }, now);

    expect(summarizeProgress(progress, now).toReview).toContain("C");
    expect(summarizeProgress(progress, now).toReview).not.toContain("G");
    const selected = selectReviewScales(progress, 3, () => 0, now).map(({ id }) => id);
    expect(selected[0]).toBe("C");
    expect(selected).not.toContain("G");
  });

  it("resets only the displayed streak after a missed local day", () => {
    const trained = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "identify-interval", correct: true },
      new Date(2026, 7, 8, 9),
    );
    expect(summarizeProgress(trained, new Date(2026, 7, 9, 23)).streak).toBe(1);
    expect(summarizeProgress(trained, new Date(2026, 7, 10, 0, 1)).streak).toBe(0);
    expect(trained.streak).toBe(1);
  });

  it("merges concurrent progress without losing or duplicating attempts", () => {
    const base = createEmptyProgress();
    const left = recordAttempt(
      base,
      { exerciseType: "build-scale", scaleId: "C", correct: true },
      new Date("2026-08-11T10:00:00.000Z"),
    );
    const right = recordAttempt(
      base,
      { exerciseType: "find-error", scaleId: "D", correct: false },
      new Date("2026-08-11T10:01:00.000Z"),
    );
    const merged = mergeProgressStates(base, left, right, left);
    expect(merged.attempts).toHaveLength(2);
    expect(merged.reviews).toHaveProperty("C");
    expect(merged.reviews).toHaveProperty("D");
    expect(merged.lastTrainingDate).toBe(left.lastTrainingDate);
  });

  it("keeps distinct concurrent attempts with otherwise identical fields", () => {
    const now = new Date("2026-08-11T10:00:00.000Z");
    const input = { exerciseType: "build-scale", scaleId: "C", correct: true } as const;
    const left = recordAttempt(createEmptyProgress(), input, now, () => 0.1);
    const right = recordAttempt(createEmptyProgress(), input, now, () => 0.2);
    expect(left.attempts[0]?.id).not.toBe(right.attempts[0]?.id);
    expect(mergeProgressStates(left, right).attempts).toHaveLength(2);
  });

  it("replays concurrent same-scale branches so every review advances the stage", () => {
    const input = { exerciseType: "build-scale", scaleId: "C", correct: true } as const;
    const base = recordAttempt(createEmptyProgress(), input, new Date("2026-08-10T10:00:00.000Z"), () => 0.1);
    const left = recordAttempt(base, input, new Date("2026-08-11T10:00:00.000Z"), () => 0.2);
    const right = recordAttempt(base, input, new Date("2026-08-12T10:00:00.000Z"), () => 0.3);
    const merged = mergeProgressStates(left, right);

    expect(merged.attempts).toHaveLength(3);
    expect(merged.reviews.C).toMatchObject({ stage: 2, lastReviewedAt: "2026-08-12T10:00:00.000Z" });
    expect(merged.reviews.C?.dueAt).toBe("2026-08-19T10:00:00.000Z");
  });

  it("replays merged calendar days so concurrent branches preserve the streak", () => {
    const input = { exerciseType: "identify-interval", correct: true } as const;
    const base = recordAttempt(createEmptyProgress(), input, new Date(2026, 7, 10, 10), () => 0.1);
    const left = recordAttempt(base, input, new Date(2026, 7, 11, 10), () => 0.2);
    const right = recordAttempt(base, input, new Date(2026, 7, 12, 10), () => 0.3);
    const merged = mergeProgressStates(left, right);

    expect(merged).toMatchObject({ streak: 3, lastTrainingDate: "2026-08-12" });
  });

  it("clamps a backward clock after the latest valid attempt", () => {
    const first = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "D", correct: true },
      new Date("2026-08-11T10:00:00.000Z"),
      () => 0.1,
    );
    const second = recordAttempt(
      first,
      { exerciseType: "build-scale", scaleId: "D", correct: false },
      new Date("2026-08-11T09:00:00.000Z"),
      () => 0.1,
    );

    expect(new Date(second.attempts[1]!.answeredAt).getTime()).toBeGreaterThan(
      new Date(second.attempts[0]!.answeredAt).getTime(),
    );
    expect(second.reviews.D?.lastReviewedAt).toBe(second.attempts[1]!.answeredAt);
  });
});
