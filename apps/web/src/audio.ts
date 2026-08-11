export type AudioDirection = "up" | "down";
export type AudioSpeed = "normal" | "slow";
export type AudioInactiveReason = "ended" | "preempted" | "restarted" | "stopped" | "error";

export interface AudioVoice {
  currentTime: number;
  playbackRate: number;
  onended: (() => void) | null;
  play(): Promise<void>;
  pause(): void;
}

export type VoiceFactory = (pitch: number) => AudioVoice;
const PITCH_NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"] as const;
let activePlayer: WebScaleAudio | undefined;

function ascendingPitches(pitches: readonly number[]): number[] {
  let previous = -1;
  return pitches.map((value) => {
    let pitch = (Math.trunc(value) % 12 + 12) % 12;
    while (pitch <= previous) pitch += 12;
    previous = pitch;
    return pitch;
  });
}

export function sampleUrlForPitch(pitch: number, base = import.meta.env.BASE_URL): string {
  const value = Math.trunc(pitch);
  const pitchClass = (value % 12 + 12) % 12;
  const octave = 4 + Math.floor(value / 12);
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}audio/${PITCH_NAMES[pitchClass]}${octave}.wav`;
}

export class WebScaleAudio {
  private voices: AudioVoice[] = [];
  private current: AudioVoice | undefined;
  private paused = false;
  private generation = 0;
  private watchdog: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly createVoice: VoiceFactory | null | undefined = defaultVoiceFactory(),
    private readonly onError: (() => void) | undefined = undefined,
    private readonly onInactive: ((reason: AudioInactiveReason) => void) | undefined = undefined,
    private readonly watchdogMs = 15_000,
  ) {}

  get active() { return this.current !== undefined; }

  play(pitches: readonly number[], direction: AudioDirection, speed: AudioSpeed): boolean {
    if (!this.createVoice || pitches.length === 0) return false;
    if (activePlayer && activePlayer !== this) activePlayer.finish("preempted");
    if (this.active) this.finish("restarted");

    const generation = ++this.generation;
    try {
      const ascending = ascendingPitches(pitches);
      const ordered = direction === "up" ? ascending : [...ascending].reverse();
      this.voices = ordered.map((pitch) => {
        const voice = this.createVoice!(pitch);
        voice.playbackRate = speed === "slow" ? .7 : 1;
        return voice;
      });
      activePlayer = this;
      return this.start(0, generation);
    } catch {
      this.finish("error");
      this.onError?.();
      return false;
    }
  }

  async pauseResume(): Promise<boolean> {
    const voice = this.current;
    const generation = this.generation;
    if (!voice) return false;
    try {
      if (this.paused) {
        await voice.play();
        if (generation !== this.generation || voice !== this.current) return this.active;
        this.paused = false;
        this.watch(generation, voice);
      } else {
        voice.pause();
        this.paused = true;
        this.clearWatchdog();
      }
      return true;
    } catch {
      if (generation === this.generation && voice === this.current) this.fail();
      return this.active;
    }
  }

  stop(): void {
    this.finish("stopped");
  }

  private finish(reason: AudioInactiveReason): void {
    const wasActive = this.active || this.voices.length > 0;
    this.generation += 1;
    this.clearWatchdog();
    for (const voice of this.voices) {
      voice.onended = null;
      try { voice.pause(); } catch { /* Best-effort release of browser media resources. */ }
      voice.currentTime = 0;
    }
    this.voices = [];
    this.current = undefined;
    this.paused = false;
    if (activePlayer === this) activePlayer = undefined;
    if (wasActive) this.onInactive?.(reason);
  }

  private fail(): void {
    this.finish("error");
    this.onError?.();
  }

  private start(index: number, generation: number): boolean {
    if (generation !== this.generation) return false;
    const voice = this.voices[index];
    if (!voice) { this.finish("ended"); return true; }
    this.current = voice;
    voice.onended = () => {
      if (generation !== this.generation || voice !== this.current) return;
      voice.onended = null;
      this.clearWatchdog();
      this.start(index + 1, generation);
    };
    try {
      void voice.play().catch(() => {
        if (generation === this.generation && voice === this.current) this.fail();
      });
      this.watch(generation, voice);
      return true;
    } catch {
      if (generation === this.generation && voice === this.current) this.fail();
      return false;
    }
  }

  private watch(generation: number, voice: AudioVoice): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      if (generation === this.generation && voice === this.current && !this.paused) this.fail();
    }, this.watchdogMs);
  }

  private clearWatchdog(): void {
    if (this.watchdog !== undefined) clearTimeout(this.watchdog);
    this.watchdog = undefined;
  }
}

function defaultVoiceFactory(): VoiceFactory | undefined {
  if (typeof Audio === "undefined") return undefined;
  return (pitch) => new Audio(sampleUrlForPitch(pitch)) as unknown as AudioVoice;
}
