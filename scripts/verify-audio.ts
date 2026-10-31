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

function estimateFrequency(wavBytes: Buffer, sampleRateHz: number): number {
  const firstFrame = Math.floor(sampleRateHz * 0.05);
  const lastFrame = Math.min(Math.floor(sampleRateHz * 0.45), (wavBytes.length - 44) / 2);
  let risingZeroCrossings = 0;
  let previousSample = wavBytes.readInt16LE(44 + firstFrame * 2);

  for (let frameIndex = firstFrame + 1; frameIndex < lastFrame; frameIndex += 1) {
    const currentSample = wavBytes.readInt16LE(44 + frameIndex * 2);

    if (previousSample <= 0 && currentSample > 0) risingZeroCrossings += 1;

    previousSample = currentSample;
  }

  return risingZeroCrossings * sampleRateHz / (lastFrame - firstFrame);
}

const expectedInventory = expectedNotes.map(({ filename }) => filename).sort();
const canonicalSamples = new Map<string, Buffer>();

for (const [directoryIndex, audioDirectory] of audioDirectories.entries()) {
  const audioInventory = (await readdir(audioDirectory)).filter((name) => name.endsWith(".wav")).sort();

  assert.deepEqual(audioInventory, expectedInventory, `${audioDirectory} must contain exactly the 24 generated WAV files`);

  for (const expectedNote of expectedNotes) {
    const wavBytes = await readFile(join(audioDirectory, expectedNote.filename));

    assert.equal(wavBytes.toString("ascii", 0, 4), "RIFF", `${expectedNote.filename}: RIFF header`);
    assert.equal(wavBytes.toString("ascii", 8, 12), "WAVE", `${expectedNote.filename}: WAVE header`);
    assert.equal(wavBytes.readUInt16LE(20), 1, `${expectedNote.filename}: PCM encoding`);
    assert.equal(wavBytes.readUInt16LE(22), 1, `${expectedNote.filename}: mono channel`);
    assert.equal(wavBytes.readUInt32LE(24), 22_050, `${expectedNote.filename}: sample rate`);
    assert.equal(wavBytes.readUInt16LE(34), 16, `${expectedNote.filename}: sample depth`);
    assert.equal(wavBytes.readUInt32LE(40), wavBytes.length - 44, `${expectedNote.filename}: data size`);
    assert.ok(
      Math.abs(estimateFrequency(wavBytes, 22_050) - expectedNote.frequency) < 2.5,
      `${expectedNote.filename}: generated pitch must match its filename`,
    );

    if (directoryIndex === 0) {
      canonicalSamples.set(expectedNote.filename, wavBytes);
    } else {
      assert.ok(wavBytes.equals(canonicalSamples.get(expectedNote.filename)!), `${expectedNote.filename}: bundle copies must be byte-identical`);
    }
  }
}

console.log("Verified 24 WAV pitches, metadata, inventories, and byte-identical bundle copies.");
