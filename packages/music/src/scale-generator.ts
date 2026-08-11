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

function alterationFor(targetPitch: number, letter: NoteLetter): -1 | 0 | 1 | null {
  let delta = (targetPitch - NATURAL_PITCH_CLASSES[letter] + 12) % 12;
  if (delta > 6) delta -= 12;
  return delta === -1 || delta === 0 || delta === 1 ? delta : null;
}

function unsupported(input: string, normalized: NoteId | null): ScaleGenerationResult {
  const suggestion = normalized ? ENHARMONIC_SUGGESTIONS[normalized] : undefined;
  return {
    ok: false,
    error: {
      code: "UNSUPPORTED_TONIC",
      input,
      message: suggestion
        ? `${formatNote(normalized ?? input, "fr")} n’est pas proposé dans ce MVP. Essaie ${formatNote(suggestion, "fr")}.`
        : "Cette tonique n’est pas prise en charge. Choisis l’une des 15 tonalités proposées.",
      ...(suggestion ? { suggestion } : {}),
    },
  };
}

export function generateMajorScale(input: string): ScaleGenerationResult {
  const normalized = normalizeNoteId(input);
  if (!normalized || !isTonicId(normalized)) return unsupported(input, normalized);

  const tonic = normalized;
  const tonicLetterIndex = NOTE_LETTERS.indexOf(tonic[0] as NoteLetter);
  const tonicPitch = pitchClassOf(tonic);
  const notes: NoteId[] = [];

  for (let index = 0; index < MAJOR_OFFSETS.length; index += 1) {
    if (index === 7) {
      notes.push(tonic);
      continue;
    }
    const letter = NOTE_LETTERS[(tonicLetterIndex + index) % NOTE_LETTERS.length];
    const offset = MAJOR_OFFSETS[index];
    if (!letter || offset === undefined) return unsupported(input, normalized);
    const alteration = alterationFor((tonicPitch + offset) % 12, letter);
    if (alteration === null) return unsupported(input, normalized);
    notes.push(noteIdFor(letter, alteration));
  }

  const metadata = getScaleMetadata(tonic);
  const signature = metadata.signature;
  const accidentals = signature > 0 ? SHARP_ORDER.slice(0, signature) : signature < 0 ? FLAT_ORDER.slice(0, -signature) : [];
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
      accidentalType: signature > 0 ? "sharp" : signature < 0 ? "flat" : "none",
      keySignatureCount: Math.abs(signature),
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
  const normalized = normalizeNoteId(id);
  return normalized && isTonicId(normalized) ? MAJOR_SCALES.find((scale) => scale.id === normalized) : undefined;
}

export function scalePitchIds(scale: MajorScale, direction: "ascending" | "descending" = "ascending"): readonly number[] {
  let previous = -1;
  const pitches = scale.notes.map((note) => {
    let pitch = pitchClassOf(note);
    while (pitch <= previous) pitch += 12;
    previous = pitch;
    return pitch;
  });
  return direction === "ascending" ? pitches : [...pitches].reverse();
}
