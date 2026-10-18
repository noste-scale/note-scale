import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createElement, isValidElement } from "react";
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
  const filename = resolve(here, path);
  const require = createRequire(filename);
  const source = ts.transpileModule(await readFile(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: filename }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(source, { exports: module.exports, module, require: (name: string) => mocks[name] ?? require(name), ...globals }, { filename });
  return module.exports;
}
function elementTree(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(elementTree);
  if (!isValidElement<any>(node)) return node === null || node === undefined || typeof node === "boolean" ? [] : [node];
  if (typeof node.type === "function") return elementTree((node.type as (props: any) => unknown)(node.props));
  if (typeof node.type === "object" && "render" in node.type) return elementTree((node.type as any).render(node.props, null));
  return [node, ...elementTree(node.props.children)];
}
const textOf = (node: unknown) => elementTree(node).filter((entry) => typeof entry === "string" || typeof entry === "number").join("");
const flattenStyle = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flattenStyle)) : typeof style === "object" ? style : undefined;
const nativeStyleSheet = { create: (styles: unknown) => styles, flatten: flattenStyle };
const themes = await componentModule("../src/theme.tsx", {
  "@react-native-async-storage/async-storage": {}, "react-native": {}, "./progress-state": {}, "./theme-state": {},
});
let currentTheme = themes.light;
let fontScaleForScreen = 1;
const components = await componentModule("../src/components.tsx", {
  react: { ...createRequire(import.meta.url)("react"), useRef: (initial: unknown) => ({ current: initial }) },
  "react-native": { Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", ScrollView: "ScrollView", Text: "Text", View: "View", StyleSheet: nativeStyleSheet, useWindowDimensions: () => ({ fontScale: fontScaleForScreen }) },
  "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
  "expo-router": { Link: "Link" },
  "@notescale/music": music,
  "./theme": { useTheme: () => currentTheme },
});
const mobileRequire = createRequire(join(here, "../package.json"));
const composeRefs = mobileRequire("@radix-ui/react-compose-refs");
const radixSlot = await componentModule(mobileRequire.resolve("@radix-ui/react-slot"), {
  "@radix-ui/react-compose-refs": { ...composeRefs, useComposedRefs: composeRefs.composeRefs },
});
const nativeSlot = await componentModule(mobileRequire.resolve("expo-router/build/ui/Slot.js"), {
  react: { ...mobileRequire("react"), useMemo: (factory: () => unknown) => factory() },
  "@radix-ui/react-slot": radixSlot,
  "react-native": { StyleSheet: nativeStyleSheet },
}, { process });
// Exercise Expo Router's installed Slot and Radix prop merging, not a permissive Link stub.
for (const theme of [themes.light, themes.dark]) for (const secondary of [false, true]) {
  currentTheme = theme;
  const link = components.RouteAction!({ label: "Ouvrir", accessibilityLabel: "Ouvrir la leçon", href: "/learn", secondary });
  let navigated = false;
  const tree = elementTree(createElement(nativeSlot.Slot, { onPress: () => { navigated = true; } }, link.props.children));
  const control = tree.find((entry) => entry?.type === "Pressable" || entry?.type === "TouchableOpacity");
  const style = flattenStyle(typeof control.props.style === "function" ? control.props.style({ pressed: false }) : control.props.style);
  assert.equal(style.backgroundColor, secondary ? theme.surface : theme.primary, "router Slot must preserve a readable button background");
  assert.equal(style.minHeight, 50, "router Slot must preserve the native touch target");
  assert.equal(style.paddingHorizontal, 18);
  assert.equal(style.borderWidth, secondary ? 2 : 0);
  assert.equal(style.borderColor, theme.primary);
  assert.equal(flattenStyle(tree.find((entry) => entry?.type === "Text").props.style).color, secondary ? theme.primary : theme.primaryText);
  assert.equal(control.props.activeOpacity, 0.75, "native press feedback must survive Slot composition");
  assert.equal(control.props.accessibilityRole, "link");
  assert.equal(control.props.accessibilityLabel, "Ouvrir la leçon");
  assert.equal(link.props.href, "/learn");
  control.props.onPress();
  assert.equal(navigated, true, "router navigation handler must reach the native control");
}
currentTheme = themes.light;
for (const [path, prefix, destinations, pathname, visibleLabel] of [
  ["../app/(tabs)/learn.tsx", "../../src", domain.lessons, "/lesson/[id]", "Ouvrir la leçon"],
  ["../app/scales.tsx", "../src", domain.scales, "/scale/[id]", "Voir la construction"],
] as const) {
  const screen = await componentModule(path, { [`${prefix}/components`]: components, [`${prefix}/domain`]: domain, [`${prefix}/audio`]: { AudioControls: () => null }, [`${prefix}/theme`]: { useTheme: () => currentTheme }, [`${prefix}/progress`]: { useProgress: () => ({}) }, "react-native": { View: "View" }, "expo-router": { useIsFocused: () => true } });
  const links = elementTree(screen.default()).filter((entry) => entry?.type === "Link" && entry.props.href.pathname === pathname);
  assert.equal(links.length, destinations.length);
  const labels = links.map((link, index) => {
    const destination = destinations[index]!;
    const pressable = elementTree(link.props.children).find((entry) => entry?.type === "Pressable" || entry?.type === "TouchableOpacity");
    assert.equal(link.props.href.params.id, destination.id, "contextual names must preserve their route destination");
    assert.equal(textOf(pressable), "title" in destination ? destination.title : visibleLabel, "each lesson names its destination, catalogue retains construction access");
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
  "react-native": { View: "View" },
  "../../src/progress": { useProgress: () => ({ progress: progressForScreen, hydrated: hydratedForScreen, warning: "Avertissement local" }) },
});
assert.ok(textOf(progressScreen.default()).includes("Lecture de ta progression locale."));
assert.ok(!textOf(progressScreen.default()).includes("Ta première gamme t’attend"));
hydratedForScreen = true;
for (let count = 0; count <= 2; count += 1) {
  const tree = elementTree(progressScreen.default());
  const text = textOf(progressScreen.default());
  if (count === 0) {
    assert.ok(text.includes("Ta première gamme t’attend"));
    assert.ok(!text.includes("0 %") && !text.includes("0 jours") && !text.includes("0 exercices"), "first-use progress must not present empty metrics");
  } else {
    assert.ok(text.includes(count === 1 ? "exercice réalisé" : "exercices réalisés"));
    assert.ok(text.includes(`${count} ${count === 1 ? "bonne réponse" : "bonnes réponses"}`));
    assert.ok(text.includes("1 jour"));
    assert.ok(text.includes("Aucune gamme à revoir pour le moment."));
  }
  assert.ok(text.includes("Avertissement local"), "progress warnings must survive empty-state polish");
  assert.ok(tree.some((entry) => entry?.type === "Link" && entry.props.href === "/exercises"));
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
  const renderAudio = () => { hookIndex = 0; rendered = audio.AudioControls!({ notes: ["Do"], compact, piano: true, scaleLabel: "Do majeur" }); return textOf(rendered); };
  const control = (label: string) => elementTree(rendered).find((entry) => entry?.type === "Pressable" && entry.props.accessibilityLabel === `${label} la gamme Do majeur`);
  const press = (label: string) => { assert.equal(control(label).props.disabled, false); control(label).props.onPress(); };
  assert.equal(renderAudio().includes("Lecture prête."), !compact);
  assert.equal(control("Pause"), undefined, "stopped audio must not expose a useless pause action");
  if (!compact) {
    const pressDisclosure = (label: string) => elementTree(rendered).find((entry) => entry?.type === "Pressable" && entry.props.accessibilityLabel === label).props.onPress();
    assert.ok(!textOf(rendered).includes("Ascendante"), "advanced settings must start collapsed");
    pressDisclosure("Afficher le piano");
    renderAudio();
    assert.equal(elementTree(rendered).filter((entry) => entry?.props?.accessibilityHint === "Joue cette hauteur avec un fichier audio local").length, 12);
    assert.ok(!textOf(rendered).includes("Écouter une note, depuis"), "piano must replace, not duplicate, the note buttons");
    pressDisclosure("Revenir aux notes de la gamme");
    renderAudio();
    pressDisclosure("Réglages d’écoute");
    assert.ok(renderAudio().includes("Ascendante"));
    pressDisclosure("Masquer les réglages d’écoute");
    assert.ok(!renderAudio().includes("Ascendante"));
  }
  press("Lire");
  assert.ok(renderAudio().includes("Lecture en cours."), `${compact ? "compact" : "full"} controls must show their actual playing phase`);
  press("Pause");
  assert.ok(renderAudio().includes("Lecture en pause."));
  press("Reprendre");
  assert.ok(renderAudio().includes("Lecture en cours."));
  press("Arrêter");
  assert.ok(renderAudio().includes("Lecture arrêtée."));
  assert.equal(control("Pause"), undefined);
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

// Run Expo's real release hook before the controller cleanup, in native effect registration order.
for (const compact of [false, true]) for (const playing of [false, true]) {
  const effects: (() => (() => void) | void)[] = [];
  let stateUpdates = 0;
  const reactHooks = {
    useState: (initial: unknown) => [initial, () => { stateUpdates += 1; }],
    useRef: (initial: unknown) => ({ current: initial }),
    useMemo: (factory: () => unknown) => factory(),
    useEffect: (effect: () => (() => void) | void) => { effects.push(effect); },
  };
  const releasing = await componentModule(join(dirname(mobileRequire.resolve("expo-modules-core/package.json")), "src/hooks/useReleasingSharedObject.ts"), { react: reactHooks });
  let released = false;
  const assertLive = () => assert.equal(released, false, "Cannot use shared object that was already released");
  const player = {
    play: assertLive, pause: assertLive, replace: assertLive, setPlaybackRate: assertLive, seekTo: async () => assertLive(),
    release: () => { assertLive(); released = true; },
  };
  let timerCallback: (() => void) | undefined;
  const audio = await componentModule("../src/audio.tsx", {
    "@notescale/music": music, "./audio-model": audioModel, "./components": components, "react-native": { View: "View" },
    react: reactHooks,
    "expo-audio": { useAudioPlayer: () => releasing.useReleasingSharedObject!(() => player, []), setAudioModeAsync: async () => undefined },
    ...Object.fromEntries(SAMPLE_KEYS.map((key, index) => [`../assets/audio/${key}.wav`, index + 1])),
  }, { setTimeout: (callback: () => void) => { timerCallback = callback; return 1; }, clearTimeout: () => { timerCallback = undefined; } });
  const tree = elementTree(audio.AudioControls!({ notes: ["Do"], compact }));
  const cleanups = effects.map((effect) => effect());
  if (playing) tree.find((entry) => entry?.type === "Pressable" && entry.props.accessibilityLabel === "Lire").props.onPress();
  const staleTimer = timerCallback;
  assert.equal(Boolean(staleTimer), playing);
  assert.doesNotThrow(() => cleanups.forEach((cleanup) => cleanup?.()), "leaving an audio screen must not access Expo's released player");
  assert.equal(released, true, "Expo must retain ownership of native player disposal");
  assert.equal(timerCallback, undefined, "unmount must cancel the sequence timer");
  const updatesAfterUnmount = stateUpdates;
  assert.doesNotThrow(() => staleTimer?.());
  assert.equal(stateUpdates, updatesAfterUnmount, "a queued timer must not update an unmounted controller");
}


// Bookmark checks execute the provider with real persistence helpers, without native storage.
const lessonPersistence = await import("../src/progress-state.js");
const settleLessonStorage = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function mountLessonProgress(storageMock: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> }) {
  const hooks: any[] = [];
  const effects: (() => (() => void) | void)[] = [];
  let hookIndex = 0;
  let collecting = true;
  const useState = (initial?: any) => {
    const index = hookIndex++;
    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], (next: any) => { hooks[index] = typeof next === "function" ? next(hooks[index]) : next; }];
  };
  const provider = await componentModule("../src/progress.tsx", {
    "@react-native-async-storage/async-storage": storageMock, "@notescale/music": music,
    "./progress-state": lessonPersistence, "./domain": domain,
    react: {
      createContext: () => ({ Provider: "ProgressProvider" }), useState,
      useRef: (initial: unknown) => useState({ current: initial })[0],
      useMemo: (factory: () => unknown) => factory(), useCallback: (callback: unknown) => callback,
      useEffect: (effect: () => (() => void) | void) => { if (collecting) effects.push(effect); },
    },
  });
  const value = () => { hookIndex = 0; return provider.ProgressProvider!({}).props.value; };
  value();
  collecting = false;
  const cleanups = effects.map((effect) => effect());
  return { value, unmount: () => cleanups.forEach((cleanup) => cleanup?.()) };
}
for (const storedLesson of ["tones", "obsolete-lesson", null]) {
  const writes: string[] = [];
  const provider = await mountLessonProgress({
    getItem: async (key) => key === "notescale.lesson.v1" ? storedLesson : JSON.stringify(loaded),
    setItem: async (key) => { writes.push(key); },
  });
  assert.equal(provider.value().lessonHydrated, false);
  await settleLessonStorage();
  assert.equal(provider.value().lessonHydrated, true);
  assert.equal(provider.value().lastLessonId, storedLesson === "tones" ? "tones" : undefined, "only real lesson IDs can become a resume destination");
  assert.deepEqual(provider.value().progress.attempts, loaded.attempts, "bookmark hydration must retain exercise history");
  assert.equal(writes.length, 0, "reading a bookmark must not mark a lesson read or rewrite progress");
  provider.unmount();
}
let resolveOldLesson: (id: string) => void = () => undefined;
const oldLessonRead = new Promise<string>((resolve) => { resolveOldLesson = resolve; });
const lessonWrites: [string, string][] = [];
const lessonStore = new Map<string, string>([["notescale.progress.v1", JSON.stringify(loaded)]]);
const setLessonItem = async (key: string, value: string) => { lessonWrites.push([key, value]); lessonStore.set(key, value); };
const pendingLesson = await mountLessonProgress({
  getItem: async (key) => key === "notescale.lesson.v1" ? oldLessonRead : lessonStore.get(key) ?? null,
  setItem: setLessonItem,
});
pendingLesson.value().rememberLesson("formula");
pendingLesson.value().rememberLesson("d-major");
pendingLesson.value().rememberLesson("not-a-lesson");
resolveOldLesson("tones");
await settleLessonStorage();
assert.equal(pendingLesson.value().lastLessonId, "d-major", "a late stored bookmark must not replace the latest focused lesson");
assert.deepEqual(lessonWrites, [["notescale.lesson.v1", "formula"], ["notescale.lesson.v1", "d-major"]], "lesson changes must serialize into their own key only");
assert.deepEqual(pendingLesson.value().progress.attempts, loaded.attempts);
pendingLesson.unmount();
const reloadedLesson = await mountLessonProgress({ getItem: async (key) => lessonStore.get(key) ?? null, setItem: setLessonItem });
await settleLessonStorage();
assert.equal(reloadedLesson.value().lastLessonId, "d-major", "last opened lesson must survive a new provider instance");
reloadedLesson.unmount();
let lessonWriteFails = true;
const failedLesson = await mountLessonProgress({
  getItem: async (key) => { if (key === "notescale.lesson.v1") throw new Error("read failed"); return JSON.stringify(loaded); },
  setItem: async () => { if (lessonWriteFails) throw new Error("write failed"); },
});
await settleLessonStorage();
assert.equal(failedLesson.value().lessonHydrated, true, "failed bookmark reads must not trap users in loading");
assert.ok(failedLesson.value().lessonWarning.includes("retrouvée"));
failedLesson.value().rememberLesson("notes");
await settleLessonStorage();
assert.equal(failedLesson.value().lastLessonId, "notes", "storage failure must not block learning in this session");
assert.ok(failedLesson.value().lessonWarning.includes("pas été enregistrée"));
lessonWriteFails = false;
failedLesson.value().rememberLesson("tones");
await settleLessonStorage();
assert.equal(failedLesson.value().lessonWarning, undefined);
failedLesson.unmount();

