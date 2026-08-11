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

const INTERNATIONAL_TO_FRENCH = new Map(Object.entries(FRENCH_NOTE_NAMES).map(([letter, name]) => [name.toLocaleLowerCase("fr"), letter]));

export function normalizeNoteId(value: string): NoteId | null {
  const trimmed = value.trim().replaceAll("♯", "#").replaceAll("♭", "b");
  const international = /^([a-g])([#b]?)$/i.exec(trimmed);
  if (international) {
    const letter = international[1]?.toUpperCase();
    const suffix = (international[2] ?? "").toLowerCase();
    return `${letter}${suffix}` as NoteId;
  }

  const french = /^(do|ré|re|mi|fa|sol|la|si)([#b]?)$/iu.exec(trimmed);
  if (!french) return null;
  const normalizedName = french[1]?.toLocaleLowerCase("fr").replace("re", "ré");
  const letter = normalizedName ? INTERNATIONAL_TO_FRENCH.get(normalizedName) : undefined;
  const suffix = (french[2] ?? "").toLowerCase();
  return letter ? (`${letter}${suffix}` as NoteId) : null;
}

export function accidentalOf(noteId: NoteId): Accidental {
  return noteId.endsWith("#") ? "sharp" : noteId.endsWith("b") ? "flat" : "natural";
}

export function pitchClassOf(noteId: NoteId): number {
  const letter = noteId[0] as NoteLetter;
  const delta = noteId.endsWith("#") ? 1 : noteId.endsWith("b") ? -1 : 0;
  return (NATURAL_PITCH_CLASSES[letter] + delta + 12) % 12;
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
  const normalized = normalizeNoteId(noteId);
  if (!normalized) return noteId;
  const letter = normalized[0] as NoteLetter;
  const suffix = normalized.endsWith("#") ? "♯" : normalized.endsWith("b") ? "♭" : "";
  return `${locale === "fr" ? FRENCH_NOTE_NAMES[letter] : letter}${suffix}`;
}

export function noteIdFor(letter: NoteLetter, alteration: -1 | 0 | 1): NoteId {
  return `${letter}${alteration === 1 ? "#" : alteration === -1 ? "b" : ""}` as NoteId;
}
