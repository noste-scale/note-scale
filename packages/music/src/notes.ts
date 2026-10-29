import type { Accidental, MusicalNote, NoteId, NoteLetter } from "./types";

export const NOTE_LETTERS: readonly NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];

export const NATURAL_PITCH_CLASSES: Readonly<Record<NoteLetter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const FRENCH_NOTE_NAMES: Readonly<Record<NoteLetter, string>> = {
  C: "Do",
  D: "Ré",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si",
};

const FRENCH_TO_INTERNATIONAL = new Map(
  Object.entries(FRENCH_NOTE_NAMES).map(([letter, frenchName]) => [frenchName.toLocaleLowerCase("fr"), letter]),
);

export function normalizeNoteId(value: string): NoteId | null {
  const normalizedInput = value.trim().replaceAll("♯", "#").replaceAll("♭", "b");
  const internationalMatch = /^([a-g])([#b]?)$/i.exec(normalizedInput);
  if (internationalMatch) {
    const letter = internationalMatch[1]?.toUpperCase();
    const accidentalSuffix = (internationalMatch[2] ?? "").toLowerCase();
    return `${letter}${accidentalSuffix}` as NoteId;
  }

  const frenchMatch = /^(do|ré|re|mi|fa|sol|la|si)([#b]?)$/iu.exec(normalizedInput);
  if (!frenchMatch) return null;
  const normalizedName = frenchMatch[1]?.toLocaleLowerCase("fr").replace("re", "ré");
  const letter = normalizedName ? FRENCH_TO_INTERNATIONAL.get(normalizedName) : undefined;
  const accidentalSuffix = (frenchMatch[2] ?? "").toLowerCase();
  return letter ? (`${letter}${accidentalSuffix}` as NoteId) : null;
}

export function accidentalOf(noteId: NoteId): Accidental {
  if (noteId.endsWith("#")) return "sharp";
  if (noteId.endsWith("b")) return "flat";
  return "natural";
}

export function pitchClassOf(noteId: NoteId): number {
  const letter = noteId[0] as NoteLetter;
  let alteration = 0;
  if (noteId.endsWith("#")) alteration = 1;
  else if (noteId.endsWith("b")) alteration = -1;
  return (NATURAL_PITCH_CLASSES[letter] + alteration + 12) % 12;
}

export function toMusicalNote(noteId: NoteId): MusicalNote {
  return {
    id: noteId,
    letter: noteId[0] as NoteLetter,
    frenchName: formatNote(noteId, "fr"),
    internationalName: formatNote(noteId, "international"),
    accidental: accidentalOf(noteId),
    displayName: formatNote(noteId, "fr"),
    semitone: pitchClassOf(noteId),
  };
}

export function formatNote(noteId: string, locale: "fr" | "international" = "fr"): string {
  const normalizedNote = normalizeNoteId(noteId);
  if (!normalizedNote) return noteId;
  const letter = normalizedNote[0] as NoteLetter;
  let accidentalSymbol = "";
  if (normalizedNote.endsWith("#")) accidentalSymbol = "♯";
  else if (normalizedNote.endsWith("b")) accidentalSymbol = "♭";
  const noteName = locale === "fr" ? FRENCH_NOTE_NAMES[letter] : letter;
  return `${noteName}${accidentalSymbol}`;
}

export function noteIdFor(letter: NoteLetter, alteration: -1 | 0 | 1): NoteId {
  let accidentalSuffix = "";
  if (alteration === 1) accidentalSuffix = "#";
  else if (alteration === -1) accidentalSuffix = "b";
  return `${letter}${accidentalSuffix}` as NoteId;
}