let homeLesson: string | undefined;
let homeLessonHydrated = true;
const home = await componentModule("../app/(tabs)/index.tsx", {
  "../../src/components": components, "../../src/domain": domain,
  "../../src/progress": { useProgress: () => ({ progress: createEmptyProgress(), lastLessonId: homeLesson, lessonHydrated: homeLessonHydrated }) },
  "../../src/theme": { useThemePreference: () => ({ preference: "system", cyclePreference: () => undefined }) },
});
for (const id of [undefined, "formula"]) {
  homeLesson = id;
  const tree = elementTree(home.default());
  const primaryLinks = tree.filter((node) => node?.type === "Link" && flattenStyle(node.props.children.props.style).borderWidth === 0);
  assert.equal(primaryLinks.length, 1, "home must have one main route action");
  assert.equal(primaryLinks[0].props.href.params.id, id ?? "notes");
  assert.ok(textOf(primaryLinks[0]).includes(id ? "Continuer la leçon" : "Commencer"));
}
homeLessonHydrated = false;
assert.equal(elementTree(home.default()).some((node) => node?.type === "Link" && node.props.href.pathname === "/lesson/[id]"), false, "home must not flash a false start/resume destination during hydration");

let inspectedLessonId = "notes";
let inspectedLessonFocused = true;
const rememberedLessons: string[] = [];
const lessonScreen = await componentModule("../app/lesson/[id].tsx", {
  "../../src/components": components, "@notescale/music": music, "../../src/audio": { AudioControls: "LessonAudioControls" },
  "../../src/progress": { useProgress: () => ({ rememberLesson: (id: string) => rememberedLessons.push(id) }) },
  react: { useCallback: (callback: unknown) => callback },
  "expo-router": { useLocalSearchParams: () => ({ id: inspectedLessonId }), useIsFocused: () => inspectedLessonFocused, useFocusEffect: (callback: () => void) => { if (inspectedLessonFocused) callback(); } },
});
for (let index = 0; index < music.LESSONS.length; index += 1) {
  const lesson = music.LESSONS[index]!;
  inspectedLessonId = lesson.id;
  const rendered = lessonScreen.default();
  const text = textOf(rendered);
  assert.equal(rendered.props.nativeHeader, true);
  assert.equal(rendered.key, lesson.id, "changing lesson must reset its reading scroll container");
  for (const content of [lesson.summary, ...lesson.paragraphs, ...(lesson.notes ?? [])]) assert.ok(text.includes(content), "compact lessons must preserve every original teaching sentence and note mapping");
  const links = elementTree(rendered).filter((node) => node?.type === "Link");
  const nextLesson = music.LESSONS[index + 1];
  if (nextLesson) assert.equal(links[0].props.href.params.id, nextLesson.id, "lesson end must lead straight to the next lesson");
  else assert.equal(links[0].props.href, "/generator", "final lesson must lead to practical construction");
  assert.equal(links[1].props.href, "/(tabs)/learn", "free lesson selection must stay available");
}
assert.deepEqual(rememberedLessons, music.LESSONS.map((lesson) => lesson.id));
inspectedLessonId = "missing";
assert.ok(textOf(lessonScreen.default()).includes("Leçon introuvable"));
assert.equal(rememberedLessons.length, music.LESSONS.length, "invalid routes must never replace the bookmark");
inspectedLessonId = "tones";
for (const focused of [true, false, true]) {
  inspectedLessonFocused = focused;
  assert.equal(elementTree(lessonScreen.default()).some((node) => node?.type === "LessonAudioControls"), focused, "leaving a stacked lesson must unmount audio; returning restores idle controls");
}

