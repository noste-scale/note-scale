import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEmptyProgress,
  decodeProgress,
  recordAttempt,
  type ExerciseType,
  type PersistenceResult,
} from "@notescale/music";
import {
  orderedPitchSequence,
  playbackConfigurationKey,
  SAMPLE_KEYS,
  sampleKeyForPitch,
  scalePlaybackLabel,
  transitionPlayback,
} from "../src/audio-model.js";
import { getScale, gradeSelection, makeExercise, selectExerciseScale } from "../src/domain.js";
import {
  attemptRecordingDecision,
  responseForExercise,
  routeValue,
  selectionPayload,
  shouldRecordAttempt,
  updateSelection,
} from "../src/exercise-state.js";
import {
  createSerializedSaver,
  loadProgressWithRetry,
  mergePendingAttempts,
  persistenceWarningAfterSave,
  resolveHydration,
  shouldPersistHydration,
} from "../src/progress-state.js";
import { nextThemePreference, shouldApplyStoredPreference } from "../src/theme-state.js";

const here = dirname(fileURLToPath(import.meta.url));
const audioDirectory = join(here, "..", "assets", "audio");

assert.equal(SAMPLE_KEYS.length, 24, "both complete chromatic octaves must be mapped");
for (const name of SAMPLE_KEYS) {
  const wav = await readFile(join(audioDirectory, `${name}.wav`));
  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF", `${name}.wav must be a RIFF file`);
  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE", `${name}.wav must be a WAVE file`);
}
assert.equal(sampleKeyForPitch(1, 5), "Cs5");
assert.equal(sampleKeyForPitch(12, 5), undefined);
assert.deepEqual(
  orderedPitchSequence([11, 1, 3], "up").map(({ sampleKey }) => sampleKey),
  ["B4", "Cs5", "Ds5"],
  "ascending wraps must use bundled upper-octave samples",
);
assert.deepEqual(
  orderedPitchSequence([11, 1, 3], "down").map(({ sampleKey }) => sampleKey),
  ["Ds5", "Cs5", "B4"],
);
assert.equal((await readFile(join(audioDirectory, "C4.wav"))).equals(await readFile(join(audioDirectory, "C5.wav"))), false, "upper pitches must be direct samples, not aliases");

let phase = transitionPlayback("stopped", "start");
assert.equal(phase, "playing");
phase = transitionPlayback(phase, "pause");
assert.equal(phase, "paused");
phase = transitionPlayback(phase, "resume");
assert.equal(phase, "playing");
assert.equal(transitionPlayback(phase, "complete"), "completed");
assert.equal(transitionPlayback("playing", "preempt"), "preempted");
assert.equal(transitionPlayback("paused", "stop"), "stopped");
assert.notEqual(playbackConfigurationKey(["Do", "Ré"], "up", false), playbackConfigurationKey(["Do", "Mi"], "up", false), "changing scale notes must reset playback");
assert.notEqual(playbackConfigurationKey(["Do"], "up", false), playbackConfigurationKey(["Do"], "down", false), "changing direction must reset playback");
assert.notEqual(playbackConfigurationKey(["Do"], "up", false), playbackConfigurationKey(["Do"], "up", true), "changing speed must reset playback");
assert.notEqual(scalePlaybackLabel("Lire", "Do majeur"), scalePlaybackLabel("Lire", "Sol majeur"), "compact controls need unique scale-aware labels");

const loaded = recordAttempt(
  createEmptyProgress(),
  { exerciseType: "build-scale", scaleId: "C", correct: true },
  new Date("2026-08-10T09:00:00.000Z"),
);
const merged = mergePendingAttempts(loaded, [{
  input: { exerciseType: "find-error", scaleId: "G", correct: false },
  at: new Date("2026-08-11T09:00:00.000Z"),
}]);
assert.equal(merged.attempts.length, 2, "pre-hydration attempts must merge with loaded attempts");
assert.deepEqual(merged.attempts.map(({ scaleId }) => scaleId), ["C", "G"]);
const advanced = mergePendingAttempts(loaded, [{
  input: { exerciseType: "build-scale", scaleId: "C", correct: true },
  at: new Date("2026-08-11T09:00:00.000Z"),
}]);
assert.equal(advanced.reviews.C?.stage, 1, "pending reviews must advance from the hydrated schedule");
assert.equal(advanced.streak, 2, "pending attempts must extend the hydrated local-day streak");
assert.equal(shouldPersistHydration(false, 1), false, "unsafe fallback loads must never be overwritten");
assert.equal(shouldPersistHydration(true, 0), false, "hydration alone must not write an empty snapshot");
assert.equal(shouldPersistHydration(true, 1), true);
const validLoad: PersistenceResult = { state: loaded, warning: null, status: "valid", canSave: true };
const hydration = resolveHydration(validLoad, [{
  input: { exerciseType: "find-error", scaleId: "G", correct: false },
  at: new Date("2026-08-11T09:00:00.000Z"),
}]);
assert.equal(hydration.shouldSave, true);
assert.equal(decodeProgress(JSON.stringify(hydration.progress)).state.attempts.length, 2, "hydrated pending progress must survive save and reload");
assert.equal(persistenceWarningAfterSave(null), undefined, "a successful save must clear a stale persistence warning");

