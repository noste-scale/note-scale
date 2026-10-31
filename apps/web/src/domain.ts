import {
  MAJOR_SCALES,
  formatNote,
  pitchClassOf,
  type MajorScale,
  type NoteId
} from "@notescale/music";

export interface UiNote {
  id: NoteId;
  label: string;
  pitch: number
}

export interface UiScale {
  id: string;
  frenchName: string;
  internationalName: string;
  notes: UiNote[];
  accidentals: string[];
  keySignatureCount: number;
  steps: string[];
}

function createScaleView(scale: MajorScale): UiScale {
  return {
    id: scale.id,
    frenchName: scale.frenchName,
    internationalName: scale.internationalName,
    notes: scale.notes.map((noteId) => ({
      id: noteId,
      label: formatNote(noteId),
      pitch: pitchClassOf(noteId)
    })),
    accidentals: scale.accidentals.map((noteId) => formatNote(noteId)),
    keySignatureCount: scale.keySignatureCount,
    steps: scale.construction.map((step) => step.explanation),
  };
}

export const scales = MAJOR_SCALES.map(createScaleView);
export const getScale = (id: string) => scales.find((scale) => scale.id === id);
