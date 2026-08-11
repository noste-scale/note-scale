import type { TonicId } from "./types";

export const SHARP_ORDER = ["F#", "C#", "G#", "D#", "A#", "E#", "B#"] as const;
export const FLAT_ORDER = ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"] as const;

export interface ScaleMetadata {
  id: TonicId;
  signature: number;
}

export const SCALE_CATALOG: readonly ScaleMetadata[] = [
  { id: "C", signature: 0 },
  { id: "G", signature: 1 },
  { id: "D", signature: 2 },
  { id: "A", signature: 3 },
  { id: "E", signature: 4 },
  { id: "B", signature: 5 },
  { id: "F#", signature: 6 },
  { id: "C#", signature: 7 },
  { id: "F", signature: -1 },
  { id: "Bb", signature: -2 },
  { id: "Eb", signature: -3 },
  { id: "Ab", signature: -4 },
  { id: "Db", signature: -5 },
  { id: "Gb", signature: -6 },
  { id: "Cb", signature: -7 },
] as const;

export const SUPPORTED_TONICS: readonly TonicId[] = SCALE_CATALOG.map(({ id }) => id);

export function isTonicId(value: string): value is TonicId {
  return SUPPORTED_TONICS.some((tonic) => tonic === value);
}

export function getScaleMetadata(id: TonicId): ScaleMetadata {
  const metadata = SCALE_CATALOG.find((entry) => entry.id === id);
  if (!metadata) throw new Error(`Missing catalog metadata for ${id}`);
  return metadata;
}
