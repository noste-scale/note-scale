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
  let previousPitch = -1;
  return pitches.map((inputPitch) => {
    let pitch = (Math.trunc(inputPitch) % 12 + 12) % 12;
    while (pitch <= previousPitch) pitch += 12;
    previousPitch = pitch;
    return pitch;
  });
}

export function sampleUrlForPitch(pitch: number, base = import.meta.env.BASE_URL): string {
  const wholePitch = Math.trunc(pitch);
  const pitchClass = (wholePitch % 12 + 12) % 12;
  const octave = 4 + Math.floor(wholePitch / 12);
  const basePath = base.endsWith("/") ? base : `${base}/`;
  return `${basePath}audio/${PITCH_NAMES[pitchClass]}${octave}.wav`;
}

export class WebScaleAudio {
  private voices: AudioVoice[] = [];
  private currentVoice: AudioVoice | undefined;
  private isPaused = false;
  private playbackGeneration = 0;
  private watchdogTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly createVoice: VoiceFactory | null | undefined = defaultVoiceFactory(),
    private readonly onError: (() => void) | undefined = undefined,
    private readonly onInactive: ((reason: AudioInactiveReason) => void) | undefined = undefined,
    private readonly watchdogMs = 15_000,
  ) {}

  get active() {
    return this.currentVoice !== undefined;
  }

  play(pitches: readonly number[], direction: AudioDirection, speed: AudioSpeed): boolean {
    if (!this.createVoice || pitches.length === 0) return false;
    if (activePlayer && activePlayer !== this) activePlayer.finishPlayback("preempted");
    if (this.active) this.finishPlayback("restarted");

    const playbackToken = ++this.playbackGeneration;
    try {
      const ascendingSequence = ascendingPitches(pitches);
      const playbackSequence = direction === "up" ? ascendingSequence : [...ascendingSequence].reverse();
      this.voices = playbackSequence.map((pitch) => {
        const voice = this.createVoice!(pitch);
        voice.playbackRate = speed === "slow" ? .7 : 1;
        return voice;
      });
      activePlayer = this;
      return this.startVoice(0, playbackToken);
    } catch {
      this.finishPlayback("error");
      this.onError?.();
      return false;
    }
  }

  async pauseResume(): Promise<boolean> {
    const voice = this.currentVoice;
    const playbackToken = this.playbackGeneration;
    if (!voice) return false;
    try {
      if (this.isPaused) {
        await voice.play();
        if (playbackToken !== this.playbackGeneration || voice !== this.currentVoice) return this.active;
        this.isPaused = false;
        this.startWatchdog(playbackToken, voice);
      } else {
        voice.pause();
        this.isPaused = true;
        this.clearWatchdog();
      }
      return true;
    } catch {
      if (playbackToken === this.playbackGeneration && voice === this.currentVoice) this.failPlayback();
      return this.active;
    }
  }

  stop(): void {
    this.finishPlayback("stopped");
  }

  private finishPlayback(reason: AudioInactiveReason): void {
    const wasActive = this.active || this.voices.length > 0;
    this.playbackGeneration += 1;
    this.clearWatchdog();
    for (const voice of this.voices) {
      voice.onended = null;
      try {
        voice.pause();
      } catch { /* Best-effort release of browser media resources. */ }
      voice.currentTime = 0;
    }
    this.voices = [];
    this.currentVoice = undefined;
    this.isPaused = false;
    if (activePlayer === this) activePlayer = undefined;
    if (wasActive) this.onInactive?.(reason);
  }

  private failPlayback(): void {
    this.finishPlayback("error");
    this.onError?.();
  }

  private startVoice(voiceIndex: number, playbackToken: number): boolean {
    if (playbackToken !== this.playbackGeneration) return false;
    const voice = this.voices[voiceIndex];
    if (!voice) {
      this.finishPlayback("ended");
      return true;
    }
    this.currentVoice = voice;
    voice.onended = () => {
      if (playbackToken !== this.playbackGeneration || voice !== this.currentVoice) return;
      voice.onended = null;
      this.clearWatchdog();
      this.startVoice(voiceIndex + 1, playbackToken);
    };
    try {
      void voice.play().catch(() => {
        if (playbackToken === this.playbackGeneration && voice === this.currentVoice) this.failPlayback();
      });
      this.startWatchdog(playbackToken, voice);
      return true;
    } catch {
      if (playbackToken === this.playbackGeneration && voice === this.currentVoice) this.failPlayback();
      return false;
    }
  }

  private startWatchdog(playbackToken: number, voice: AudioVoice): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (playbackToken === this.playbackGeneration && voice === this.currentVoice && !this.isPaused) this.failPlayback();
    }, this.watchdogMs);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer !== undefined) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = undefined;
  }
}

function defaultVoiceFactory(): VoiceFactory | undefined {
  if (typeof Audio === "undefined") return undefined;
  return (pitch) => new Audio(sampleUrlForPitch(pitch)) as unknown as AudioVoice;
}
