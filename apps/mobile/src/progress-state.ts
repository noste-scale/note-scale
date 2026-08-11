import {
  createEmptyProgress,
  recordAttempt,
  type PersistenceResult,
  type ProgressState,
  type RecordAttemptInput,
} from "@notescale/music";

export const STORAGE_OPERATION_TIMEOUT_MS = 2_500;

export interface PendingAttempt {
  input: RecordAttemptInput;
  at: Date;
}

export function mergePendingAttempts(
  loaded: ProgressState,
  pending: readonly PendingAttempt[],
): ProgressState {
  return pending.reduce(
    (state, attempt) => recordAttempt(state, attempt.input, attempt.at),
    loaded,
  );
}

export function shouldPersistHydration(canSave: boolean, pendingCount: number): boolean {
  return canSave && pendingCount > 0;
}

export function resolveHydration(
  result: PersistenceResult,
  pending: readonly PendingAttempt[],
): { progress: ProgressState; shouldSave: boolean } {
  return {
    progress: mergePendingAttempts(result.state, pending),
    shouldSave: shouldPersistHydration(result.canSave, pending.length),
  };
}

export function persistenceWarningAfterSave(result: string | null): string | undefined {
  return result ?? undefined;
}

export function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  const delay = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : 0;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("storage operation timed out")), delay);
    operation.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

const unavailableResult = (): PersistenceResult => ({
  state: createEmptyProgress(),
  warning: "La progression locale n’a pas pu être lue.",
  status: "unavailable",
  canSave: false,
});

export async function loadProgressWithRetry(
  load: () => Promise<PersistenceResult>,
  timeoutMs = STORAGE_OPERATION_TIMEOUT_MS,
): Promise<PersistenceResult> {
  let last = unavailableResult();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      last = await withTimeout(load(), timeoutMs);
      if (last.status !== "unavailable") return last;
    } catch {
      last = unavailableResult();
    }
  }
  return last;
}

export function createSerializedSaver<T, R>(
  save: (snapshot: T) => Promise<R>,
  timeoutMs?: number,
) {
  let queue = Promise.resolve();
  let latest: T;
  const enqueue = (snapshot: T, updateLatest: boolean): Promise<R> => {
    if (updateLatest) latest = snapshot;
    let operation: Promise<R> | undefined;
    const current = queue.then(() => {
      operation = save(snapshot);
      if (timeoutMs === undefined) return operation;
      return withTimeout(operation, timeoutMs).catch((error: unknown) => {
        // A timed-out native write cannot be cancelled. If it later lands stale,
        // serialize one repair write with the newest snapshot behind it.
        void operation?.then(() => {
          if (latest !== snapshot) void enqueue(latest, false).catch(() => undefined);
        }, () => undefined);
        throw error;
      });
    });
    queue = current.then(() => undefined, () => undefined);
    return current;
  };
  return (snapshot: T): Promise<R> => enqueue(snapshot, true);
}
