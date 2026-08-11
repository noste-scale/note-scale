import { describe, expect, it } from "vitest";
import {
  createEmptyProgress,
  decodeProgress,
  encodeProgress,
  recordAttempt,
  safeLoadProgress,
  safeSaveProgress,
  type StorageAdapter,
} from "../src";

describe("versioned local persistence", () => {
  it("round-trips valid progress", () => {
    const state = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "find-error", scaleId: "Gb", correct: true },
      new Date("2026-08-11T10:00:00.000Z"),
    );
    expect(decodeProgress(encodeProgress(state))).toEqual({
      state,
      warning: null,
      status: "valid",
      canSave: true,
    });
  });

  it.each([
    [null, null, "missing", true],
    ["not-json", "Progression locale illisible", "unreadable", false],
    [JSON.stringify({ version: 0, attempts: [] }), "Progression locale incompatible", "incompatible", false],
  ] as const)("falls back safely for missing, corrupt or old payload %s", (raw, warningStart, status, canSave) => {
    const result = decodeProgress(raw);
    expect(result.state).toEqual(createEmptyProgress());
    if (warningStart) expect(result.warning).toContain(warningStart);
    else expect(result.warning).toBeNull();
    expect(result).toMatchObject({ status, canSave });
  });

  it("keeps valid fields while dropping malformed records", () => {
    const result = decodeProgress(
      JSON.stringify({
        version: 1,
        attempts: [
          { id: "ok", exerciseType: "build-scale", scaleId: "C", correct: true, answeredAt: "2026-08-11T00:00:00.000Z" },
          { id: "bad", exerciseType: "magic", correct: "yes", answeredAt: "never" },
        ],
        reviews: { C: { scaleId: "C", stage: 0, dueAt: "bad", lastReviewedAt: "bad" } },
        streak: 4,
        lastTrainingDate: "2026-08-11",
      }),
    );
    expect(result.state.attempts).toHaveLength(1);
    expect(result.state.streak).toBe(4);
    expect(result).toMatchObject({ status: "recovered", canSave: true });
    expect(result.warning).not.toBeNull();
  });

  it("normalizes impossible local-calendar dates with a warning", () => {
    const result = decodeProgress(
      JSON.stringify({ version: 1, attempts: [], reviews: {}, streak: 9, lastTrainingDate: "2026-99-42" }),
    );
    expect(result.state).toMatchObject({ streak: 9, lastTrainingDate: null });
    expect(result).toMatchObject({ status: "recovered", canSave: true });
    expect(result.warning).not.toBeNull();
  });

  it("accepts only canonical ISO instants and preserves unrelated valid fields", () => {
    const result = decodeProgress(JSON.stringify({
      version: 1,
      attempts: [
        { id: "valid", exerciseType: "build-scale", scaleId: "C", correct: true, answeredAt: "2026-08-11T00:00:00.000Z" },
        { id: "locale", exerciseType: "build-scale", scaleId: "G", correct: true, answeredAt: "8/11/2026" },
        { id: "short-iso", exerciseType: "build-scale", scaleId: "D", correct: true, answeredAt: "2026-08-11T00:00:00Z" },
      ],
      reviews: {
        C: { scaleId: "C", stage: 0, dueAt: "2026-08-12T00:00:00.000Z", lastReviewedAt: "2026-08-11T00:00:00.000Z" },
        G: { scaleId: "G", stage: 0, dueAt: "2026-02-30T00:00:00.000Z", lastReviewedAt: "8/11/2026" },
      },
      streak: "4",
      lastTrainingDate: "11/08/2026",
    }));

    expect(result.state.attempts.map(({ id }) => id)).toEqual(["valid"]);
    expect(Object.keys(result.state.reviews)).toEqual(["C"]);
    expect(result.state).toMatchObject({ streak: 0, lastTrainingDate: null });
    expect(result).toMatchObject({ status: "recovered", canSave: true });
    expect(result.warning).toContain("invalides");
  });

  it("sorts and deduplicates persisted attempts with a recovery warning", () => {
    const later = {
      id: "later",
      exerciseType: "build-scale",
      scaleId: "D",
      correct: true,
      answeredAt: "2026-08-12T00:00:00.000Z",
    };
    const earlier = {
      id: "earlier",
      exerciseType: "find-error",
      scaleId: "C",
      correct: false,
      answeredAt: "2026-08-11T00:00:00.000Z",
    };
    const result = decodeProgress(JSON.stringify({
      version: 1,
      attempts: [later, earlier, earlier],
      reviews: {},
      streak: 2,
      lastTrainingDate: "2026-08-12",
    }));

    expect(result.state.attempts.map(({ id }) => id)).toEqual(["earlier", "later"]);
    expect(result.state).toMatchObject({ streak: 2, lastTrainingDate: "2026-08-12" });
    expect(result.state.reviews).toMatchObject({ C: { stage: -1 }, D: { stage: 0 } });
    expect(result).toMatchObject({ status: "recovered", canSave: true });
    expect(result.warning).not.toBeNull();
  });

  it("turns storage exceptions into recoverable warnings", async () => {
    const storage: StorageAdapter = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("full");
      },
    };
    await expect(safeLoadProgress(storage)).resolves.toEqual({
      state: createEmptyProgress(),
      warning: "La progression locale n’a pas pu être lue.",
      status: "unavailable",
      canSave: false,
    });
    await expect(safeSaveProgress(storage, createEmptyProgress())).resolves.toBe(
      "La progression ne peut pas être enregistrée sur cet appareil.",
    );
  });
});
