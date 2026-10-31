import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { WebScaleAudio, sampleUrlForPitch, type AudioInactiveReason, type AudioVoice } from "./audio";

function createAudioVoice() {
  return {
    currentTime: 0,
    playbackRate: 1,
    onended: null as (() => void) | null,
    play: vi.fn<() => Promise<void>>(async () => undefined),
    pause: vi.fn(),
  } satisfies AudioVoice;
}

describe("WebScaleAudio local sample lifecycle", () => {
  it("maps ascending production pitches to bundled filenames", () => {
    expect(sampleUrlForPitch(0, "/NoteScale/")).toBe("/NoteScale/audio/C4.wav");
    expect(sampleUrlForPitch(1, "/NoteScale")).toBe("/NoteScale/audio/Cs4.wav");
    expect(sampleUrlForPitch(11, "/NoteScale/")).toBe("/NoteScale/audio/B4.wav");
    expect(sampleUrlForPitch(12, "/NoteScale/")).toBe("/NoteScale/audio/C5.wav");
    expect(sampleUrlForPitch(23, "/NoteScale/")).toBe("/NoteScale/audio/B5.wav");

    for (let pitch = 0; pitch < 24; pitch += 1) {
      const filename = sampleUrlForPitch(pitch, "/").replace("/audio/", "");
      expect(existsSync(new URL(`../public/audio/${filename}`, import.meta.url)), filename).toBe(true);
    }
  });

  it("respects direction and speed, then reports natural completion", () => {
    const requestedPitches: number[] = [];
    const audioVoices: ReturnType<typeof createAudioVoice>[] = [];
    const onInactive = vi.fn<(reason: AudioInactiveReason) => void>();
    const player = new WebScaleAudio(
      (pitch) => {
        requestedPitches.push(pitch);
        const audioVoice = createAudioVoice();
        audioVoices.push(audioVoice);

        return audioVoice;
      },
      undefined,
      onInactive
    );
    expect(player.play([0, 2], "up", "normal")).toBe(true);
    expect(requestedPitches).toEqual([0, 2]);
    expect(audioVoices[0]?.play).toHaveBeenCalledOnce();
    audioVoices[0]?.onended?.();
    expect(audioVoices[1]?.play).toHaveBeenCalledOnce();
    audioVoices[1]?.onended?.();
    expect(player.active).toBe(false);
    expect(onInactive).toHaveBeenLastCalledWith("ended");

    expect(player.play([0, 2], "down", "slow")).toBe(true);
    expect(requestedPitches.slice(-2)).toEqual([2, 0]);
    expect(audioVoices.at(-1)?.playbackRate).toBe(.7);
    player.stop();
  });

  it("keeps wrapped pitch classes ascending before reversing them", () => {
    const requestedPitches: number[] = [];
    const player = new WebScaleAudio((pitch) => {
      requestedPitches.push(pitch);

      return createAudioVoice();
    });
    expect(player.play([9, 11, 1, 2], "up", "normal")).toBe(true);
    expect(requestedPitches).toEqual([9, 11, 13, 14]);
    expect(player.play([9, 11, 1, 2], "down", "normal")).toBe(true);
    expect(requestedPitches.slice(-4)).toEqual([14, 13, 11, 9]);
    player.stop();
  });

  it("clears and reports a rejected resume", async () => {
    const audioVoice = createAudioVoice();
    const onError = vi.fn();
    const onInactive = vi.fn();
    const player = new WebScaleAudio(() => audioVoice, onError, onInactive);
    expect(await player.pauseResume()).toBe(false);
    expect(player.play([0], "up", "normal")).toBe(true);
    expect(await player.pauseResume()).toBe(true);
    audioVoice.play.mockRejectedValueOnce(new Error("resume rejected"));
    expect(await player.pauseResume()).toBe(false);
    expect(player.active).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(onInactive).toHaveBeenLastCalledWith("error");
    expect(new WebScaleAudio(null).play([0], "up", "normal")).toBe(false);
  });

  it("ignores an old play rejection after a newer playback starts", async () => {
    let rejectOldPlayback: (reason?: unknown) => void = () => undefined;
    const oldPlayback = new Promise<void>((_resolve, reject) => {
      rejectOldPlayback = reject;
    });
    const firstVoice = createAudioVoice();
    firstVoice.play.mockReturnValueOnce(oldPlayback);
    const secondVoice = createAudioVoice();
    const onError = vi.fn();
    const createVoice = vi.fn(() => createVoice.mock.calls.length === 1 ? firstVoice : secondVoice);
    const player = new WebScaleAudio(createVoice, onError);
    expect(player.play([0], "up", "normal")).toBe(true);
    expect(player.play([2], "up", "normal")).toBe(true);
    rejectOldPlayback(new Error("late failure"));
    await Promise.resolve();
    await Promise.resolve();
    expect(player.active).toBe(true);
    expect(secondVoice.pause).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    player.stop();
  });

  it("does not let a stale resume failure clear newer playback", async () => {
    let rejectResume: (reason?: unknown) => void = () => undefined;
    const pendingResume = new Promise<void>((_resolve, reject) => {
      rejectResume = reject;
    });
    const firstVoice = createAudioVoice();
    const secondVoice = createAudioVoice();
    const onError = vi.fn();
    const createVoice = vi.fn(() => createVoice.mock.calls.length === 1 ? firstVoice : secondVoice);
    const player = new WebScaleAudio(createVoice, onError);
    expect(player.play([0], "up", "normal")).toBe(true);
    expect(await player.pauseResume()).toBe(true);
    firstVoice.play.mockReturnValueOnce(pendingResume);
    const oldResumeResult = player.pauseResume();
    expect(player.play([2], "up", "normal")).toBe(true);
    rejectResume(new Error("late resume failure"));
    await expect(oldResumeResult).resolves.toBe(true);
    expect(player.active).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    player.stop();
  });

  it("notifies a preempted control when another player starts", () => {
    const firstVoice = createAudioVoice();
    const onFirstInactive = vi.fn();
    const secondVoice = createAudioVoice();
    const firstPlayer = new WebScaleAudio(() => firstVoice, undefined, onFirstInactive);
    const secondPlayer = new WebScaleAudio(() => secondVoice);
    firstPlayer.play([0], "up", "normal");
    secondPlayer.play([7], "up", "normal");
    expect(firstVoice.pause).toHaveBeenCalledOnce();
    expect(firstPlayer.active).toBe(false);
    expect(onFirstInactive).toHaveBeenLastCalledWith("preempted");
    expect(secondPlayer.active).toBe(true);
    secondPlayer.stop();
  });

  it("fails and releases a voice that never ends", () => {
    vi.useFakeTimers();

    try {
      const audioVoice = createAudioVoice();
      const onError = vi.fn();
      const onInactive = vi.fn();
      const player = new WebScaleAudio(() => audioVoice, onError, onInactive, 100);
      expect(player.play([0], "up", "normal")).toBe(true);
      vi.advanceTimersByTime(100);
      expect(player.active).toBe(false);
      expect(audioVoice.pause).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledOnce();
      expect(onInactive).toHaveBeenLastCalledWith("error");
    } finally {
      vi.useRealTimers();
    }
  });
});
