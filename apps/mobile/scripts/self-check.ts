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
  type StorageAdapter,
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

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const audioSampleDirectory = join(scriptDirectory, "..", "assets", "audio");

async function verifyAudioSamplesAndPlaybackModel() {
  assert.equal(SAMPLE_KEYS.length, 24, "both complete chromatic octaves must be mapped");

  for (const name of SAMPLE_KEYS) {
    const sampleBytes = await readFile(join(audioSampleDirectory, `${name}.wav`));

    assert.equal(
      sampleBytes.subarray(0, 4).toString("ascii"),
      "RIFF",
      `${name}.wav must be a RIFF file`
    );
    assert.equal(
      sampleBytes.subarray(8, 12).toString("ascii"),
      "WAVE",
      `${name}.wav must be a WAVE file`
    );
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
  assert.equal((await readFile(join(audioSampleDirectory, "C4.wav"))).equals(await readFile(join(audioSampleDirectory, "C5.wav"))), false, "upper pitches must be direct samples, not aliases");

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
}

await verifyAudioSamplesAndPlaybackModel();

const storedProgress = recordAttempt(
  createEmptyProgress(),
  {
    exerciseType: "build-scale",
    scaleId: "C",
    correct: true
  },
  new Date("2026-08-10T09:00:00.000Z"),
);

async function verifyProgressHydrationAndSerializedSaves() {
  const merged = mergePendingAttempts(storedProgress, [{
    input: {
      exerciseType: "find-error",
      scaleId: "G",
      correct: false
    },
    at: new Date("2026-08-11T09:00:00.000Z"),
  }]);

  assert.equal(merged.attempts.length, 2, "pre-hydration attempts must merge with loaded attempts");
  assert.deepEqual(merged.attempts.map(({ scaleId }) => scaleId), ["C", "G"]);
  const advancedProgress = mergePendingAttempts(storedProgress, [{
    input: {
      exerciseType: "build-scale",
      scaleId: "C",
      correct: true
    },
    at: new Date("2026-08-11T09:00:00.000Z"),
  }]);

  assert.equal(advancedProgress.reviews.C?.stage, 1, "pending reviews must advance from the hydrated schedule");
  assert.equal(advancedProgress.streak, 2, "pending attempts must extend the hydrated local-day streak");
  assert.equal(shouldPersistHydration(false, 1), false, "unsafe fallback loads must never be overwritten");
  assert.equal(shouldPersistHydration(true, 0), false, "hydration alone must not write an empty snapshot");
  assert.equal(shouldPersistHydration(true, 1), true);
  const validLoad: PersistenceResult = {
    state: storedProgress,
    warning: null,
    status: "valid",
    canSave: true
  };
  const hydration = resolveHydration(validLoad, [{
    input: {
      exerciseType: "find-error",
      scaleId: "G",
      correct: false
    },
    at: new Date("2026-08-11T09:00:00.000Z"),
  }]);

  assert.equal(hydration.shouldSave, true);
  assert.equal(decodeProgress(JSON.stringify(hydration.progress)).state.attempts.length, 2, "hydrated pending progress must survive save and reload");
  assert.equal(persistenceWarningAfterSave(null), undefined, "a successful save must clear a stale persistence warning");

  let loadAttempts = 0;
  const retriedLoad = await loadProgressWithRetry(async () => {
    loadAttempts += 1;

    return loadAttempts === 1
      ? {
        state: createEmptyProgress(),
        warning: "temporaire",
        status: "unavailable",
        canSave: false
      }
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

    if (snapshot === "old") await new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

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
    if (snapshot === "stale" && !releaseStale) await new Promise<void>((resolve) => {
      releaseStale = resolve;
    });

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
}

await verifyProgressHydrationAndSerializedSaves();

function verifyExerciseAdaptersAndResponses() {
  const createSequenceRandom = (values: readonly number[]) => {
    let index = 0;

    return () => values[index++] ?? 0.123456;
  };
  const exerciseTypes: readonly ExerciseType[] = ["complete-scale", "build-scale", "find-accidentals", "identify-interval", "find-error"];

  for (const [index, expected] of exerciseTypes.entries()) {
    const exercise = makeExercise({
      generation: index,
      preferredScaleId: "C",
      rng: createSequenceRandom([(index + 0.1) / exerciseTypes.length])
    });

    assert.equal(exercise?.kind, expected, `random adapter must reach ${expected}`);
    assert.equal(exercise?.sourceScaleId, "C", "a scale route must stay scoped on every exercise");
  }

  const catalogIds = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];

  for (const [index, expected] of catalogIds.entries()) {
    const exercise = makeExercise({ generation: index, rng: createSequenceRandom([(index + 0.1) / catalogIds.length, 0.01]) });

    assert.equal(exercise?.sourceScaleId, expected, `random adapter must reach scale ${expected}`);
  }

  const focusDate = new Date("2026-08-11T12:00:00.000Z");
  const errorProne = recordAttempt(
    createEmptyProgress(),
    {
      exerciseType: "find-error",
      scaleId: "E",
      correct: false
    },
    new Date("2026-08-10T09:00:00.000Z"),
    () => 0.25,
  );

  for (let generation = 0; generation < 5; generation += 1) {
    assert.equal(selectExerciseScale({
      generation,
      progress: errorProne,
      rng: () => 0.5,
      now: focusDate
    })?.id, "E", "due error-prone scales must receive deterministic extra weight");
  }

  assert.equal(selectExerciseScale({
    generation: 0,
    preferredScaleId: "Cb",
    progress: errorProne,
    rng: () => 0,
    now: focusDate
  })?.id, "Cb", "an explicit scale route must always remain fixed");
  assert.equal(makeExercise({
    generation: 0,
    progress: errorProne,
    rng: () => .5,
    now: focusDate
  })?.sourceScaleId, "E", "the exercise bridge must forward progress and time into scale selection");

  const buildExercise = makeExercise({
    generation: 0,
    preferredScaleId: "C",
    rng: createSequenceRandom([0.21])
  });

  assert.ok(buildExercise);
  assert.equal(buildExercise.selectionMode, "ordered");
  const orderedLabels = buildExercise.domainExercise.correctAnswer.map((answer) => {
    const entry = Object.entries(buildExercise.optionPayloads).find(([, payload]) => payload[0] === answer);

    assert.ok(entry, `missing mobile option for ${answer}`);

    return entry[0];
  });

  assert.deepEqual(selectionPayload(orderedLabels, buildExercise.optionPayloads), buildExercise.domainExercise.correctAnswer);
  const correctGrade = gradeSelection(buildExercise, orderedLabels);

  assert.equal(correctGrade.correct, true, "ordered mobile payload must grade correctly");
  const wrongLabels = [...orderedLabels];
  [wrongLabels[1], wrongLabels[2]] = [wrongLabels[2] as string, wrongLabels[1] as string];
  const wrongGrade = gradeSelection(buildExercise, wrongLabels);

  assert.equal(wrongGrade.correct, false);
  assert.deepEqual(
    wrongGrade.errors.map(({ index }) => index),
    [1, 2],
    "mobile grading must preserve positional feedback"
  );

  const eAccidentals = makeExercise({
    generation: 0,
    preferredScaleId: "E",
    rng: createSequenceRandom([0.41])
  });

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

  const cAccidentals = makeExercise({
    generation: 0,
    preferredScaleId: "C",
    rng: createSequenceRandom([0.41])
  });

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
  const answered = {
    exerciseId: "old",
    selected: ["Do"],
    grade: correctGrade
  };

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

}

function verifyThemePreferences() {
  assert.equal(shouldApplyStoredPreference(0, 0), true);
  assert.equal(shouldApplyStoredPreference(0, 1), false, "late theme hydration must not replace an explicit choice");
  assert.deepEqual([nextThemePreference("system"), nextThemePreference("light"), nextThemePreference("dark")], ["light", "dark", "system"]);
}

verifyExerciseAdaptersAndResponses();
verifyThemePreferences();

// ponytail: execute real TSX with host stubs for prop/element checks; device tests still own native layout and accessibility.
async function loadComponentModule(
  path: string,
  mocks: Record<string, unknown>,
  globals: Record<string, unknown> = {}
) {
  const filename = resolve(scriptDirectory, path);
  const require = createRequire(filename);
  const source = ts.transpileModule(await readFile(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(
    source,
    {
      exports: module.exports,
      module,
      require: (name: string) => mocks[name] ?? require(name),
      ...globals
    },
    { filename }
  );

  return module.exports;
}

function collectElements(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(collectElements);
  if (!isValidElement<any>(node))
    return node === null
      || node === undefined
      || typeof node === "boolean"
      ? []
      : [node];
  if (typeof node.type === "function") return collectElements((node.type as (props: any) => unknown)(node.props));
  if (typeof node.type === "object" && "render" in node.type) return collectElements((node.type as any).render(node.props, null));

  return [node, ...collectElements(node.props.children)];
}
const getTextContent = (node: unknown) => collectElements(node).filter((entry) => typeof entry === "string" || typeof entry === "number").join("");
const flattenStyle = (style: any): any => {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  if (typeof style === "object") return style;

  return undefined;
};

assert.equal(flattenStyle(null), null);
assert.equal(flattenStyle(undefined), undefined);
const nativeStyleSheet = { create: (styles: unknown) => styles, flatten: flattenStyle };
const themes = await loadComponentModule("../src/theme.tsx", {
  "react-native": {},
  "./progress-state": {},
  "./theme-state": {},
});
let currentTheme = themes.light;
let fontScaleForScreen = 1;
const piano = await loadComponentModule("../src/piano.tsx", {
  react: { useRef: (initial: unknown) => ({ current: initial }) },
  "react-native": {
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    Text: "Text",
    View: "View",
    StyleSheet: nativeStyleSheet,
    useWindowDimensions: () => ({ fontScale: fontScaleForScreen }),
  },
  "@notescale/music": music,
  "./theme": { useTheme: () => currentTheme },
});
const components = await loadComponentModule("../src/components.tsx", {
  "react-native": {
    Pressable: "Pressable",
    TouchableOpacity: "TouchableOpacity",
    ScrollView: "ScrollView",
    Text: "Text",
    View: "View",
    StyleSheet: nativeStyleSheet
  },
  "./piano": piano,
  "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
  "expo-router": { Link: "Link" },
  "./theme": { useTheme: () => currentTheme },
});

assert.equal(components.Piano, piano.Piano, "component exports must retain the extracted piano");
const mobileRequire = createRequire(join(scriptDirectory, "../package.json"));
const composeRefs = mobileRequire("@radix-ui/react-compose-refs");
const radixSlot = await loadComponentModule(mobileRequire.resolve("@radix-ui/react-slot"), {
  "@radix-ui/react-compose-refs": { ...composeRefs, useComposedRefs: composeRefs.composeRefs },
});
const nativeSlot = await loadComponentModule(
  mobileRequire.resolve("expo-router/build/ui/Slot.js"),
  {
    react: { ...mobileRequire("react"), useMemo: (factory: () => unknown) => factory() },
    "@radix-ui/react-slot": radixSlot,
    "react-native": { StyleSheet: nativeStyleSheet },
  },
  { process }
);
// Exercise Expo Router's installed Slot and Radix prop merging, not a permissive Link stub.
for (const theme of [themes.light, themes.dark]) for (const secondary of [false, true]) {
  currentTheme = theme;
  const link = components.RouteAction!({
    label: "Ouvrir",
    accessibilityLabel: "Ouvrir la leçon",
    href: "/learn",
    secondary
  });
  let navigated = false;
  const tree = collectElements(createElement(nativeSlot.Slot, {
    onPress: () => {
      navigated = true;
    }
  }, link.props.children));
  const control = tree.find((entry) => entry?.type === "Pressable" || entry?.type === "TouchableOpacity");
  const style = flattenStyle(typeof control.props.style === "function" ? control.props.style({ pressed: false }) : control.props.style);

  assert.equal(
    style.backgroundColor,
    secondary ? theme.surface : theme.primary,
    "router Slot must preserve a readable button background"
  );
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
  const screen = await loadComponentModule(path, {
    [`${prefix}/components`]: components,
    [`${prefix}/domain`]: domain,
    [`${prefix}/audio`]: { AudioControls: () => null },
    [`${prefix}/theme`]: { useTheme: () => currentTheme },
    [`${prefix}/progress`]: { useProgress: () => ({}) },
    "react-native": { View: "View" },
    "expo-router": { useIsFocused: () => true }
  });
  const links = collectElements(screen.default()).filter((entry) => entry?.type === "Link" && entry.props.href.pathname === pathname);

  assert.equal(links.length, destinations.length);
  const labels = links.map((link, index) => {
    const destination = destinations[index]!;
    const pressable = collectElements(link.props.children).find((entry) => entry?.type === "Pressable" || entry?.type === "TouchableOpacity");

    assert.equal(link.props.href.params.id, destination.id, "contextual names must preserve their route destination");
    assert.equal(
      getTextContent(pressable),
      "title" in destination ? destination.title : visibleLabel,
      "each lesson names its destination, catalogue retains construction access"
    );
    assert.ok(pressable.props.accessibilityLabel.includes("title" in destination ? destination.title : destination.frenchName));

    return pressable.props.accessibilityLabel;
  });

  assert.equal(new Set(labels).size, destinations.length, "every repeated native link needs a distinct accessible name");
}
for (const [name, roles] of [["Action", ["button", "radio"]], ["Chip", ["button", "radio", "checkbox"]]] as const) {
  for (const role of roles) for (const selected of [false, true]) {
    const control = collectElements(components[name]!({
      label: "Do",
      role,
      selected,
      onPress: () => undefined
    }))[0];

    assert.equal(control.props.accessibilityRole, role);
    assert.equal(control.props.accessibilityLabel, "Do", "selection marker must not pollute the accessible name");
    assert.deepEqual({ ...control.props.accessibilityState }, role === "button" ? { disabled: false, selected } : { disabled: false, checked: selected });
    assert.equal(
      getTextContent(control),
      selected ? "✓ Do" : "Do",
      "only selected options need a non-color marker"
    );
    const style = typeof control.props.style === "function" ? control.props.style({ pressed: false }) : control.props.style;

    assert.ok(style.some((entry: any) => entry.maxWidth === "100%" && entry.flexShrink === 1), "long actions must reuse chip width bounds");
  }
}

let progressForScreen = createEmptyProgress();
let hydratedForScreen = false;
const progressScreen = await loadComponentModule("../app/(tabs)/progress.tsx", {
  "../../src/components": components,
  "../../src/domain": domain,
  "@notescale/music": music,
  "react-native": { View: "View" },
  "../../src/progress": {
    useProgress: () => ({
      progress: progressForScreen,
      hydrated: hydratedForScreen,
      warning: "Avertissement local"
    })
  },
});

assert.ok(getTextContent(progressScreen.default()).includes("Lecture de ta progression locale."));
assert.ok(!getTextContent(progressScreen.default()).includes("Ta première gamme t’attend"));
hydratedForScreen = true;

for (let count = 0; count <= 2; count += 1) {
  const tree = collectElements(progressScreen.default());
  const text = getTextContent(progressScreen.default());

  if (count === 0) {
    assert.ok(text.includes("Ta première gamme t’attend"));
    assert.ok(!text.includes("0 %")
      && !text.includes("0 jours")
      && !text.includes("0 exercices"), "first-use progress must not present empty metrics");
  } else {
    assert.ok(text.includes(count === 1 ? "exercice réalisé" : "exercices réalisés"));
    assert.ok(text.includes(`${count} ${count === 1 ? "bonne réponse" : "bonnes réponses"}`));
    assert.ok(text.includes("1 jour"));
    assert.ok(text.includes("Aucune gamme à revoir pour le moment."));
  }

  assert.ok(text.includes("Avertissement local"), "progress warnings must survive empty-state polish");
  assert.ok(tree.some((entry) => entry?.type === "Link" && entry.props.href === "/exercises"));
  progressForScreen = recordAttempt(
    progressForScreen,
    {
      scaleId: "C",
      exerciseType: "build-scale",
      correct: true
    },
    new Date(),
    () => count / 3
  );
}

// Host/player hooks are deliberately stubbed: this executes controller + renderer, not native audio or layout.
for (const compact of [false, true]) {
  const hooks: any[] = [];
  let hookIndex = 0;
  const useState = (initial?: any) => {
    const index = hookIndex++;

    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;

    return [hooks[index], (next: any) => {
      hooks[index] = typeof next === "function" ? next(hooks[index]) : next;
    }];
  };
  let failPlayback = false;
  let timerCallback: (() => void) | undefined;
  const player = {
    play: () => {
      if (failPlayback) throw new Error("Test playback failure");
    },
    pause: () => undefined,
    seekTo: async () => undefined,
    replace: () => undefined,
    setPlaybackRate: () => undefined
  };
  const audio = await loadComponentModule(
    "../src/audio.tsx",
    {
      "@notescale/music": music,
      "./audio-model": audioModel,
      "./components": components,
      "./piano": piano,
      "react-native": { View: "View" },
      react: {
        useState,
        useRef: (initial: unknown) => useState({ current: initial })[0],
        useEffect: () => undefined
      },
      "expo-audio": { useAudioPlayer: () => player, setAudioModeAsync: async () => undefined },
      ...Object.fromEntries(SAMPLE_KEYS.map((key, index) => [`../assets/audio/${key}.wav`, index + 1])),
    },
    {
      setTimeout: (callback: () => void) => {
        timerCallback = callback;

        return 1;
      },
      clearTimeout: () => {
        timerCallback = undefined;
      }
    }
  );
  let rendered: unknown;
  const renderAudio = () => {
    hookIndex = 0;
    rendered = audio.AudioControls!({
      notes: ["Do"],
      compact,
      piano: true,
      scaleLabel: "Do majeur"
    });

    return getTextContent(rendered);
  };
  const control = (label: string) => collectElements(rendered)
    .find((entry) =>
      entry?.type === "Pressable"
      && entry.props.accessibilityLabel === `${label} la gamme Do majeur`
    );
  const press = (label: string) => {
    assert.equal(control(label).props.disabled, false);
    control(label).props.onPress();
  };

  assert.equal(renderAudio().includes("Lecture prête."), !compact);
  assert.equal(control("Pause"), undefined, "stopped audio must not expose a useless pause action");

  if (!compact) {
    const pressDisclosure = (label: string) => collectElements(rendered)
      .find((entry) =>
        entry?.type === "Pressable"
        && entry.props.accessibilityLabel === label
      )
      .props.onPress();

    assert.ok(!getTextContent(rendered).includes("Ascendante"), "advanced settings must start collapsed");
    pressDisclosure("Afficher le piano");
    renderAudio();
    assert.equal(
      collectElements(rendered)
        .filter((entry) => entry?.props?.accessibilityHint === "Joue cette hauteur avec un fichier audio local")
        .length,
      12
    );
    assert.ok(!getTextContent(rendered).includes("Écouter une note, depuis"), "piano must replace, not duplicate, the note buttons");
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
    useState: (initial: unknown) => [initial, () => {
      stateUpdates += 1;
    }],
    useRef: (initial: unknown) => ({ current: initial }),
    useMemo: (factory: () => unknown) => factory(),
    useEffect: (effect: () => (() => void) | void) => {
      effects.push(effect);
    },
  };
  const releasing = await loadComponentModule(join(dirname(mobileRequire.resolve("expo-modules-core/package.json")), "src/hooks/useReleasingSharedObject.ts"), { react: reactHooks });
  let released = false;
  const assertLive = () => assert.equal(released, false, "Cannot use shared object that was already released");
  const player = {
    play: assertLive,
    pause: assertLive,
    replace: assertLive,
    setPlaybackRate: assertLive,
    seekTo: async () => assertLive(),
    release: () => {
      assertLive();
      released = true;
    },
  };
  let timerCallback: (() => void) | undefined;
  const audio = await loadComponentModule(
    "../src/audio.tsx",
    {
      "@notescale/music": music,
      "./audio-model": audioModel,
      "./components": components,
      "./piano": piano,
      "react-native": { View: "View" },
      react: reactHooks,
      "expo-audio": {
        useAudioPlayer: () => releasing.useReleasingSharedObject!(() => player, []),
        setAudioModeAsync: async () => undefined
      },
      ...Object.fromEntries(SAMPLE_KEYS.map((key, index) => [`../assets/audio/${key}.wav`, index + 1])),
    },
    {
      setTimeout: (callback: () => void) => {
        timerCallback = callback;

        return 1;
      },
      clearTimeout: () => {
        timerCallback = undefined;
      }
    }
  );
  const tree = collectElements(audio.AudioControls!({ notes: ["Do"], compact }));
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


// Execute providers with injected ports and real persistence helpers, without native storage.
const lessonPersistence = await import("../src/progress-state.js");
const themeState = await import("../src/theme-state.js");
const waitForLessonStorageTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function mountStorageProvider({ path, name, storage }: {
  path: string;
  name: string;
  storage: StorageAdapter
}) {
  const hooks: any[] = [];
  const effects = new Map<number, {
    dependencies: readonly unknown[] | undefined;
    cleanup: (() => void) | void
  }>();
  let pendingEffects: (() => void)[] = [];
  let hookIndex = 0;
  let stateUpdates = 0;
  let suppliedStorage = storage;
  const sameDependencies = (previous: readonly unknown[] | undefined, next: readonly unknown[] | undefined) =>
    Boolean(previous
      && next
      && previous.length === next.length
      && previous.every((value, index) => Object.is(value, next[index])));
  const useState = (initial?: any) => {
    const index = hookIndex++;

    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;

    return [hooks[index], (next: any) => {
      stateUpdates += 1;
      hooks[index] = typeof next === "function" ? next(hooks[index]) : next;
    }];
  };
  const useMemo = (factory: () => unknown, dependencies: readonly unknown[]) => {
    const index = hookIndex++;

    if (!hooks[index] || !sameDependencies(hooks[index].dependencies, dependencies)) {
      hooks[index] = { value: factory(), dependencies };
    }

    return hooks[index].value;
  };
  const provider = await loadComponentModule(path, {
    "@notescale/music": music,
    "./progress-state": lessonPersistence,
    "./theme-state": themeState,
    "react-native": { useColorScheme: () => "light" },
    react: {
      createContext: () => ({ Provider: name }),
      useState,
      useRef: (initial: unknown) => useState({ current: initial })[0],
      useMemo,
      useCallback: (callback: unknown, dependencies: readonly unknown[]) => useMemo(() => callback, dependencies),
      useEffect: (effect: () => (() => void) | void, dependencies?: readonly unknown[]) => {
        const index = hookIndex++;
        const previous = effects.get(index);

        if (!previous || !sameDependencies(previous.dependencies, dependencies)) pendingEffects.push(() => {
          previous?.cleanup?.();
          effects.set(index, { dependencies, cleanup: effect() });
        });
      },
    },
  });
  const value = (replacementStorage?: StorageAdapter) => {
    if (replacementStorage) suppliedStorage = replacementStorage;

    hookIndex = 0;
    const contextValue = provider[name]!({ storage: suppliedStorage }).props.value;
    const effectsToRun = pendingEffects;
    pendingEffects = [];
    effectsToRun.forEach((effect) => effect());

    return contextValue;
  };
  value();

  return {
    value,
    updates: () => stateUpdates,
    unmount: () => effects.forEach(({ cleanup }) => cleanup?.())
  };
}
const mountLessonProgress = (storage: StorageAdapter) => mountStorageProvider({
  path: "../src/progress.tsx",
  name: "ProgressProvider",
  storage
});
const mountTheme = (storage: StorageAdapter) => mountStorageProvider({
  path: "../src/theme.tsx",
  name: "ThemeProvider",
  storage
});

for (const storedLesson of ["tones", "obsolete-lesson", null]) {
  const writes: string[] = [];
  const provider = await mountLessonProgress({
    getItem: (key) => key === "notescale.lesson.v1" ? storedLesson : JSON.stringify(storedProgress),
    setItem: (key) => {
      writes.push(key);
    },
  });

  assert.equal(provider.value().lessonHydrated, false);
  await waitForLessonStorageTick();
  assert.equal(provider.value().lessonHydrated, true);
  assert.equal(
    provider.value().lastLessonId,
    storedLesson === "tones" ? "tones" : undefined,
    "only real lesson IDs can become a resume destination"
  );
  assert.deepEqual(provider.value().progress.attempts, storedProgress.attempts, "bookmark hydration must retain exercise history");
  assert.equal(writes.length, 0, "reading a bookmark must not mark a lesson read or rewrite progress");
  provider.unmount();
}

let resolveStoredLesson: (id: string) => void = () => undefined;
const pendingStoredLesson = new Promise<string>((resolve) => {
  resolveStoredLesson = resolve;
});
const lessonWrites: [string, string][] = [];
const lessonStore = new Map<string, string>([["notescale.progress.v1", JSON.stringify(storedProgress)]]);
const setLessonItem = async (key: string, value: string) => {
  lessonWrites.push([key, value]);
  lessonStore.set(key, value);
};
const providerWithPendingLesson = await mountLessonProgress({
  getItem: async (key) => key === "notescale.lesson.v1" ? pendingStoredLesson : lessonStore.get(key) ?? null,
  setItem: setLessonItem,
});
providerWithPendingLesson.value().rememberLesson("formula");
providerWithPendingLesson.value().rememberLesson("d-major");
providerWithPendingLesson.value().rememberLesson("not-a-lesson");
resolveStoredLesson("tones");
await waitForLessonStorageTick();
assert.equal(providerWithPendingLesson.value().lastLessonId, "d-major", "a late stored bookmark must not replace the latest focused lesson");
assert.deepEqual(
  lessonWrites,
  [
    ["notescale.lesson.v1", "formula"],
    ["notescale.lesson.v1", "d-major"]
  ],
  "lesson changes must serialize into their own key only"
);
assert.deepEqual(providerWithPendingLesson.value().progress.attempts, storedProgress.attempts);
providerWithPendingLesson.unmount();
const reloadedLessonProvider = await mountLessonProgress({ getItem: async (key) => lessonStore.get(key) ?? null, setItem: setLessonItem });
await waitForLessonStorageTick();
assert.equal(reloadedLessonProvider.value().lastLessonId, "d-major", "last opened lesson must survive a new provider instance");
reloadedLessonProvider.unmount();
let lessonWriteFails = true;
const providerWithFailedLessonStorage = await mountLessonProgress({
  getItem: async (key) => {
    if (key === "notescale.lesson.v1") throw new Error("read failed");

    return JSON.stringify(storedProgress);
  },
  setItem: async () => {
    if (lessonWriteFails) throw new Error("write failed");
  },
});
await waitForLessonStorageTick();
assert.equal(providerWithFailedLessonStorage.value().lessonHydrated, true, "failed bookmark reads must not trap users in loading");
assert.ok(providerWithFailedLessonStorage.value().lessonWarning.includes("retrouvée"));
providerWithFailedLessonStorage.value().rememberLesson("notes");
await waitForLessonStorageTick();
assert.equal(providerWithFailedLessonStorage.value().lastLessonId, "notes", "storage failure must not block learning in this session");
assert.ok(providerWithFailedLessonStorage.value().lessonWarning.includes("pas été enregistrée"));
lessonWriteFails = false;
providerWithFailedLessonStorage.value().rememberLesson("tones");
await waitForLessonStorageTick();
assert.equal(providerWithFailedLessonStorage.value().lessonWarning, undefined);
providerWithFailedLessonStorage.unmount();

for (const rawProgress of ["{broken", '{"version":2}', null]) {
  const writes: [string, string][] = [];
  const provider = await mountLessonProgress({
    getItem: (key) => key === "notescale.progress.v1" ? rawProgress : null,
    setItem: (key, value) => {
      writes.push([key, value]);
    },
  });
  await waitForLessonStorageTick();
  assert.equal(provider.value().hydrated, true);
  assert.equal(writes.length, 0, "hydration must not rewrite stored bytes");
  provider.value().recordAttempt("G", true, "build-scale");
  await waitForLessonStorageTick();
  assert.equal(provider.value().progress.attempts.length, 1, "unsafe storage must still allow in-memory training");
  assert.equal(
    writes.length,
    rawProgress === null ? 1 : 0,
    "corrupt/incompatible bytes must remain protected"
  );

  if (writes[0]) {
    assert.equal(writes[0][0], music.PROGRESS_STORAGE_KEY);
    assert.deepEqual(music.decodeProgress(writes[0][1]).state.attempts, provider.value().progress.attempts);
  }

  provider.unmount();
}

const synchronouslyFailingStorage: StorageAdapter = {
  getItem: () => {
    throw new Error("sync read failure");
  },
  setItem: () => {
    throw new Error("sync write failure");
  },
};
const syncFailureProvider = await mountLessonProgress(synchronouslyFailingStorage);
await waitForLessonStorageTick();
assert.equal(syncFailureProvider.value().hydrated, true);
assert.equal(syncFailureProvider.value().lessonHydrated, true);
assert.ok(syncFailureProvider.value().warning);
assert.ok(syncFailureProvider.value().lessonWarning);
syncFailureProvider.value().rememberLesson("notes");
await waitForLessonStorageTick();
assert.ok(syncFailureProvider.value().lessonWarning.includes("pas été enregistrée"));
syncFailureProvider.unmount();

const progressWriteFailure = await mountLessonProgress({
  getItem: () => null,
  setItem: () => {
    throw new Error("sync progress write failure");
  },
});
await waitForLessonStorageTick();
progressWriteFailure.value().recordAttempt("C", false, "find-error");
await waitForLessonStorageTick();
assert.ok(progressWriteFailure.value().warning.includes("enregistrée"));
assert.equal(progressWriteFailure.value().progress.attempts.length, 1);
progressWriteFailure.unmount();

for (const preference of ["dark", "light", "system", "invalid", null]) {
  const writes: [string, string][] = [];
  const provider = await mountTheme({
    getItem: () => preference,
    setItem: (key, value) => {
      writes.push([key, value]);
    },
  });
  await waitForLessonStorageTick();
  assert.equal(provider.value().preference, preference === "dark" || preference === "light" ? preference : "system");
  assert.equal(writes.length, 0);
  provider.value().cyclePreference();
  provider.value().cyclePreference();
  await waitForLessonStorageTick();
  assert.deepEqual(writes.map(([key]) => key), ["notescale.theme", "notescale.theme"]);
  assert.equal(writes[1]?.[1], provider.value().preference, "theme writes must remain FIFO and use their existing raw format");
  provider.unmount();
}
for (const storage of [synchronouslyFailingStorage, {
  getItem: async () => {
    throw new Error("rejected read");
  },
  setItem: async () => {
    throw new Error("rejected write");
  },
}]) {
  const provider = await mountTheme(storage);
  await waitForLessonStorageTick();
  provider.value().cyclePreference();
  await waitForLessonStorageTick();
  assert.equal(provider.value().preference, "light", "theme storage failures must not block local preference changes");
  provider.unmount();
}

for (const mount of [mountLessonProgress, mountTheme]) {
  let finishRead: (value: string) => void = () => undefined;
  const pendingRead = new Promise<string>((resolve) => {
    finishRead = resolve;
  });
  const provider = await mount({ getItem: () => pendingRead, setItem: () => undefined });
  await Promise.resolve();
  provider.unmount();
  const previousUpdates = provider.updates();
  finishRead("dark");
  await waitForLessonStorageTick();
  assert.equal(provider.updates(), previousUpdates, "late storage reads must not update unmounted providers");
}

let finishThemeRead: (value: string) => void = () => undefined;
const pendingThemeRead = new Promise<string>((resolve) => {
  finishThemeRead = resolve;
});
const lateThemeProvider = await mountTheme({ getItem: () => pendingThemeRead, setItem: () => undefined });
lateThemeProvider.value().cyclePreference();
finishThemeRead("dark");
await waitForLessonStorageTick();
assert.equal(lateThemeProvider.value().preference, "light", "late theme hydration must not replace an explicit selection");
lateThemeProvider.unmount();

let finishProgressHydration: (value: string) => void = () => undefined;
const pendingProgressHydration = new Promise<string>((resolve) => {
  finishProgressHydration = resolve;
});
const hydrationWrites: [string, string][] = [];
const earlyAttemptProvider = await mountLessonProgress({
  getItem: (key) => key === music.PROGRESS_STORAGE_KEY ? pendingProgressHydration : null,
  setItem: (key, value) => {
    hydrationWrites.push([key, value]);
  },
});
earlyAttemptProvider.value().recordAttempt("C", false, "find-error");
earlyAttemptProvider.value().recordAttempt("G", true, "build-scale");
assert.equal(earlyAttemptProvider.value().hydrated, false);
assert.equal(earlyAttemptProvider.value().progress.attempts.length, 0);
assert.deepEqual(hydrationWrites, [], "early attempts must wait for the stored history before saving");
finishProgressHydration(JSON.stringify(storedProgress));
await waitForLessonStorageTick();
const mergedProgress = earlyAttemptProvider.value().progress;

assert.equal(earlyAttemptProvider.value().hydrated, true);
assert.equal(mergedProgress.attempts.length, 3);
assert.deepEqual(mergedProgress.attempts[0], storedProgress.attempts[0]);
assert.deepEqual(mergedProgress.attempts.slice(1).map(({ scaleId, correct, exerciseType }: music.Attempt) => ({
  scaleId,
  correct,
  exerciseType
})), [
  {
    scaleId: "C",
    correct: false,
    exerciseType: "find-error"
  },
  {
    scaleId: "G",
    correct: true,
    exerciseType: "build-scale"
  },
]);
assert.equal(mergedProgress.reviews.C.stage, -1);
assert.equal(mergedProgress.reviews.G.stage, 0);
assert.deepEqual(
  hydrationWrites,
  [
    [music.PROGRESS_STORAGE_KEY, music.encodeProgress(mergedProgress)]
  ],
  "hydration must save exactly the merged snapshot, including its review schedule and streak"
);
earlyAttemptProvider.unmount();

for (const [mount, key] of [[mountLessonProgress, music.PROGRESS_STORAGE_KEY], [mountTheme, "notescale.theme"]] as const) {
  const reads: string[] = [];
  const writes: [string, string][] = [];
  const landedValues: string[] = [];
  const replacementCalls: string[] = [];
  let releaseFirstWrite: () => void = () => undefined;
  const pendingFirstWrite = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  const provider = await mount({
    getItem: (readKey) => {
      reads.push(readKey);

      return readKey === music.PROGRESS_STORAGE_KEY ? JSON.stringify(storedProgress) : "system";
    },
    setItem: async (writeKey, value) => {
      writes.push([writeKey, value]);

      if (writes.length === 1) await pendingFirstWrite;

      landedValues.push(value);
    },
  });
  await waitForLessonStorageTick();

  if (key === music.PROGRESS_STORAGE_KEY) provider.value().recordAttempt("C", true, "build-scale");
  else provider.value().cyclePreference();

  await waitForLessonStorageTick();
  assert.equal(writes.length, 1);
  const originalReads = [...reads];
  provider.value({
    getItem: (readKey) => {
      replacementCalls.push(`read:${readKey}`);

      return null;
    },
    setItem: (writeKey) => {
      replacementCalls.push(`write:${writeKey}`);
    },
  });

  if (key === music.PROGRESS_STORAGE_KEY) provider.value().recordAttempt("G", false, "find-error");
  else provider.value().cyclePreference();

  const expectedLatest = key === music.PROGRESS_STORAGE_KEY ? music.encodeProgress(provider.value().progress) : "dark";
  await waitForLessonStorageTick();
  assert.deepEqual(reads, originalReads, "replacement props must not restart hydration");
  assert.deepEqual(replacementCalls, [], "a provider mount must retain its original storage port");
  assert.equal(writes.length, 1, "a genuinely pending async write must block the next write");
  assert.deepEqual(landedValues, []);
  releaseFirstWrite();
  await waitForLessonStorageTick();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map(([writeKey]) => writeKey), [key, key]);
  assert.deepEqual(
    landedValues,
    writes.map(([, value]) => value),
    "async theme/progress saves must finish in FIFO order"
  );
  assert.equal(writes[1]?.[1], expectedLatest);
  assert.deepEqual(replacementCalls, [], "queued saves must remain on the original port after replacement");
  provider.unmount();
}

for (const mount of [mountLessonProgress, mountTheme]) {
  let rejectRead: (error: Error) => void = () => undefined;
  const pendingRead = new Promise<string>((_resolve, reject) => {
    rejectRead = reject;
  });
  const provider = await mount({ getItem: () => pendingRead, setItem: () => undefined });
  await Promise.resolve();
  provider.unmount();
  const updatesAtUnmount = provider.updates();
  rejectRead(new Error("late read rejection"));
  await waitForLessonStorageTick();
  assert.equal(provider.updates(), updatesAtUnmount, "late read failures/retries must not update unmounted providers");

  for (const outcome of ["resolve", "reject"]) {
    let finishSave: () => void = () => undefined;
    let rejectSave: (error: Error) => void = () => undefined;
    let pendingSaveCalls = 0;
    const pendingSave = new Promise<void>((resolve, reject) => {
      finishSave = resolve;
      rejectSave = reject;
    });
    const savingProvider = await mount({
      getItem: () => null,
      setItem: () => {
        pendingSaveCalls += 1;

        return pendingSave;
      }
    });
    await waitForLessonStorageTick();

    if (mount === mountLessonProgress) {
      savingProvider.value().recordAttempt("C", true, "build-scale");
      savingProvider.value().rememberLesson("tones");
    } else savingProvider.value().cyclePreference();

    await waitForLessonStorageTick();
    assert.equal(
      pendingSaveCalls,
      mount === mountLessonProgress ? 2 : 1,
      "saves must actually be pending before unmount"
    );
    savingProvider.unmount();
    const updatesBeforeSettlement = savingProvider.updates();

    if (outcome === "resolve") finishSave();
    else rejectSave(new Error("late save rejection"));

    await waitForLessonStorageTick();
    assert.equal(savingProvider.updates(), updatesBeforeSettlement, "pending progress/bookmark/theme saves must not update state after unmount");
  }
}

let homeLesson: string | undefined;
let homeLessonHydrated = true;
const home = await loadComponentModule("../app/(tabs)/index.tsx", {
  "../../src/components": components,
  "../../src/domain": domain,
  "../../src/progress": {
    useProgress: () => ({
      progress: createEmptyProgress(),
      lastLessonId: homeLesson,
      lessonHydrated: homeLessonHydrated
    })
  },
  "../../src/theme": { useThemePreference: () => ({ preference: "system", cyclePreference: () => undefined }) },
});

for (const id of [undefined, "formula"]) {
  homeLesson = id;
  const tree = collectElements(home.default());
  const primaryLinks = tree.filter((node) => node?.type === "Link" && flattenStyle(node.props.children.props.style).borderWidth === 0);

  assert.equal(primaryLinks.length, 1, "home must have one main route action");
  assert.equal(primaryLinks[0].props.href.params.id, id ?? "notes");
  assert.ok(getTextContent(primaryLinks[0]).includes(id ? "Continuer la leçon" : "Commencer"));
}

homeLessonHydrated = false;
assert.equal(
  collectElements(home.default()).some((node) => node?.type === "Link" && node.props.href.pathname === "/lesson/[id]"),
  false,
  "home must not flash a false start/resume destination during hydration"
);

let inspectedLessonId = "notes";
let inspectedLessonFocused = true;
const rememberedLessons: string[] = [];
const lessonScreen = await loadComponentModule("../app/lesson/[id].tsx", {
  "../../src/components": components,
  "@notescale/music": music,
  "../../src/audio": { AudioControls: "LessonAudioControls" },
  "../../src/progress": { useProgress: () => ({ rememberLesson: (id: string) => rememberedLessons.push(id) }) },
  react: { useCallback: (callback: unknown) => callback },
  "expo-router": {
    useLocalSearchParams: () => ({ id: inspectedLessonId }),
    useIsFocused: () => inspectedLessonFocused,
    useFocusEffect: (callback: () => void) => {
      if (inspectedLessonFocused) callback();
    }
  },
});

for (let index = 0; index < music.LESSONS.length; index += 1) {
  const lesson = music.LESSONS[index]!;
  inspectedLessonId = lesson.id;
  const rendered = lessonScreen.default();
  const text = getTextContent(rendered);

  assert.equal(rendered.props.nativeHeader, true);
  assert.equal(rendered.key, lesson.id, "changing lesson must reset its reading scroll container");

  for (const content of [
    lesson.summary,
    ...lesson.paragraphs,
    ...(lesson.notes ?? [])
  ])
    assert.ok(
      text.includes(content),
      "compact lessons must preserve every original teaching sentence and note mapping"
    );

  const links = collectElements(rendered).filter((node) => node?.type === "Link");
  const nextLesson = music.LESSONS[index + 1];

  if (nextLesson) assert.equal(links[0].props.href.params.id, nextLesson.id, "lesson end must lead straight to the next lesson");
  else assert.equal(links[0].props.href, "/generator", "final lesson must lead to practical construction");

  assert.equal(links[1].props.href, "/(tabs)/learn", "free lesson selection must stay available");
}

assert.deepEqual(rememberedLessons, music.LESSONS.map((lesson) => lesson.id));
inspectedLessonId = "missing";
assert.ok(getTextContent(lessonScreen.default()).includes("Leçon introuvable"));
assert.equal(rememberedLessons.length, music.LESSONS.length, "invalid routes must never replace the bookmark");
inspectedLessonId = "tones";

for (const focused of [true, false, true]) {
  inspectedLessonFocused = focused;
  assert.equal(
    collectElements(lessonScreen.default()).some((node) => node?.type === "LessonAudioControls"),
    focused,
    "leaving a stacked lesson must unmount audio; returning restores idle controls"
  );
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
  const tree = collectElements(piano.Piano!({
    activeNotes: ['Sol', 'La', 'Si', 'Do', 'Ré', 'Mi', 'Fa♯'],
    onPlayNote: (note: string) => played.push(note)
  }));
  const caption = tree.find((node) => node?.type === 'Text' && node.props.children === 'En jaune : notes de la gamme. Fais glisser le clavier.');

  assert.equal(caption.props.accessibilityLiveRegion, 'none', 'piano caption must retain Body accessibility props');
  assert.deepEqual(
    flattenStyle(caption.props.style),
    {
      fontSize: 16,
      lineHeight: 24,
      color: currentTheme.muted
    },
    'piano caption must retain Body typography and muted color'
  );
  const keys = tree.filter((node) => node?.type === 'Pressable');

  assert.equal(keys.length, 12);
  const styles = keys.map((key) => flattenStyle(key.props.style({ pressed: false })));
  const black = styles.filter((style) => style.zIndex === 1);
  const white = styles.filter((style) => style.zIndex === 0);

  assert.equal(white.length, 7);
  assert.equal(black.length, 5);
  black.forEach((style, index) =>
    assert.ok(
      Math.abs(
        (style.left + style.width / 2) / (76 * scale)
        - [1, 2, 4, 5, 6][index]!
      ) < 1e-10,
      'black keys must straddle real white-key seams, never Mi–Fa'
    )
  );

  for (const style of styles) assert.ok(style.width >= 48 && style.height >= 48);

  assert.ok(white[0].height - black[0].height >= 48, 'white keys need an exposed lower touch target');
  keys.forEach((key) => key.props.onPress());
  assert.deepEqual(played, ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
  assert.ok(tree.some((node) => node?.props?.accessibilityLabel === 'Sol, note de la gamme'));
}

fontScaleForScreen = 1;

const generatorHooks: any[] = [];
let generatorHookIndex = 0;
const generatorScreen = await loadComponentModule('../app/generator.tsx', {
  '../src/components': components,
  '../src/domain': domain,
  'react-native': { View: 'View' },
  react: {
    useState: (initial: any) => {
      const index = generatorHookIndex++;

      if (!(index in generatorHooks)) generatorHooks[index] = initial;

      return [generatorHooks[index], (next: any) => {
        generatorHooks[index] = typeof next === 'function' ? next(generatorHooks[index]) : next;
      }];
    }
  },
});
let generatorElements: any[] = [];
const renderGeneratorScreen = () => {
  generatorHookIndex = 0;
  const result = generatorScreen.default();
  generatorElements = collectElements(result);

  return getTextContent(result);
};
const findGeneratorControl = (label: string) => generatorElements.find((node) => node?.type === 'Pressable' && node.props.accessibilityLabel === label);
const pressGeneratorControl = (label: string) => {
  const control = findGeneratorControl(label);

  assert.ok(control && !control.props.disabled, label);
  control.props.onPress();

  return renderGeneratorScreen();
};
renderGeneratorScreen();
assert.deepEqual(generatorElements!.filter((node) => node?.props?.accessibilityRole === 'radio').map((node) => node.props.accessibilityLabel), ['Do', 'Sol', 'Ré']);
assert.equal(findGeneratorControl('Do').props.accessibilityState.checked, true);
pressGeneratorControl('Voir les 15 notes de départ');
assert.equal(generatorElements!.filter((node) => node?.props?.accessibilityRole === 'radio').length, 15);
pressGeneratorControl('Si♭');
pressGeneratorControl('Réduire le choix de notes');
assert.equal(findGeneratorControl('Si♭').props.accessibilityState.checked, true, 'folding the catalogue must keep a selected advanced key visible');
pressGeneratorControl('Voir les 15 notes de départ');

for (const scale of domain.scales) {
  pressGeneratorControl(scale.notes[0]!);
  assert.equal(findGeneratorControl('Étape précédente').props.disabled, true);

  for (let step = 0; step < 7; step += 1) {
    const text = renderGeneratorScreen();
    const current = scale.construction[step]!;

    assert.ok(text.includes(`Étape ${step + 1} sur 7 : ${current.currentNote} + ${current.intervalLabel} → ${current.result}`));
    assert.ok(text.includes(scale.notes.slice(0, step + 2).join(' – ')), 'each preview must preserve exact note spelling and octave return');
    assert.ok(generatorElements.some((node) => node?.type === 'Text' && node.props.accessibilityLabel?.includes(`Étape ${step + 1} :`)), 'formula must identify the active interval accessibly');
    const explanation = pressGeneratorControl('Pourquoi cette note ?');

    assert.ok(explanation.includes(current.naturalCandidate)
      && explanation.includes(current.necessaryAlteration)
      && explanation.includes(current.explanation));
    const after = pressGeneratorControl(step === 6 ? 'Recommencer' : 'Étape suivante');

    assert.ok(!after.includes('Note naturelle suivante :'), 'a step change must close the old explanation');
  }

  assert.equal(findGeneratorControl('Étape précédente').props.disabled, true);
}

pressGeneratorControl('Étape suivante');
pressGeneratorControl('Pourquoi cette note ?');
pressGeneratorControl('Étape précédente');
assert.equal(findGeneratorControl('Étape précédente').props.disabled, true);
assert.ok(findGeneratorControl('Pourquoi cette note ?'));

// Hidden stack screens must unmount audio instead of pausing Expo's already-released player.
for (const [path, prefix, expectedPlayers] of [['../app/scales.tsx', '../src', 15], ['../app/scale/[id].tsx', '../../src', 1]] as const) {
  let focused = true;
  const screen = await loadComponentModule(path, {
    [`${prefix}/components`]: components,
    [`${prefix}/domain`]: domain,
    [`${prefix}/audio`]: { AudioControls: 'AudioControls' },
    [`${prefix}/theme`]: { useTheme: () => currentTheme },
    'react-native': { View: 'View' },
    'expo-router': { useIsFocused: () => focused, useLocalSearchParams: () => ({ id: 'G' }) },
  });

  assert.equal(collectElements(screen.default()).filter((node) => node?.type === 'AudioControls').length, expectedPlayers);
  focused = false;
  assert.equal(collectElements(screen.default()).filter((node) => node?.type === 'AudioControls').length, 0);
}

currentTheme = themes.dark;
const darkPiano = collectElements(piano.Piano!({ activeNotes: [], onPlayNote: () => undefined })).filter((node) => node?.type === 'Pressable');

assert.equal(flattenStyle(darkPiano[0].props.style({ pressed: false })).backgroundColor, '#FFFFFF', 'white keys must stay distinguishable from black keys in dark mode');
currentTheme = themes.light;

const tabLayout = await loadComponentModule('../app/(tabs)/_layout.tsx', {
  'expo-router': { Tabs: { Screen: 'TabScreen' } },
  'expo-symbols': { SymbolView: 'SymbolView' },
  'expo-symbols/androidWeights/light': {
    __esModule: true,
    default: { name: 'MaterialSymbols_300Light', font: 1 }
  },
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
      const icon = collectElements(tab.props.options.tabBarIcon({ color }));

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
  assert.equal(
    png[25],
    path === launcherConfig.icon ? 2 : 6,
    'full icon must be opaque RGB; adaptive layers need RGBA'
  );
}

assert.equal(launcherConfig.android.adaptiveIcon.backgroundColor, themes.light.primary);

const audioPlugin = launcherConfig.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-audio');

for (const option of ['microphonePermission', 'recordAudioAndroid', 'enableBackgroundRecording', 'enableBackgroundPlayback']) {
  assert.equal(audioPlugin?.[1]?.[option], false, `local playback must not enable ${option}`);
}
for (const permission of ['RECORD_AUDIO', 'SYSTEM_ALERT_WINDOW', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'FOREGROUND_SERVICE_MICROPHONE']) {
  assert.ok(launcherConfig.android.blockedPermissions.includes(`android.permission.${permission}`), `block inherited permission ${permission}`);
}

const privacyScreen = await loadComponentModule('../app/privacy.tsx', { '../src/components': components });
const privacyTree = privacyScreen.default();

assert.equal(privacyTree.props.nativeHeader, true);
assert.equal(privacyTree.props.title, 'Politique de confidentialité');
assert.ok(collectElements(home.default()).some((node) => node?.type === 'Link' && node.props.href === '/privacy'), 'privacy must remain accessible from home without a network');
const privacySource = await readFile(new URL('../app/privacy.tsx', import.meta.url), 'utf8');
const publicPrivacy = await readFile(new URL('../../web/public/privacy.html', import.meta.url), 'utf8');
const localParagraphs = [...privacySource.matchAll(/<Body>([^<]+)<\/Body>/g)].map((match) => match[1]);
const publicParagraphs = [...publicPrivacy.matchAll(/<p data-policy>([^<]+)<\/p>/g)].map((match) => match[1]?.replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&'));

assert.ok(localParagraphs.length >= 7);
assert.deepEqual(publicParagraphs, localParagraphs, 'public and in-app privacy wording must stay identical');
assert.ok(getTextContent(privacyTree).includes('Android peut sauvegarder ou transférer'), 'policy must not hide Android system backups');
assert.ok(getTextContent(privacyTree).includes('Effacer les données'), 'policy must explain local deletion');
assert.ok(getTextContent(privacyTree).includes('sanrandry (GitHub)') && getTextContent(privacyTree).includes('sinrandry@gmail.com'), 'privacy must identify the confirmed publisher and contact');
assert.ok(!/à confirmer|à compléter|TODO/i.test(getTextContent(privacyTree)), 'never ship a draft privacy placeholder');
assert.ok(!/<script\b|<iframe\b/i.test(publicPrivacy), 'public policy must remain plain HTML without tracking or login');

console.log(`mobile self-check: ${SAMPLE_KEYS.length} samples; saved attempts/bookmarks, guided lessons, 15×7 construction steps, piano geometry/font scaling, disclosure, theme, launcher assets/native menu icons, privacy parity/entry point, minimal audio permissions, playback and native release ordering verified; native rendering not tested`);