// Native layout geometry stays testable without pretending to render a device.
for (const nativeHeader of [false, true]) {
  const screen = components.Screen!({ title: 'Titre', nativeHeader });
  assert.equal(screen.props.edges.includes('top'), !nativeHeader, 'native headers already own the top safe inset');
  assert.ok(screen.props.edges.includes('bottom'), 'system navigation inset must remain protected');
}
for (const scale of [1, 1.3, 2]) {
  fontScaleForScreen = scale;
  const played: string[] = [];
  const tree = elementTree(components.Piano!({ activeNotes: ['Sol', 'La', 'Si', 'Do', 'Ré', 'Mi', 'Fa♯'], onPlayNote: (note: string) => played.push(note) }));
  const keys = tree.filter((node) => node?.type === 'Pressable');
  assert.equal(keys.length, 12);
  const styles = keys.map((key) => flattenStyle(key.props.style({ pressed: false })));
  const black = styles.filter((style) => style.zIndex === 1);
  const white = styles.filter((style) => style.zIndex === 0);
  assert.equal(white.length, 7);
  assert.equal(black.length, 5);
  black.forEach((style, index) => assert.ok(Math.abs((style.left + style.width / 2) / (76 * scale) - [1, 2, 4, 5, 6][index]!) < 1e-10, 'black keys must straddle real white-key seams, never Mi–Fa'));
  for (const style of styles) assert.ok(style.width >= 48 && style.height >= 48);
  assert.ok(white[0].height - black[0].height >= 48, 'white keys need an exposed lower touch target');
  keys.forEach((key) => key.props.onPress());
  assert.deepEqual(played, ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
  assert.ok(tree.some((node) => node?.props?.accessibilityLabel === 'Sol, note de la gamme'));
}
fontScaleForScreen = 1;

const generatorHooks: any[] = [];
let generatorHookIndex = 0;
const generatorScreen = await componentModule('../app/generator.tsx', {
  '../src/components': components, '../src/domain': domain, 'react-native': { View: 'View' },
  react: { useState: (initial: any) => {
    const index = generatorHookIndex++;
    if (!(index in generatorHooks)) generatorHooks[index] = initial;
    return [generatorHooks[index], (next: any) => { generatorHooks[index] = typeof next === 'function' ? next(generatorHooks[index]) : next; }];
  } },
});
let generatorTree: any[] = [];
const renderGenerator = () => { generatorHookIndex = 0; const result = generatorScreen.default(); generatorTree = elementTree(result); return textOf(result); };
const generatorControl = (label: string) => generatorTree.find((node) => node?.type === 'Pressable' && node.props.accessibilityLabel === label);
const pressGenerator = (label: string) => { const control = generatorControl(label); assert.ok(control && !control.props.disabled, label); control.props.onPress(); return renderGenerator(); };
renderGenerator();
assert.deepEqual(generatorTree!.filter((node) => node?.props?.accessibilityRole === 'radio').map((node) => node.props.accessibilityLabel), ['Do', 'Sol', 'Ré']);
assert.equal(generatorControl('Do').props.accessibilityState.checked, true);
pressGenerator('Voir les 15 notes de départ');
assert.equal(generatorTree!.filter((node) => node?.props?.accessibilityRole === 'radio').length, 15);
pressGenerator('Si♭');
pressGenerator('Réduire le choix de notes');
assert.equal(generatorControl('Si♭').props.accessibilityState.checked, true, 'folding the catalogue must keep a selected advanced key visible');
pressGenerator('Voir les 15 notes de départ');
for (const scale of domain.scales) {
  pressGenerator(scale.notes[0]!);
  assert.equal(generatorControl('Étape précédente').props.disabled, true);
  for (let step = 0; step < 7; step += 1) {
    const text = renderGenerator();
    const current = scale.construction[step]!;
    assert.ok(text.includes(`Étape ${step + 1} sur 7 : ${current.currentNote} + ${current.intervalLabel} → ${current.result}`));
    assert.ok(text.includes(scale.notes.slice(0, step + 2).join(' – ')), 'each preview must preserve exact note spelling and octave return');
    assert.ok(generatorTree.some((node) => node?.type === 'Text' && node.props.accessibilityLabel?.includes(`Étape ${step + 1} :`)), 'formula must identify the active interval accessibly');
    const explanation = pressGenerator('Pourquoi cette note ?');
    assert.ok(explanation.includes(current.naturalCandidate) && explanation.includes(current.necessaryAlteration) && explanation.includes(current.explanation));
    const after = pressGenerator(step === 6 ? 'Recommencer' : 'Étape suivante');
    assert.ok(!after.includes('Note naturelle suivante :'), 'a step change must close the old explanation');
  }
  assert.equal(generatorControl('Étape précédente').props.disabled, true);
}
pressGenerator('Étape suivante');
pressGenerator('Pourquoi cette note ?');
pressGenerator('Étape précédente');
assert.equal(generatorControl('Étape précédente').props.disabled, true);
assert.ok(generatorControl('Pourquoi cette note ?'));

// Hidden stack screens must unmount audio instead of pausing Expo's already-released player.
for (const [path, prefix, expectedPlayers] of [['../app/scales.tsx', '../src', 15], ['../app/scale/[id].tsx', '../../src', 1]] as const) {
  let focused = true;
  const screen = await componentModule(path, {
    [`${prefix}/components`]: components, [`${prefix}/domain`]: domain,
    [`${prefix}/audio`]: { AudioControls: 'AudioControls' }, [`${prefix}/theme`]: { useTheme: () => currentTheme },
    'react-native': { View: 'View' }, 'expo-router': { useIsFocused: () => focused, useLocalSearchParams: () => ({ id: 'G' }) },
  });
  assert.equal(elementTree(screen.default()).filter((node) => node?.type === 'AudioControls').length, expectedPlayers);
  focused = false;
  assert.equal(elementTree(screen.default()).filter((node) => node?.type === 'AudioControls').length, 0);
}
currentTheme = themes.dark;
const darkPiano = elementTree(components.Piano!({ activeNotes: [], onPlayNote: () => undefined })).filter((node) => node?.type === 'Pressable');
assert.equal(flattenStyle(darkPiano[0].props.style({ pressed: false })).backgroundColor, '#FFFFFF', 'white keys must stay distinguishable from black keys in dark mode');
currentTheme = themes.light;

const tabLayout = await componentModule('../app/(tabs)/_layout.tsx', {
  'expo-router': { Tabs: { Screen: 'TabScreen' } },
  'expo-symbols': { SymbolView: 'SymbolView' },
  'expo-symbols/androidWeights/light': { __esModule: true, default: { name: 'MaterialSymbols_300Light', font: 1 } },
  'react-native': { View: 'View' },
  '../../src/theme': { useTheme: () => currentTheme },
});
for (const theme of [themes.light, themes.dark]) {
  currentTheme = theme;
  const tabs = tabLayout.default();
  assert.equal(tabs.props.screenOptions.tabBarActiveTintColor, theme.primary);
  assert.equal(tabs.props.screenOptions.tabBarInactiveTintColor, theme.muted);
  assert.equal(tabs.props.screenOptions.tabBarStyle.paddingBottom, undefined, 'native navigation must retain ownership of the bottom inset');
  for (const [index, [route, label, ios, android]] of [
    ['index', 'Accueil', 'house', 'home'], ['learn', 'Apprendre', 'book', 'menu_book'],
    ['exercises', 'Exercices', 'square.and.pencil', 'edit_note'], ['progress', 'Ma progression', 'chart.bar', 'bar_chart'],
  ].entries()) {
    const tab = tabs.props.children[index];
    assert.equal(tab.props.name, route);
    assert.equal(tab.props.options.tabBarAccessibilityLabel, label);
    for (const color of [theme.primary, theme.muted]) {
      const icon = elementTree(tab.props.options.tabBarIcon({ color }));
      assert.equal(icon[0].props.importantForAccessibility, 'no-hide-descendants', 'decorative glyphs must not duplicate the menu label');
      const symbol = icon.find((node) => node?.type === 'SymbolView');
      assert.equal(symbol.props.name.ios, ios);
      assert.equal(symbol.props.name.android, android);
      assert.equal(symbol.props.name.web, android);
      assert.equal(symbol.props.size, 24);
      assert.equal(symbol.props.tintColor, color);
      assert.equal(symbol.props.weight.android.name, 'MaterialSymbols_300Light');
    }
  }
}
currentTheme = themes.light;

const launcherConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')).expo;
for (const path of [launcherConfig.icon, launcherConfig.android.adaptiveIcon.foregroundImage, launcherConfig.android.adaptiveIcon.monochromeImage]) {
  const png = await readFile(new URL(`../${path}`, import.meta.url));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
  assert.equal(png[25], path === launcherConfig.icon ? 2 : 6, 'full icon must be opaque RGB; adaptive layers need RGBA');
}
assert.equal(launcherConfig.android.adaptiveIcon.backgroundColor, themes.light.primary);

const audioPlugin = launcherConfig.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-audio');
for (const option of ['microphonePermission', 'recordAudioAndroid', 'enableBackgroundRecording', 'enableBackgroundPlayback']) {
  assert.equal(audioPlugin?.[1]?.[option], false, `local playback must not enable ${option}`);
}
for (const permission of ['RECORD_AUDIO', 'SYSTEM_ALERT_WINDOW', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'FOREGROUND_SERVICE_MICROPHONE']) {
  assert.ok(launcherConfig.android.blockedPermissions.includes(`android.permission.${permission}`), `block inherited permission ${permission}`);
}

const privacyScreen = await componentModule('../app/privacy.tsx', { '../src/components': components });
const privacyTree = privacyScreen.default();
assert.equal(privacyTree.props.nativeHeader, true);
assert.equal(privacyTree.props.title, 'Politique de confidentialité');
assert.ok(elementTree(home.default()).some((node) => node?.type === 'Link' && node.props.href === '/privacy'), 'privacy must remain accessible from home without a network');
const privacySource = await readFile(new URL('../app/privacy.tsx', import.meta.url), 'utf8');
const publicPrivacy = await readFile(new URL('../../web/public/privacy.html', import.meta.url), 'utf8');
const localParagraphs = [...privacySource.matchAll(/<Body>([^<]+)<\/Body>/g)].map((match) => match[1]);
const publicParagraphs = [...publicPrivacy.matchAll(/<p data-policy>([^<]+)<\/p>/g)].map((match) => match[1]?.replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&'));
assert.ok(localParagraphs.length >= 7);
assert.deepEqual(publicParagraphs, localParagraphs, 'public and in-app privacy wording must stay identical');
assert.ok(textOf(privacyTree).includes('Android peut sauvegarder ou transférer'), 'policy must not hide Android system backups');
assert.ok(textOf(privacyTree).includes('Effacer les données'), 'policy must explain local deletion');
assert.ok(textOf(privacyTree).includes('sanrandry (GitHub)') && textOf(privacyTree).includes('sinrandry@gmail.com'), 'privacy must identify the confirmed publisher and contact');
assert.ok(!/à confirmer|à compléter|TODO/i.test(textOf(privacyTree)), 'never ship a draft privacy placeholder');
assert.ok(!/<script\b|<iframe\b/i.test(publicPrivacy), 'public policy must remain plain HTML without tracking or login');

console.log(`mobile self-check: ${SAMPLE_KEYS.length} samples; saved attempts/bookmarks, guided lessons, 15×7 construction steps, piano geometry/font scaling, disclosure, theme, launcher assets/native menu icons, privacy parity/entry point, minimal audio permissions, playback and native release ordering verified; native rendering not tested`);
