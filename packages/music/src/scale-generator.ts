import {
  accidentalOf,
  FRENCH_NOTE_NAMES,
  formatNote,
  NATURAL_PITCH_CLASSES,
  normalizeNoteId,
  NOTE_LETTERS,
  noteIdFor,
  pitchClassOf,
} from "./notes";
import { FLAT_ORDER, getScaleMetadata, isTonicId, SCALE_CATALOG, SHARP_ORDER } from "./scales";
import type {
  ConstructionStep,
  MajorScale,
  NoteId,
  NoteLetter,
  ScaleGenerationResult,
  TonicId,
} from "./types";

export const MAJOR_INTERVALS = [2, 2, 1, 2, 2, 2, 1] as const;
export const MAJOR_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12] as const;

const ENHARMONIC_SUGGESTIONS: Readonly<Record<string, TonicId>> = {
  "B#": "C",
  "D#": "Eb",
  "E#": "F",
  Fb: "E",
  "G#": "Ab",
  "A#": "Bb",
};

function findAlteration(targetPitchClass: number, letter: NoteLetter): -1 | 0 | 1 | null {
  let pitchDifference = (targetPitchClass - NATURAL_PITCH_CLASSES[letter] + 12) % 12;
  if (pitchDifference > 6) pitchDifference -= 12;
  return pitchDifference === -1 || pitchDifference === 0 || pitchDifference === 1 ? pitchDifference : null;
}

function createUnsupportedTonicResult(input: string, normalizedTonic: NoteId | null): ScaleGenerationResult {
  const suggestion = normalizedTonic ? ENHARMONIC_SUGGESTIONS[normalizedTonic] : undefined;
  return {
    ok: false,
    error: {
      code: "UNSUPPORTED_TONIC",
      input,
      message: suggestion
        ? `${formatNote(normalizedTonic ?? input, "fr")} n’est pas proposé dans ce MVP. Essaie ${formatNote(suggestion, "fr")}.`
        : "Cette tonique n’est pas prise en charge. Choisis l’une des 15 tonalités proposées.",
      ...(suggestion ? { suggestion } : {}),
    },
  };
}

export function generateMajorScale(input: string): ScaleGenerationResult {
  const normalizedTonic = normalizeNoteId(input);
  if (!normalizedTonic || !isTonicId(normalizedTonic)) return createUnsupportedTonicResult(input, normalizedTonic);

  const tonic = normalizedTonic;
  const tonicLetterIndex = NOTE_LETTERS.indexOf(tonic[0] as NoteLetter);
  const tonicPitchClass = pitchClassOf(tonic);
  const notes: NoteId[] = [];

  for (let index = 0; index < MAJOR_OFFSETS.length; index += 1) {
    if (index === 7) {
      notes.push(tonic);
      continue;
    }
    const letter = NOTE_LETTERS[(tonicLetterIndex + index) % NOTE_LETTERS.length];
    const offset = MAJOR_OFFSETS[index];
    if (!letter || offset === undefined) return createUnsupportedTonicResult(input, normalizedTonic);
    const alteration = findAlteration((tonicPitchClass + offset) % 12, letter);
    if (alteration === null) return createUnsupportedTonicResult(input, normalizedTonic);
    notes.push(noteIdFor(letter, alteration));
  }

  const metadata = getScaleMetadata(tonic);
  const signedAccidentalCount = metadata.signature;
  let accidentals: readonly NoteId[] = [];
  let accidentalType: MajorScale["accidentalType"] = "none";
  if (signedAccidentalCount > 0) {
    accidentals = SHARP_ORDER.slice(0, signedAccidentalCount);
    accidentalType = "sharp";
  } else if (signedAccidentalCount < 0) {
    accidentals = FLAT_ORDER.slice(0, -signedAccidentalCount);
    accidentalType = "flat";
  }
  const construction: ConstructionStep[] = MAJOR_INTERVALS.map((semitones, index) => {
    const currentNote = notes[index];
    const nextNote = notes[index + 1];
    if (!currentNote || !nextNote) throw new Error("Generated scale is incomplete");
    const expectedLetter = nextNote[0] as NoteLetter;
    const alteration = accidentalOf(nextNote);
    const naturalCandidate = noteIdFor(expectedLetter, 0);
    const interval = semitones === 1 ? "demi-ton" : "ton";
    const alterationText =
      alteration === "natural"
        ? `${formatNote(naturalCandidate)} convient sans altération.`
        : `${formatNote(naturalCandidate)} devient ${formatNote(nextNote)} pour respecter la formule.`;
    return {
      index,
      currentNote,
      interval,
      semitones,
      expectedLetter,
      naturalCandidate,
      nextNote,
      alteration,
      explanation: `Depuis ${formatNote(currentNote)}, applique ${interval}. La lettre suivante est ${FRENCH_NOTE_NAMES[expectedLetter]}. ${alterationText}`,
    };
  });

  return {
    ok: true,
    scale: {
      id: tonic,
      tonic,
      frenchName: `${formatNote(tonic)} majeur`,
      internationalName: `${formatNote(tonic, "international")} major`,
      notes,
      accidentals,
      accidentalType,
      keySignatureCount: Math.abs(signedAccidentalCount),
      construction,
    },
  };
}

export function getMajorScale(tonic: TonicId): MajorScale {
  const result = generateMajorScale(tonic);
  if (!result.ok) throw new Error(result.error.message);
  return result.scale;
}

export const MAJOR_SCALES: readonly MajorScale[] = SCALE_CATALOG.map(({ id }) => getMajorScale(id));

export function getScaleById(id: string): MajorScale | undefined {
  const normalizedTonic = normalizeNoteId(id);
  return normalizedTonic && isTonicId(normalizedTonic) ? MAJOR_SCALES.find((scale) => scale.id === normalizedTonic) : undefined;
}

export function scalePitchIds(scale: MajorScale, direction: "ascending" | "descending" = "ascending"): readonly number[] {
  let previousPitch = -1;
  const pitches = scale.notes.map((note) => {
    let pitch = pitchClassOf(note);
    while (pitch <= previousPitch) pitch += 12;
    previousPitch = pitch;
    return pitch;
  });
  return direction === "ascending" ? pitches : [...pitches].reverse();
}
