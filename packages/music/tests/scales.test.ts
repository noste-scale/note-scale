import { describe, expect, it } from "vitest";
import {
  generateMajorScale,
  getMajorScale,
  MAJOR_INTERVALS,
  MAJOR_SCALES,
  normalizeNoteId,
  pitchClassOf,
  scalePitchIds,
  type TonicId,
} from "../src";

const GOLDEN: Readonly<Record<TonicId, readonly string[]>> = {
  C: ["C", "D", "E", "F", "G", "A", "B", "C"],
  G: ["G", "A", "B", "C", "D", "E", "F#", "G"],
  D: ["D", "E", "F#", "G", "A", "B", "C#", "D"],
  A: ["A", "B", "C#", "D", "E", "F#", "G#", "A"],
  E: ["E", "F#", "G#", "A", "B", "C#", "D#", "E"],
  B: ["B", "C#", "D#", "E", "F#", "G#", "A#", "B"],
  "F#": ["F#", "G#", "A#", "B", "C#", "D#", "E#", "F#"],
  "C#": ["C#", "D#", "E#", "F#", "G#", "A#", "B#", "C#"],
  F: ["F", "G", "A", "Bb", "C", "D", "E", "F"],
  Bb: ["Bb", "C", "D", "Eb", "F", "G", "A", "Bb"],
  Eb: ["Eb", "F", "G", "Ab", "Bb", "C", "D", "Eb"],
  Ab: ["Ab", "Bb", "C", "Db", "Eb", "F", "G", "Ab"],
  Db: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C", "Db"],
  Gb: ["Gb", "Ab", "Bb", "Cb", "Db", "Eb", "F", "Gb"],
  Cb: ["Cb", "Db", "Eb", "Fb", "Gb", "Ab", "Bb", "Cb"],
};

describe("major-scale generation", () => {
  for (const [tonic, expected] of Object.entries(GOLDEN) as [TonicId, readonly string[]][]) {
    it(`spells ${tonic} major canonically`, () => {
      expect(getMajorScale(tonic).notes).toEqual(expected);
    });
  }

  it("preserves seven diatonic letters and the major interval pattern", () => {
    for (const scale of MAJOR_SCALES) {
      expect(new Set(scale.notes.slice(0, 7).map((note) => note[0])).size).toBe(7);
      const distances = scale.notes.slice(0, -1).map((note, index) => {
        const next = scale.notes[index + 1];
        if (!next) throw new Error("missing note");
        return (pitchClassOf(next) - pitchClassOf(note) + 12) % 12;
      });
      expect(distances).toEqual(MAJOR_INTERVALS);
      expect(scale.notes.at(-1)).toBe(scale.tonic);
      expect(scale.construction).toHaveLength(7);
    }
  });

  it("keeps written enharmonics distinct while sharing pitch", () => {
    expect(pitchClassOf("C#")).toBe(pitchClassOf("Db"));
    expect(getMajorScale("F#").notes).toContain("E#");
    expect(getMajorScale("Cb").notes).toContain("Fb");
  });

  it("normalizes accidental suffix case before returning a typed note", () => {
    expect(normalizeNoteId("DB")).toBe("Db");
    expect(normalizeNoteId("R\u00e9B")).toBe("Db");
    expect(normalizeNoteId("r\u00e9\u266d")).toBe("Db");
    expect(normalizeNoteId("R\u00e9BB")).toBeNull();
  });

  it("returns strictly ascending absolute pitches and their descending reverse", () => {
    const scale = getMajorScale("A");
    expect(scalePitchIds(scale)).toEqual([9, 11, 13, 14, 16, 18, 20, 21]);
    expect(scalePitchIds(scale, "descending")).toEqual([21, 20, 18, 16, 14, 13, 11, 9]);
  });

  it("returns a typed failure and enharmonic suggestion for unsupported tonics", () => {
    expect(generateMajorScale("G#")).toEqual(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: "UNSUPPORTED_TONIC", suggestion: "Ab" }) }),
    );
    expect(generateMajorScale("H")).toEqual(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: "UNSUPPORTED_TONIC" }) }),
    );
  });
});
