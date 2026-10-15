import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { isValidElement } from "react";
import ts from "typescript";
import * as music from "@notescale/music";
import * as domain from "../src/domain.js";
import * as audioModel from "../src/audio-model.js";
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
  playbackStatus,
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
for (const [state, expected] of [
  ["stopped", "Lecture prête."],
  ["playing", "Lecture en cours."],
  ["paused", "Lecture en pause."],
  ["completed", "Lecture terminée."],
  ["preempted", "Lecture interrompue par une autre lecture."],
] as const) {
  assert.equal(playbackStatus(state), expected, `audio status must match ${state}`);
  for (const message of ["Lecture arrêtée.", "La lecture a échoué.", "Lecture réinitialisée après le changement de gamme, de sens ou de vitesse."]) {
    assert.equal(playbackStatus(state, message), message, "explicit controller messages must win over phase defaults");
  }
}
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

// ponytail: execute real TSX with host stubs for prop/element checks; device tests still own native layout and accessibility.
async function componentModule(path: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const filename = join(here, path);
  const require = createRequire(filename);
  const source = ts.transpileModule(await readFile(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: filename }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(source, { exports, require: (name: string) => mocks[name] ?? require(name), ...globals }, { filename });
  return exports;
}
function elementTree(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(elementTree);
  if (!isValidElement<any>(node)) return node === null || node === undefined || typeof node === "boolean" ? [] : [node];
  if (typeof node.type === "function") return elementTree((node.type as (props: any) => unknown)(node.props));
  return [node, ...elementTree(node.props.children)];
}
const textOf = (node: unknown) => elementTree(node).filter((entry) => typeof entry === "string" || typeof entry === "number").join("");
const components = await componentModule("../src/components.tsx", {
  "react-native": { Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View", StyleSheet: { create: (styles: unknown) => styles } },
  "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
  "expo-router": { Link: "Link" },
  "@notescale/music": music,
  "./theme": { useTheme: () => ({}) },
});
for (const [path, prefix, destinations, pathname, visibleLabel] of [
  ["../app/(tabs)/learn.tsx", "../../src", domain.lessons, "/lesson/[id]", "Ouvrir la leçon"],
  ["../app/scales.tsx", "../src", domain.scales, "/scale/[id]", "Voir la construction"],
] as const) {
  const screen = await componentModule(path, { [`${prefix}/components`]: components, [`${prefix}/domain`]: domain, [`${prefix}/audio`]: { AudioControls: () => null } });
  const links = elementTree(screen.default()).filter((entry) => entry?.type === "Link" && entry.props.href.pathname === pathname);
  assert.equal(links.length, destinations.length);
  const labels = links.map((link, index) => {
    const destination = destinations[index]!;
    const pressable = elementTree(link.props.children).find((entry) => entry?.type === "Pressable");
    assert.equal(link.props.href.params.id, destination.id, "contextual names must preserve their route destination");
    assert.equal(textOf(pressable), visibleLabel, "visible link labels must stay unchanged");
    assert.ok(pressable.props.accessibilityLabel.includes("title" in destination ? destination.title : destination.frenchName));
    return pressable.props.accessibilityLabel;
  });
  assert.equal(new Set(labels).size, destinations.length, "every repeated native link needs a distinct accessible name");
}
for (const [name, roles] of [["Action", ["button", "radio"]], ["Chip", ["button", "radio", "checkbox"]]] as const) {
  for (const role of roles) for (const selected of [false, true]) {
    const control = elementTree(components[name]!({ label: "Do", role, selected, onPress: () => undefined }))[0];
    assert.equal(control.props.accessibilityRole, role);
    assert.equal(control.props.accessibilityLabel, "Do", "selection marker must not pollute the accessible name");
    assert.deepEqual({ ...control.props.accessibilityState }, role === "button" ? { disabled: false, selected } : { disabled: false, checked: selected });
    assert.equal(textOf(control), selected ? "✓ Do" : "Do", "only selected options need a non-color marker");
    const style = typeof control.props.style === "function" ? control.props.style({ pressed: false }) : control.props.style;
    assert.ok(style.some((entry: any) => entry.maxWidth === "100%" && entry.flexShrink === 1), "long actions must reuse chip width bounds");
  }
}
let progressForScreen = createEmptyProgress();
let hydratedForScreen = false;
const progressScreen = await componentModule("../app/(tabs)/progress.tsx", {
  "../../src/components": components, "../../src/domain": domain, "@notescale/music": music,
  "../../src/progress": { useProgress: () => ({ progress: progressForScreen, hydrated: hydratedForScreen, warning: "Avertissement local" }) },
});
assert.ok(textOf(progressScreen.default()).includes("Lecture de ta progression locale."));
assert.ok(!textOf(progressScreen.default()).includes("Ta première gamme t’attend"));
hydratedForScreen = true;
for (let count = 0; count <= 2; count += 1) {
  const tree = elementTree(progressScreen.default());
  const text = textOf(progressScreen.default());
  assert.ok(text.includes(count === 1 ? "exercice réalisé" : "exercices réalisés"));
  assert.ok(text.includes(`${count} ${count === 1 ? "bonne réponse" : "bonnes réponses"}`));
  assert.ok(text.includes(count === 0 ? "0 jours" : "1 jour"));
  assert.ok(text.includes(count === 0 ? "Commence un exercice pour obtenir une recommandation." : "Aucune gamme à revoir pour le moment."));
  assert.ok(text.includes("Avertissement local"), "progress warnings must survive empty-state polish");
  assert.equal(tree.some((entry) => entry?.type === "Link" && entry.props.href === "/exercises"), count === 0);
  progressForScreen = recordAttempt(progressForScreen, { scaleId: "C", exerciseType: "build-scale", correct: true }, new Date(), () => count / 3);
}

// Host/player hooks are deliberately stubbed: this executes controller + renderer, not native audio or layout.
for (const compact of [false, true]) {
  const hooks: any[] = [];
  let hookIndex = 0;
  const useState = (initial?: any) => {
    const index = hookIndex++;
    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], (next: any) => { hooks[index] = typeof next === "function" ? next(hooks[index]) : next; }];
  };
  let failPlayback = false;
  let timerCallback: (() => void) | undefined;
  const player = { play: () => { if (failPlayback) throw new Error("Test playback failure"); }, pause: () => undefined, seekTo: async () => undefined, replace: () => undefined, setPlaybackRate: () => undefined };
  const audio = await componentModule("../src/audio.tsx", {
    "@notescale/music": music, "./audio-model": audioModel, "./components": components, "react-native": { View: "View" },
    react: { useState, useRef: (initial: unknown) => useState({ current: initial })[0], useEffect: () => undefined },
    "expo-audio": { useAudioPlayer: () => player, setAudioModeAsync: async () => undefined },
    ...Object.fromEntries(SAMPLE_KEYS.map((key, index) => [`../assets/audio/${key}.wav`, index + 1])),
  }, { setTimeout: (callback: () => void) => { timerCallback = callback; return 1; }, clearTimeout: () => { timerCallback = undefined; } });
  let rendered: unknown;
  const renderAudio = () => { hookIndex = 0; rendered = audio.AudioControls!({ notes: ["Do"], compact, scaleLabel: "Do majeur" }); return textOf(rendered); };
  const control = (label: string) => elementTree(rendered).find((entry) => entry?.type === "Pressable" && entry.props.accessibilityLabel === `${label} la gamme Do majeur`);
  const press = (label: string) => { assert.equal(control(label).props.disabled, false); control(label).props.onPress(); };
  assert.equal(renderAudio().includes("Lecture prête."), !compact);
  assert.equal(control("Pause").props.disabled, true);
  press("Lire");
  assert.ok(renderAudio().includes("Lecture en cours."), `${compact ? "compact" : "full"} controls must show their actual playing phase`);
  press("Pause");
  assert.ok(renderAudio().includes("Lecture en pause."));
  press("Reprendre");
  assert.ok(renderAudio().includes("Lecture en cours."));
  press("Arrêter");
  assert.ok(renderAudio().includes("Lecture arrêtée."));
  assert.equal(control("Pause").props.disabled, true);
  press("Lire");
  renderAudio();
  assert.ok(timerCallback);
  timerCallback();
  assert.ok(renderAudio().includes("Lecture terminée."));
  failPlayback = true;
  press("Recommencer");
  const failureText = renderAudio();
  assert.ok(failureText.includes("La lecture a échoué. Les autres contrôles restent disponibles."));
  assert.ok(!failureText.includes("Lecture prête."), "explicit playback errors must override the stopped-phase fallback");
}

console.log(`mobile self-check: ${SAMPLE_KEYS.length} samples, hydration, serialized saves, grading, route/control component props, theme, and full/compact playback verified; native rendering not tested`);
