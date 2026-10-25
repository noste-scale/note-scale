import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  createEmptyProgress,
  decodeProgress,
  encodeProgress,
  recordAttempt,
} from "@notescale/music";
import { loadBrowserProgress, mergeStorageUpdate, saveBrowserProgress, storageEventUpdate } from "./storage";

afterEach(() => vi.unstubAllGlobals());

describe("browser persistence adapter", () => {
  it("guards a denied localStorage getter", async () => {
    const windowWithDeniedStorage = Object.defineProperty({}, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
    vi.stubGlobal("window", windowWithDeniedStorage);
    const loadedProgress = await loadBrowserProgress();
    expect(loadedProgress.status).toBe("unavailable");
    expect(loadedProgress.canSave).toBe(false);
  });

  it.each([
    ["unreadable", "not json"],
    ["incompatible", JSON.stringify({ version: 2, attempts: ["keep me"] })],
  ])("does not overwrite %s stored data", async (status, initialPayload) => {
    let storedPayload = initialPayload;
    const storage = {
      getItem: () => storedPayload,
      setItem: (_key: string, value: string) => {
        storedPayload = value;
      },
    };
    const loadedProgress = await loadBrowserProgress(storage);
    expect(loadedProgress.status).toBe(status);
    expect(loadedProgress.canSave).toBe(false);
    const saveResult = await saveBrowserProgress(createEmptyProgress(), storage);
    expect(saveResult.saved).toBe(false);
    expect(storedPayload).toBe(initialPayload);
  });

  it("merges stored and current attempts before the last writer saves", async () => {
    const storedProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: true },
      new Date("2026-08-10T10:00:00Z"),
    );
    const currentProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "find-error", scaleId: "G", correct: false },
      new Date("2026-08-11T10:00:00Z"),
    );
    let storedPayload = encodeProgress(storedProgress);
    let writtenKey = "";
    const storage = {
      getItem: () => storedPayload,
      setItem: (key: string, value: string) => {
        writtenKey = key;
        storedPayload = value;
      },
    };
    const saveResult = await saveBrowserProgress(currentProgress, storage);
    expect(saveResult.saved).toBe(true);
    expect(saveResult.state.attempts).toHaveLength(2);
    expect(decodeProgress(storedPayload).state.attempts).toHaveLength(2);
    expect(writtenKey).toBe(PROGRESS_STORAGE_KEY);
  });

  it("merges a same-origin storage update without duplicating attempts", () => {
    const firstProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: true },
      new Date("2026-08-10T10:00:00Z"),
    );
    const secondProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "find-error", scaleId: "G", correct: false },
      new Date("2026-08-11T10:00:00Z"),
    );
    const firstMerge = mergeStorageUpdate(firstProgress, encodeProgress(secondProgress));
    const repeatedMerge = mergeStorageUpdate(firstMerge.state, encodeProgress(secondProgress));
    expect(firstMerge.canSave).toBe(true);
    expect(firstMerge.state.attempts).toHaveLength(2);
    expect(repeatedMerge.state.attempts).toHaveLength(2);
  });

  it("treats progress deletion and localStorage.clear as authoritative resets", () => {
    const currentProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: true },
    );
    for (const key of [PROGRESS_STORAGE_KEY, null]) {
      const update = storageEventUpdate(currentProgress, key, null);
      expect(update).toMatchObject({ reset: true, needsSave: false, canSave: true, status: "missing" });
      expect(update?.state).toEqual(createEmptyProgress());
    }
    expect(storageEventUpdate(currentProgress, "notescale.theme", null)).toBeUndefined();
  });

  it("keeps ordinary cross-tab updates merged and stable across save/reload", async () => {
    const firstProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "build-scale", scaleId: "C", correct: true },
      new Date("2026-08-10T10:00:00Z"),
    );
    const secondProgress = recordAttempt(
      createEmptyProgress(),
      { exerciseType: "find-error", scaleId: "G", correct: false },
      new Date("2026-08-11T10:00:00Z"),
    );
    const update = storageEventUpdate(firstProgress, PROGRESS_STORAGE_KEY, encodeProgress(secondProgress));
    expect(update).toMatchObject({ reset: false, needsSave: true, canSave: true });
    expect(update?.state.attempts).toHaveLength(2);
    expect(storageEventUpdate(update!.state, PROGRESS_STORAGE_KEY, encodeProgress(update!.state))).toMatchObject({ needsSave: false });
    let storedPayload: string | null = null;
    const storage = {
      getItem: () => storedPayload,
      setItem: (_key: string, value: string) => {
        storedPayload = value;
      },
    };
    expect((await saveBrowserProgress(update!.state, storage)).saved).toBe(true);
    expect((await loadBrowserProgress(storage)).state.attempts).toHaveLength(2);
    expect((await saveBrowserProgress(update!.state, storage)).state.attempts).toHaveLength(2);
  });

  it("keeps write failures recoverable", async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
    };
    const saveResult = await saveBrowserProgress(createEmptyProgress(), storage);
    expect(saveResult.saved).toBe(false);
    expect(saveResult.warning).toContain("ne peut pas être enregistrée");
  });
});
