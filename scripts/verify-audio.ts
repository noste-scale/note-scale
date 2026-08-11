import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pitchNames = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"] as const;
const notes = [4, 5].flatMap((octave) => pitchNames.map((name, pitchClass) => ({
  filename: `${name}${octave}.wav`,
  frequency: 440 * 2 ** ((((octave + 1) * 12 + pitchClass) - 69) / 12),
})));
const destinations = [
  join(root, "assets", "audio"),
  join(root, "apps", "web", "public", "audio"),
  join(root, "apps", "mobile", "assets", "audio"),
];

function measuredFrequency(wav: Buffer, sampleRate: number): number {
  const firstFrame = Math.floor(sampleRate * 0.05);
  const lastFrame = Math.min(Math.floor(sampleRate * 0.45), (wav.length - 44) / 2);
  let crossings = 0;
  let previous = wav.readInt16LE(44 + firstFrame * 2);
  for (let frame = firstFrame + 1; frame < lastFrame; frame += 1) {
    const current = wav.readInt16LE(44 + frame * 2);
    if (previous <= 0 && current > 0) crossings += 1;
    previous = current;
  }
  return crossings * sampleRate / (lastFrame - firstFrame);
}

const expectedInventory = notes.map(({ filename }) => filename).sort();
const canonical = new Map<string, Buffer>();

for (const [destinationIndex, destination] of destinations.entries()) {
  const inventory = (await readdir(destination)).filter((name) => name.endsWith(".wav")).sort();
  assert.deepEqual(inventory, expectedInventory, `${destination} must contain exactly the 24 generated WAV files`);

  for (const note of notes) {
    const content = await readFile(join(destination, note.filename));
    assert.equal(content.toString("ascii", 0, 4), "RIFF", `${note.filename}: RIFF header`);
    assert.equal(content.toString("ascii", 8, 12), "WAVE", `${note.filename}: WAVE header`);
    assert.equal(content.readUInt16LE(20), 1, `${note.filename}: PCM encoding`);
    assert.equal(content.readUInt16LE(22), 1, `${note.filename}: mono channel`);
    assert.equal(content.readUInt32LE(24), 22_050, `${note.filename}: sample rate`);
    assert.equal(content.readUInt16LE(34), 16, `${note.filename}: sample depth`);
    assert.equal(content.readUInt32LE(40), content.length - 44, `${note.filename}: data size`);
    assert.ok(
      Math.abs(measuredFrequency(content, 22_050) - note.frequency) < 2.5,
      `${note.filename}: generated pitch must match its filename`,
    );

    if (destinationIndex === 0) canonical.set(note.filename, content);
    else assert.ok(content.equals(canonical.get(note.filename)!), `${note.filename}: bundle copies must be byte-identical`);
  }
}

console.log("Verified 24 WAV pitches, metadata, inventories, and byte-identical bundle copies.");
