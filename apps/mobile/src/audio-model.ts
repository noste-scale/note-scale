const SAMPLE_STEMS = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"] as const;

export type SampleKey = `${typeof SAMPLE_STEMS[number]}${4 | 5}`;
export const SAMPLE_KEYS = [4, 5].flatMap((octave) => SAMPLE_STEMS.map((stem) => `${stem}${octave}` as SampleKey));

export interface SequencedPitch {
  pitchClass: number;
  octave: 4 | 5;
  sampleKey: SampleKey;
}

export function sampleKeyForPitch(pitchClass: number, octave: 4 | 5): SampleKey | undefined {
  if (!Number.isInteger(pitchClass) || pitchClass < 0 || pitchClass >= SAMPLE_STEMS.length) return undefined;
  return `${SAMPLE_STEMS[pitchClass]}${octave}` as SampleKey;
}

export function orderedPitchSequence(
  pitchClasses: readonly number[],
  direction: "up" | "down",
): SequencedPitch[] {
  let octave: 4 | 5 = 4;
  let previous = -1;
  const ascending = pitchClasses.flatMap((pitchClass) => {
    if (!Number.isInteger(pitchClass) || pitchClass < 0 || pitchClass > 11) return [];
    if (previous >= 0 && pitchClass < previous) octave = 5;
    previous = pitchClass;
    const sampleKey = sampleKeyForPitch(pitchClass, octave);
    return sampleKey ? [{ pitchClass, octave, sampleKey }] : [];
  });
  return direction === "up" ? ascending : [...ascending].reverse();
}

export function playbackConfigurationKey(
  notes: readonly string[],
  direction: "up" | "down",
  slow: boolean,
): string {
  return `${notes.join("|")}::${direction}::${slow ? "slow" : "normal"}`;
}

export function scalePlaybackLabel(action: string, scaleLabel?: string): string {
  return scaleLabel ? `${action} la gamme ${scaleLabel}` : action;
}

export type PlaybackPhase = "stopped" | "playing" | "paused" | "completed" | "preempted";
export type PlaybackEvent = "start" | "restart" | "pause" | "resume" | "stop" | "complete" | "preempt";

export function transitionPlayback(phase: PlaybackPhase, event: PlaybackEvent): PlaybackPhase {
  if (event === "start" || event === "restart") return "playing";
  if (event === "stop") return "stopped";
  if (event === "pause") return phase === "playing" ? "paused" : phase;
  if (event === "resume") return phase === "paused" ? "playing" : phase;
  if (event === "complete") return phase === "playing" ? "completed" : phase;
  return phase === "playing" || phase === "paused" ? "preempted" : phase;
}
