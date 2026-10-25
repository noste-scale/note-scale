import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sampleRate = 22_050;
const durationSeconds = 0.55;
const frameCount = Math.floor(sampleRate * durationSeconds);
const pitchNames = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"] as const;
const noteFrequencies = [4, 5].flatMap((octave) =>
  pitchNames.map((pitchName, pitchClass) => {
    const midiNote = (octave + 1) * 12 + pitchClass;
    return [`${pitchName}${octave}`, 440 * 2 ** ((midiNote - 69) / 12)] as const;
  }),
);

function synthesizeWav(frequency: number): Buffer {
  const bytesPerSample = 2;
  const dataLength = frameCount * bytesPerSample;
  const wavBytes = Buffer.alloc(44 + dataLength);
  wavBytes.write("RIFF", 0);
  wavBytes.writeUInt32LE(36 + dataLength, 4);
  wavBytes.write("WAVE", 8);
  wavBytes.write("fmt ", 12);
  wavBytes.writeUInt32LE(16, 16);
  wavBytes.writeUInt16LE(1, 20);
  wavBytes.writeUInt16LE(1, 22);
  wavBytes.writeUInt32LE(sampleRate, 24);
  wavBytes.writeUInt32LE(sampleRate * bytesPerSample, 28);
  wavBytes.writeUInt16LE(bytesPerSample, 32);
  wavBytes.writeUInt16LE(16, 34);
  wavBytes.write("data", 36);
  wavBytes.writeUInt32LE(dataLength, 40);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate;
    const attack = Math.min(1, time / 0.015);
    const release = Math.min(1, (durationSeconds - time) / 0.12);
    const envelope = attack * release * Math.exp(-2.8 * time);
    const fundamental = Math.sin(2 * Math.PI * frequency * time);
    const secondHarmonic = 0.2 * Math.sin(2 * Math.PI * frequency * 2 * time);
    const thirdHarmonic = 0.08 * Math.sin(2 * Math.PI * frequency * 3 * time);
    const sample = Math.max(-1, Math.min(1, (fundamental + secondHarmonic + thirdHarmonic) * envelope * 0.55));
    wavBytes.writeInt16LE(Math.round(sample * 32_767), 44 + frame * bytesPerSample);
  }
  return wavBytes;
}

const audioDirectories = [
  join(projectRoot, "assets", "audio"),
  join(projectRoot, "apps", "web", "public", "audio"),
  join(projectRoot, "apps", "mobile", "assets", "audio"),
];

for (const audioDirectory of audioDirectories) {
  await mkdir(audioDirectory, { recursive: true });
  await Promise.all(
    noteFrequencies.map(([noteName, frequency]) =>
      writeFile(join(audioDirectory, `${noteName}.wav`), synthesizeWav(frequency)),
    ),
  );
}

console.log(`Generated ${noteFrequencies.length} owned WAV samples in ${audioDirectories.length} bundle locations.`);
