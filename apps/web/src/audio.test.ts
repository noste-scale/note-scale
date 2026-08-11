import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { WebScaleAudio, sampleUrlForPitch, type AudioInactiveReason, type AudioVoice } from "./audio";

function voice() {
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
    const pitches: number[] = []; const voices: ReturnType<typeof voice>[] = []; const inactive = vi.fn<(reason: AudioInactiveReason) => void>();
    const player = new WebScaleAudio((pitch) => { pitches.push(pitch); const item = voice(); voices.push(item); return item; }, undefined, inactive);
    expect(player.play([0, 2], "up", "normal")).toBe(true);
    expect(pitches).toEqual([0, 2]); expect(voices[0]?.play).toHaveBeenCalledOnce();
    voices[0]?.onended?.(); expect(voices[1]?.play).toHaveBeenCalledOnce();
    voices[1]?.onended?.();
    expect(player.active).toBe(false);
    expect(inactive).toHaveBeenLastCalledWith("ended");

    expect(player.play([0, 2], "down", "slow")).toBe(true);
    expect(pitches.slice(-2)).toEqual([2, 0]);
    expect(voices.at(-1)?.playbackRate).toBe(.7);
    player.stop();
  });

  it("keeps wrapped pitch classes ascending before reversing them", () => {
    const pitches: number[] = [];
    const player = new WebScaleAudio((pitch) => { pitches.push(pitch); return voice(); });
    expect(player.play([9, 11, 1, 2], "up", "normal")).toBe(true);
    expect(pitches).toEqual([9, 11, 13, 14]);
    expect(player.play([9, 11, 1, 2], "down", "normal")).toBe(true);
    expect(pitches.slice(-4)).toEqual([14, 13, 11, 9]);
    player.stop();
  });

  it("clears and reports a rejected resume", async () => {
    const item = voice(); const onError = vi.fn(); const inactive = vi.fn();
    const player = new WebScaleAudio(() => item, onError, inactive);
    expect(await player.pauseResume()).toBe(false);
    expect(player.play([0], "up", "normal")).toBe(true);
    expect(await player.pauseResume()).toBe(true);
    item.play.mockRejectedValueOnce(new Error("resume rejected"));
    expect(await player.pauseResume()).toBe(false);
    expect(player.active).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(inactive).toHaveBeenLastCalledWith("error");
    expect(new WebScaleAudio(null).play([0], "up", "normal")).toBe(false);
  });

  it("ignores an old play rejection after a newer playback starts", async () => {
    let rejectOld: (reason?: unknown) => void = () => undefined;
    const oldPlay = new Promise<void>((_resolve, reject) => { rejectOld = reject; });
    const first = voice(); first.play.mockReturnValueOnce(oldPlay);
    const second = voice(); const onError = vi.fn();
    const factory = vi.fn(() => factory.mock.calls.length === 1 ? first : second);
    const player = new WebScaleAudio(factory, onError);
    expect(player.play([0], "up", "normal")).toBe(true);
    expect(player.play([2], "up", "normal")).toBe(true);
    rejectOld(new Error("late failure"));
    await Promise.resolve(); await Promise.resolve();
    expect(player.active).toBe(true);
    expect(second.pause).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    player.stop();
  });

  it("does not let a stale resume failure clear newer playback", async () => {
    let rejectResume: (reason?: unknown) => void = () => undefined;
    const resumePlay = new Promise<void>((_resolve, reject) => { rejectResume = reject; });
    const first = voice(); const second = voice(); const onError = vi.fn();
    const factory = vi.fn(() => factory.mock.calls.length === 1 ? first : second);
    const player = new WebScaleAudio(factory, onError);
    expect(player.play([0], "up", "normal")).toBe(true);
    expect(await player.pauseResume()).toBe(true);
    first.play.mockReturnValueOnce(resumePlay);
    const oldResume = player.pauseResume();
    expect(player.play([2], "up", "normal")).toBe(true);
    rejectResume(new Error("late resume failure"));
    await expect(oldResume).resolves.toBe(true);
    expect(player.active).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    player.stop();
  });

  it("notifies a preempted control when another player starts", () => {
    const firstVoice = voice(); const firstInactive = vi.fn();
    const secondVoice = voice();
    const first = new WebScaleAudio(() => firstVoice, undefined, firstInactive);
    const second = new WebScaleAudio(() => secondVoice);
    first.play([0], "up", "normal");
    second.play([7], "up", "normal");
    expect(firstVoice.pause).toHaveBeenCalledOnce();
    expect(first.active).toBe(false);
    expect(firstInactive).toHaveBeenLastCalledWith("preempted");
    expect(second.active).toBe(true);
    second.stop();
  });

  it("fails and releases a voice that never ends", () => {
    vi.useFakeTimers();
    try {
      const item = voice(); const onError = vi.fn(); const inactive = vi.fn();
      const player = new WebScaleAudio(() => item, onError, inactive, 100);
      expect(player.play([0], "up", "normal")).toBe(true);
      vi.advanceTimersByTime(100);
      expect(player.active).toBe(false);
      expect(item.pause).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledOnce();
      expect(inactive).toHaveBeenLastCalledWith("error");
    } finally {
      vi.useRealTimers();
    }
  });
});
