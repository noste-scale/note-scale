import {
  PROGRESS_STORAGE_KEY,
  createEmptyProgress,
  decodeProgress,
  encodeProgress,
  mergeProgressStates,
  type PersistenceResult,
  type ProgressState,
} from "@notescale/music";

type BrowserStorage = Pick<Storage, "getItem" | "setItem">;

export interface BrowserSaveResult {
  state: ProgressState;
  warning: string | null;
  saved: boolean;
}

export interface BrowserStorageUpdate extends PersistenceResult {
  reset: boolean;
  needsSave: boolean;
}

function resolveBrowserStorage(storage?: BrowserStorage): BrowserStorage | undefined {
  if (storage) return storage;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function createUnavailableProgress(): PersistenceResult {
  return {
    state: createEmptyProgress(),
    warning: "La progression locale n’a pas pu être lue.",
    status: "unavailable",
    canSave: false,
  };
}

function readStoredProgress(storage: BrowserStorage | undefined): PersistenceResult {
  if (!storage) return createUnavailableProgress();
  try {
    return decodeProgress(storage.getItem(PROGRESS_STORAGE_KEY));
  } catch {
    return createUnavailableProgress();
  }
}

export function loadBrowserProgress(storage?: BrowserStorage): Promise<PersistenceResult> {
  return Promise.resolve(readStoredProgress(resolveBrowserStorage(storage)));
}

export function saveBrowserProgress(state: ProgressState, storage?: BrowserStorage): Promise<BrowserSaveResult> {
  const targetStorage = resolveBrowserStorage(storage);
  const storedProgress = readStoredProgress(targetStorage);
  if (!targetStorage || !storedProgress.canSave) {
    return Promise.resolve({ state, warning: storedProgress.warning, saved: false });
  }

  const mergedProgress = mergeProgressStates(storedProgress.state, state);
  try {
    targetStorage.setItem(PROGRESS_STORAGE_KEY, encodeProgress(mergedProgress));
    return Promise.resolve({ state: mergedProgress, warning: storedProgress.warning, saved: true });
  } catch {
    return Promise.resolve({
      state: mergedProgress,
      warning: "La progression ne peut pas être enregistrée sur cet appareil.",
      saved: false,
    });
  }
}

export function mergeStorageUpdate(currentProgress: ProgressState, storedPayload: string | null): PersistenceResult {
  const incomingProgress = decodeProgress(storedPayload);
  return incomingProgress.canSave
    ? { ...incomingProgress, state: mergeProgressStates(currentProgress, incomingProgress.state) }
    : { ...incomingProgress, state: currentProgress };
}

export function storageEventUpdate(
  currentProgress: ProgressState,
  storageKey: string | null,
  storedPayload: string | null,
): BrowserStorageUpdate | undefined {
  if (storageKey !== null && storageKey !== PROGRESS_STORAGE_KEY) return undefined;
  if (storedPayload === null) {
    return { ...decodeProgress(null), state: createEmptyProgress(), reset: true, needsSave: false };
  }
  const incomingProgress = decodeProgress(storedPayload);
  const state = incomingProgress.canSave ? mergeProgressStates(currentProgress, incomingProgress.state) : currentProgress;
  return {
    ...incomingProgress,
    state,
    reset: false,
    needsSave: incomingProgress.canSave && encodeProgress(state) !== encodeProgress(incomingProgress.state),
  };
}
