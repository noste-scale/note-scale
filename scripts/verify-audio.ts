import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pitchNames = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"] as const;
const expectedNotes = [4, 5].flatMap((octave) =>
  pitchNames.map((pitchName, pitchClass) => ({
    filename: `${pitchName}${octave}.wav`,
    frequency: 440 * 2 ** ((((octave + 1) * 12 + pitchClass) - 69) / 12),
  })),
);
const audioDirectories = [
  join(projectRoot, "assets", "audio"),
  join(projectRoot, "apps", "web", "public", "audio"),
  join(projectRoot, "apps", "mobile", "assets", "audio"),
];

function estimateFrequency(wavBytes: Buffer, sampleRate: number): number {
  const firstFrame = Math.floor(sampleRate * 0.05);
  const lastFrame = Math.min(Math.floor(sampleRate * 0.45), (wavBytes.length - 44) / 2);
  let risingZeroCrossings = 0;
  let previousSample = wavBytes.readInt16LE(44 + firstFrame * 2);
  for (let frame = firstFrame + 1; frame < lastFrame; frame += 1) {
    const currentSample = wavBytes.readInt16LE(44 + frame * 2);
    if (previousSample <= 0 && currentSample > 0) risingZeroCrossings += 1;
    previousSample = currentSample;
  }
  return risingZeroCrossings * sampleRate / (lastFrame - firstFrame);
}

const expectedInventory = expectedNotes.map(({ filename }) => filename).sort();
const canonicalSamples = new Map<string, Buffer>();

for (const [directoryIndex, audioDirectory] of audioDirectories.entries()) {
  const audioInventory = (await readdir(audioDirectory)).filter((name) => name.endsWith(".wav")).sort();
  assert.deepEqual(audioInventory, expectedInventory, `${audioDirectory} must contain exactly the 24 generated WAV files`);

  for (const note of expectedNotes) {
    const wavBytes = await readFile(join(audioDirectory, note.filename));
    assert.equal(wavBytes.toString("ascii", 0, 4), "RIFF", `${note.filename}: RIFF header`);
    assert.equal(wavBytes.toString("ascii", 8, 12), "WAVE", `${note.filename}: WAVE header`);
    assert.equal(wavBytes.readUInt16LE(20), 1, `${note.filename}: PCM encoding`);
    assert.equal(wavBytes.readUInt16LE(22), 1, `${note.filename}: mono channel`);
    assert.equal(wavBytes.readUInt32LE(24), 22_050, `${note.filename}: sample rate`);
    assert.equal(wavBytes.readUInt16LE(34), 16, `${note.filename}: sample depth`);
    assert.equal(wavBytes.readUInt32LE(40), wavBytes.length - 44, `${note.filename}: data size`);
    assert.ok(
      Math.abs(estimateFrequency(wavBytes, 22_050) - note.frequency) < 2.5,
      `${note.filename}: generated pitch must match its filename`,
    );

    if (directoryIndex === 0) {
      canonicalSamples.set(note.filename, wavBytes);
    } else {
      assert.ok(wavBytes.equals(canonicalSamples.get(note.filename)!), `${note.filename}: bundle copies must be byte-identical`);
    }
  }
}

console.log("Verified 24 WAV pitches, metadata, inventories, and byte-identical bundle copies.");
