import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sampleRate = 22_050;
const durationSeconds = 0.55;
const frames = Math.floor(sampleRate * durationSeconds);
const pitchNames = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"] as const;
const notes = [4, 5].flatMap((octave) => pitchNames.map((name, pitchClass) => {
  const midi = (octave + 1) * 12 + pitchClass;
  return [`${name}${octave}`, 440 * 2 ** ((midi - 69) / 12)] as const;
}));

function wav(frequency: number): Buffer {
  const bytesPerSample = 2;
  const dataLength = frames * bytesPerSample;
  const output = Buffer.alloc(44 + dataLength);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataLength, 4);
  output.write("WAVE", 8);
  output.write("fmt ", 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * bytesPerSample, 28);
  output.writeUInt16LE(bytesPerSample, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataLength, 40);

  for (let frame = 0; frame < frames; frame += 1) {
    const time = frame / sampleRate;
    const attack = Math.min(1, time / 0.015);
    const release = Math.min(1, (durationSeconds - time) / 0.12);
    const envelope = attack * release * Math.exp(-2.8 * time);
    const fundamental = Math.sin(2 * Math.PI * frequency * time);
    const second = 0.2 * Math.sin(2 * Math.PI * frequency * 2 * time);
    const third = 0.08 * Math.sin(2 * Math.PI * frequency * 3 * time);
    const sample = Math.max(-1, Math.min(1, (fundamental + second + third) * envelope * 0.55));
    output.writeInt16LE(Math.round(sample * 32_767), 44 + frame * bytesPerSample);
  }
  return output;
}

const destinations = [
  join(root, "assets", "audio"),
  join(root, "apps", "web", "public", "audio"),
  join(root, "apps", "mobile", "assets", "audio"),
];

for (const destination of destinations) {
  await mkdir(destination, { recursive: true });
  await Promise.all(notes.map(([name, frequency]) => writeFile(join(destination, `${name}.wav`), wav(frequency))));
}

console.log(`Generated ${notes.length} owned WAV samples in ${destinations.length} bundle locations.`);