let loadAttempts = 0;
const retriedLoad = await loadProgressWithRetry(async () => {
  loadAttempts += 1;
  return loadAttempts === 1
    ? { state: createEmptyProgress(), warning: "temporaire", status: "unavailable", canSave: false }
    : validLoad;
}, 20);
assert.equal(retriedLoad.status, "valid");
assert.equal(loadAttempts, 2, "a transient initial read failure must be retried once");
const timedOutLoad = await loadProgressWithRetry(() => new Promise<PersistenceResult>(() => undefined), 5);
assert.equal(timedOutLoad.status, "unavailable", "two hung reads must resolve to a bounded safe fallback");

const writeOrder: string[] = [];
let releaseFirst: (() => void) | undefined;
const save = createSerializedSaver(async (snapshot: string) => {
  writeOrder.push(`start:${snapshot}`);
  if (snapshot === "old") await new Promise<void>((resolve) => { releaseFirst = resolve; });
  writeOrder.push(`end:${snapshot}`);
  return null;
});
const oldSave = save("old");
const newSave = save("new");
await Promise.resolve();
assert.deepEqual(writeOrder, ["start:old"], "newer writes must wait for the older write");
assert.ok(releaseFirst);
releaseFirst();
await Promise.all([oldSave, newSave]);
assert.deepEqual(writeOrder, ["start:old", "end:old", "start:new", "end:new"], "the newest snapshot must finish last");

const timedSaveCalls: string[] = [];
const timedSave = createSerializedSaver(async (snapshot: string) => {
  timedSaveCalls.push(snapshot);
  if (snapshot === "hung") return new Promise<string>(() => undefined);
  return snapshot;
}, 5);
const timedSaveResults = await Promise.allSettled([timedSave("hung"), timedSave("latest")]);
assert.equal(timedSaveResults[0]?.status, "rejected");
assert.equal(timedSaveResults[1]?.status, "fulfilled");
assert.deepEqual(timedSaveCalls, ["hung", "latest"], "a timed-out save must release the FIFO for the latest snapshot");

const landedWrites: string[] = [];
let releaseStale: (() => void) | undefined;
const repairingSave = createSerializedSaver(async (snapshot: string) => {
  if (snapshot === "stale" && !releaseStale) await new Promise<void>((resolve) => { releaseStale = resolve; });
  landedWrites.push(snapshot);
  return null;
}, 5);
const staleWrite = repairingSave("stale").catch(() => null);
const newestWrite = repairingSave("newest");
await newestWrite;
assert.ok(releaseStale);
releaseStale();
await staleWrite;
await new Promise((resolve) => setTimeout(resolve, 10));
assert.deepEqual(landedWrites, ["newest", "stale", "newest"], "a late stale native write must be repaired by the newest snapshot");

const sequenceRng = (values: readonly number[]) => {
  let index = 0;
  return () => values[index++] ?? 0.123456;
};
const exerciseTypes: readonly ExerciseType[] = ["complete-scale", "build-scale", "find-accidentals", "identify-interval", "find-error"];
for (const [index, expected] of exerciseTypes.entries()) {
  const exercise = makeExercise(index, "C", sequenceRng([(index + 0.1) / exerciseTypes.length]));
  assert.equal(exercise?.kind, expected, `random adapter must reach ${expected}`);
  assert.equal(exercise?.sourceScaleId, "C", "a scale route must stay scoped on every exercise");
}
const catalogIds = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
for (const [index, expected] of catalogIds.entries()) {
  const exercise = makeExercise(index, undefined, sequenceRng([(index + 0.1) / catalogIds.length, 0.01]));
  assert.equal(exercise?.sourceScaleId, expected, `random adapter must reach scale ${expected}`);
}

const focusDate = new Date("2026-08-11T12:00:00.000Z");
const errorProne = recordAttempt(
  createEmptyProgress(),
  { exerciseType: "find-error", scaleId: "E", correct: false },
  new Date("2026-08-10T09:00:00.000Z"),
  () => 0.25,
);
for (let generation = 0; generation < 5; generation += 1) {
  assert.equal(selectExerciseScale(generation, undefined, errorProne, () => 0.5, focusDate)?.id, "E", "due error-prone scales must receive deterministic extra weight");
}
assert.equal(selectExerciseScale(0, "Cb", errorProne, () => 0, focusDate)?.id, "Cb", "an explicit scale route must always remain fixed");

