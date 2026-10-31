import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sampleRateHz = 22_050;
const durationSeconds = 0.55;
const frameCount = Math.floor(sampleRateHz * durationSeconds);
const pitchNames = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"] as const;
const noteFrequencies = [4, 5].flatMap((octave) =>
  pitchNames.map((pitchName, pitchClass) => {
    const midiNote = (octave + 1) * 12 + pitchClass;

    return [`${pitchName}${octave}`, 440 * 2 ** ((midiNote - 69) / 12)] as const;
  }),
);

function synthesizeWav(frequencyHz: number): Buffer {
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
  wavBytes.writeUInt32LE(sampleRateHz, 24);
  wavBytes.writeUInt32LE(sampleRateHz * bytesPerSample, 28);
  wavBytes.writeUInt16LE(bytesPerSample, 32);
  wavBytes.writeUInt16LE(16, 34);
  wavBytes.write("data", 36);
  wavBytes.writeUInt32LE(dataLength, 40);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const elapsedSeconds = frameIndex / sampleRateHz;
    const attack = Math.min(1, elapsedSeconds / 0.015);
    const release = Math.min(1, (durationSeconds - elapsedSeconds) / 0.12);
    const envelope = attack * release * Math.exp(-2.8 * elapsedSeconds);
    const fundamental = Math.sin(2 * Math.PI * frequencyHz * elapsedSeconds);
    const secondHarmonic = 0.2 * Math.sin(2 * Math.PI * frequencyHz * 2 * elapsedSeconds);
    const thirdHarmonic = 0.08 * Math.sin(2 * Math.PI * frequencyHz * 3 * elapsedSeconds);
    const sample = Math.max(-1, Math.min(1, (fundamental + secondHarmonic + thirdHarmonic) * envelope * 0.55));
    wavBytes.writeInt16LE(Math.round(sample * 32_767), 44 + frameIndex * bytesPerSample);
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
    noteFrequencies.map(([noteName, frequencyHz]) =>
      writeFile(join(audioDirectory, `${noteName}.wav`), synthesizeWav(frequencyHz)),
    ),
  );
}

console.log(`Generated ${noteFrequencies.length} owned WAV samples in ${audioDirectories.length} bundle locations.`);
