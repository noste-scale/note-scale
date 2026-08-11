import { MAJOR_SCALES, formatNote, pitchClassOf, type MajorScale, type NoteId } from "@notescale/music";

export interface UiNote { id: NoteId; label: string; pitch: number }
export interface UiScale {
  id: string;
  frenchName: string;
  internationalName: string;
  notes: UiNote[];
  accidentals: string[];
  keySignatureCount: number;
  steps: string[];
}

function toScale(scale: MajorScale): UiScale {
  return {
    id: scale.id,
    frenchName: scale.frenchName,
    internationalName: scale.internationalName,
    notes: scale.notes.map((id) => ({ id, label: formatNote(id), pitch: pitchClassOf(id) })),
    accidentals: scale.accidentals.map((id) => formatNote(id)),
    keySignatureCount: scale.keySignatureCount,
    steps: scale.construction.map((step) => step.explanation),
  };
}

export const scales = MAJOR_SCALES.map(toScale);
export const getScale = (id: string) => scales.find((scale) => scale.id === id);