const build = makeExercise(0, "C", sequenceRng([0.21]));
assert.ok(build);
assert.equal(build.selectionMode, "ordered");
const orderedLabels = build.domainExercise.correctAnswer.map((answer) => {
  const entry = Object.entries(build.optionPayloads).find(([, payload]) => payload[0] === answer);
  assert.ok(entry, `missing mobile option for ${answer}`);
  return entry[0];
});
assert.deepEqual(selectionPayload(orderedLabels, build.optionPayloads), build.domainExercise.correctAnswer);
const correctGrade = gradeSelection(build, orderedLabels);
assert.equal(correctGrade.correct, true, "ordered mobile payload must grade correctly");
const wrongLabels = [...orderedLabels];
[wrongLabels[1], wrongLabels[2]] = [wrongLabels[2] as string, wrongLabels[1] as string];
const wrongGrade = gradeSelection(build, wrongLabels);
assert.equal(wrongGrade.correct, false);
assert.deepEqual(wrongGrade.errors.map(({ index }) => index), [1, 2], "mobile grading must preserve positional feedback");

const eAccidentals = makeExercise(0, "E", sequenceRng([0.41]));
assert.equal(eAccidentals?.kind, "find-accidentals");
assert.ok(eAccidentals);
const eLabels = eAccidentals.domainExercise.correctAnswer.map((answer) => {
  const entry = Object.entries(eAccidentals.optionPayloads).find(([, payload]) => payload[0] === answer);
  assert.ok(entry, `missing E-major accidental option for ${answer}`);
  return entry[0];
});
const selectedELabels = eLabels.reduce<readonly string[]>(
  (current, label) => updateSelection("multiple", current, label, eAccidentals.maximumSelections, eAccidentals.noneOption),
  [],
);
assert.deepEqual(new Set(selectedELabels), new Set(eLabels), "all four E-major accidentals must remain selectable together");
assert.equal(gradeSelection(eAccidentals, selectedELabels).correct, true);

const cAccidentals = makeExercise(0, "C", sequenceRng([0.41]));
assert.equal(cAccidentals?.kind, "find-accidentals");
assert.ok(cAccidentals?.options.includes("Aucune"), "C-major accidental choices must expose Aucune");
assert.equal(gradeSelection(cAccidentals, ["Aucune"]).correct, true);

const eScale = getScale("E");
assert.ok(eScale);
assert.deepEqual(
  eScale.construction[0],
  {
    currentNote: "Mi",
    interval: "ton",
    intervalLabel: "un ton",
    naturalCandidate: "Fa",
    necessaryAlteration: "dièse",
    nextNote: "Fa♯",
    result: "Fa♯",
    explanation: "Depuis Mi, applique ton. La lettre suivante est Fa. Fa devient Fa♯ pour respecter la formule.",
  },
  "generator view model must expose every labeled construction value",
);

assert.equal(routeValue(["C", "G"]), "C");
assert.equal(routeValue("Db"), "Db");
const answered = { exerciseId: "old", selected: ["Do"], grade: correctGrade };
assert.equal(responseForExercise(answered, "old"), answered);
assert.deepEqual(responseForExercise(answered, "new"), { exerciseId: "new", selected: [] }, "route/exercise changes must reset feedback");
assert.deepEqual(updateSelection("ordered", ["Do"], "Ré", 2), ["Do", "Ré"]);
assert.deepEqual(updateSelection("ordered", ["Do", "Ré"], "Mi", 2), ["Do", "Ré"]);
assert.deepEqual(updateSelection("multiple", ["Fa♯"], "Aucune", 4, "Aucune"), ["Aucune"]);
assert.equal(shouldRecordAttempt(undefined, "exercise-1", true), true);
assert.equal(shouldRecordAttempt("exercise-1", "exercise-1", true), false, "one graded exercise must create one progress record");
const firstRecording = attemptRecordingDecision(undefined, "exercise-1", true);
const duplicateRecording = attemptRecordingDecision(firstRecording.lastRecordedExerciseId, "exercise-1", true);
assert.equal(firstRecording.record, true);
assert.equal(duplicateRecording.record, false, "controller decision must record a graded exercise exactly once");

assert.equal(shouldApplyStoredPreference(0, 0), true);
assert.equal(shouldApplyStoredPreference(0, 1), false, "late theme hydration must not replace an explicit choice");
assert.deepEqual([nextThemePreference("system"), nextThemePreference("light"), nextThemePreference("dark")], ["light", "dark", "system"]);

console.log(`mobile self-check: ${SAMPLE_KEYS.length} samples, hydration, serialized saves, grading, routing, theme, and playback verified`);
