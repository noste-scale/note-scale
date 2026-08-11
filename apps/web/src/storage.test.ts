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
    const denied = Object.defineProperty({}, "localStorage", { get() { throw new Error("denied"); } });
    vi.stubGlobal("window", denied);
    const loaded = await loadBrowserProgress();
    expect(loaded.status).toBe("unavailable");
    expect(loaded.canSave).toBe(false);
  });

  it.each([
    ["unreadable", "not json"],
    ["incompatible", JSON.stringify({ version: 2, attempts: ["keep me"] })],
  ])("does not overwrite %s stored data", async (status, initial) => {
    let raw = initial;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const loaded = await loadBrowserProgress(storage);
    expect(loaded.status).toBe(status);
    expect(loaded.canSave).toBe(false);
    const saved = await saveBrowserProgress(createEmptyProgress(), storage);
    expect(saved.saved).toBe(false);
    expect(raw).toBe(initial);
  });

  it("merges stored and current attempts before the last writer saves", async () => {
    const stored = recordAttempt(createEmptyProgress(), { exerciseType: "build-scale", scaleId: "C", correct: true }, new Date("2026-08-10T10:00:00Z"));
    const current = recordAttempt(createEmptyProgress(), { exerciseType: "find-error", scaleId: "G", correct: false }, new Date("2026-08-11T10:00:00Z"));
    let raw = encodeProgress(stored); let writtenKey = "";
    const storage = { getItem: () => raw, setItem: (key: string, value: string) => { writtenKey = key; raw = value; } };
    const saved = await saveBrowserProgress(current, storage);
    expect(saved.saved).toBe(true);
    expect(saved.state.attempts).toHaveLength(2);
    expect(decodeProgress(raw).state.attempts).toHaveLength(2);
    expect(writtenKey).toBe(PROGRESS_STORAGE_KEY);
  });

  it("merges a same-origin storage update without duplicating attempts", () => {
    const first = recordAttempt(createEmptyProgress(), { exerciseType: "build-scale", scaleId: "C", correct: true }, new Date("2026-08-10T10:00:00Z"));
    const second = recordAttempt(createEmptyProgress(), { exerciseType: "find-error", scaleId: "G", correct: false }, new Date("2026-08-11T10:00:00Z"));
    const once = mergeStorageUpdate(first, encodeProgress(second));
    const twice = mergeStorageUpdate(once.state, encodeProgress(second));
    expect(once.canSave).toBe(true);
    expect(once.state.attempts).toHaveLength(2);
    expect(twice.state.attempts).toHaveLength(2);
  });

  it("treats progress deletion and localStorage.clear as authoritative resets", () => {
    const current = recordAttempt(createEmptyProgress(), { exerciseType: "build-scale", scaleId: "C", correct: true });
    for (const key of [PROGRESS_STORAGE_KEY, null]) {
      const update = storageEventUpdate(current, key, null);
      expect(update).toMatchObject({ reset: true, needsSave: false, canSave: true, status: "missing" });
      expect(update?.state).toEqual(createEmptyProgress());
    }
    expect(storageEventUpdate(current, "notescale.theme", null)).toBeUndefined();
  });

  it("keeps ordinary cross-tab updates merged and stable across save/reload", async () => {
    const first = recordAttempt(createEmptyProgress(), { exerciseType: "build-scale", scaleId: "C", correct: true }, new Date("2026-08-10T10:00:00Z"));
    const second = recordAttempt(createEmptyProgress(), { exerciseType: "find-error", scaleId: "G", correct: false }, new Date("2026-08-11T10:00:00Z"));
    const update = storageEventUpdate(first, PROGRESS_STORAGE_KEY, encodeProgress(second));
    expect(update).toMatchObject({ reset: false, needsSave: true, canSave: true });
    expect(update?.state.attempts).toHaveLength(2);
    expect(storageEventUpdate(update!.state, PROGRESS_STORAGE_KEY, encodeProgress(update!.state))).toMatchObject({ needsSave: false });
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    expect((await saveBrowserProgress(update!.state, storage)).saved).toBe(true);
    expect((await loadBrowserProgress(storage)).state.attempts).toHaveLength(2);
    expect((await saveBrowserProgress(update!.state, storage)).state.attempts).toHaveLength(2);
  });

  it("keeps write failures recoverable", async () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("full"); } };
    const saved = await saveBrowserProgress(createEmptyProgress(), storage);
    expect(saved.saved).toBe(false);
    expect(saved.warning).toContain("ne peut pas être enregistrée");
  });
});
