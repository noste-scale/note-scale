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

function browserStorage(storage?: BrowserStorage): BrowserStorage | undefined {
  if (storage) return storage;
  try { return window.localStorage; }
  catch { return undefined; }
}

function unavailable(): PersistenceResult {
  return {
    state: createEmptyProgress(),
    warning: "La progression locale n’a pas pu être lue.",
    status: "unavailable",
    canSave: false,
  };
}

function read(storage: BrowserStorage | undefined): PersistenceResult {
  if (!storage) return unavailable();
  try { return decodeProgress(storage.getItem(PROGRESS_STORAGE_KEY)); }
  catch { return unavailable(); }
}

export function loadBrowserProgress(storage?: BrowserStorage): Promise<PersistenceResult> {
  return Promise.resolve(read(browserStorage(storage)));
}

export function saveBrowserProgress(state: ProgressState, storage?: BrowserStorage): Promise<BrowserSaveResult> {
  const target = browserStorage(storage);
  const stored = read(target);
  if (!target || !stored.canSave) {
    return Promise.resolve({ state, warning: stored.warning, saved: false });
  }

  const merged = mergeProgressStates(stored.state, state);
  try {
    target.setItem(PROGRESS_STORAGE_KEY, encodeProgress(merged));
    return Promise.resolve({ state: merged, warning: stored.warning, saved: true });
  } catch {
    return Promise.resolve({
      state: merged,
      warning: "La progression ne peut pas être enregistrée sur cet appareil.",
      saved: false,
    });
  }
}

export function mergeStorageUpdate(current: ProgressState, raw: string | null): PersistenceResult {
  const incoming = decodeProgress(raw);
  return incoming.canSave
    ? { ...incoming, state: mergeProgressStates(current, incoming.state) }
    : { ...incoming, state: current };
}

export function storageEventUpdate(
  current: ProgressState,
  key: string | null,
  raw: string | null,
): BrowserStorageUpdate | undefined {
  if (key !== null && key !== PROGRESS_STORAGE_KEY) return undefined;
  if (raw === null) return { ...decodeProgress(null), state: createEmptyProgress(), reset: true, needsSave: false };
  const incoming = decodeProgress(raw);
  const state = incoming.canSave ? mergeProgressStates(current, incoming.state) : current;
  return {
    ...incoming,
    state,
    reset: false,
    needsSave: incoming.canSave && encodeProgress(state) !== encodeProgress(incoming.state),
  };
}
