import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { offlineWorkerSource, pagesBase, prepareOfflineRegistration, watchWorkerFailures } from "./pwa";

type WorkerHandler = (event: any) => void;

function response(name: string) {
  return { name, ok: true, clone: vi.fn(() => ({ name: `${name}-clone`, ok: true })) };
}

function executeWorker() {
  const handlers: Record<string, WorkerHandler> = {};
  const entries = new Map<string, ReturnType<typeof response>>([["/NoteScale/index.html", response("shell")]]);
  const put = vi.fn(async (request: { url: string }, value: ReturnType<typeof response>) => { entries.set(request.url, value); });
  const addAll = vi.fn(async () => undefined);
  const match = vi.fn(async (key: string | { url: string }) => entries.get(typeof key === "string" ? key : key.url));
  const deleted: string[] = [];
  const claim = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);
  const caches = {
    open: vi.fn(async () => ({ addAll, match, put })),
    match: vi.fn(async () => { throw new Error("global cache lookup must not be used"); }),
    keys: vi.fn(async () => ["notescale-v1", "notescale-build123", "notescale-v3", "other-app-v1"]),
    delete: vi.fn(async (key: string) => { deleted.push(key); return true; }),
  };
  const network = vi.fn(async (_request: { url: string }) => response("network"));
  const self = {
    addEventListener: (name: string, handler: WorkerHandler) => { handlers[name] = handler; },
    clients: { claim },
    skipWaiting,
  };
  const template = readFileSync(new URL("./sw.ts", import.meta.url), "utf8");
  const source = offlineWorkerSource(template, ["/NoteScale/index.html", "/NoteScale/audio/C4.wav"], "/NoteScale/", "notescale-build123");
  runInNewContext(source, { self, caches, fetch: network, location: { origin: "https://example.test" }, URL, Promise });
  return { handlers, entries, put, addAll, match, deleted, claim, skipWaiting, caches, network };
}

async function dispatchLifetime(handler: WorkerHandler): Promise<void> {
  let lifetime: Promise<unknown> | undefined;
  handler({ waitUntil: (promise: Promise<unknown>) => { lifetime = promise; } });
  await lifetime;
}

function dispatchFetch(handler: WorkerHandler, url: string, mode: RequestMode = "cors") {
  let responsePromise: Promise<ReturnType<typeof response>> | undefined;
  const lifetimes: Promise<unknown>[] = [];
  handler({
    request: { method: "GET", url, mode },
    respondWith: (promise: Promise<ReturnType<typeof response>>) => { responsePromise = promise; },
    waitUntil: (promise: Promise<unknown>) => { lifetimes.push(promise); },
  });
  if (!responsePromise) throw new Error("Worker did not respond to GET");
  return { response: responsePromise, lifetimes };
}

describe("Pages PWA configuration", () => {
  it("derives repository-aware base only in Actions", () => {
    expect(pagesBase("owner/NoteScale", "true")).toBe("/NoteScale/");
    expect(pagesBase("owner/owner.github.io", "true")).toBe("/");
    expect(pagesBase("owner/NoteScale", undefined)).toBe("/");
    expect(pagesBase(undefined, undefined, "NoteScale")).toBe("/NoteScale/");
    expect(pagesBase("owner/ignored", "true", "/custom/base/")).toBe("/custom/base/");
  });

  it("injects every emitted asset and offline fallback base", () => {
    const source = offlineWorkerSource("const cache=__CACHE__; const assets=__PRECACHE__; const base=__BASE__;", ["/NoteScale/index.html", "/NoteScale/assets/app.js", "/NoteScale/icon.svg", "/NoteScale/audio/C4.wav"], "/NoteScale/", "notescale-content1");
    expect(source).not.toContain("__PRECACHE__");
    expect(source).not.toContain("__BASE__");
    expect(source).not.toContain("__CACHE__");
    expect(source).toContain("notescale-content1");
    expect(source).toContain("/NoteScale/assets/app.js");
    expect(source).toContain("/NoteScale/audio/C4.wav");
  });

  it("executes install/activate while preserving unrelated caches", async () => {
    const worker = executeWorker();
    await dispatchLifetime(worker.handlers.install!);
    expect(worker.addAll).toHaveBeenCalledWith(["/NoteScale/index.html", "/NoteScale/audio/C4.wav"]);
    expect(worker.skipWaiting).toHaveBeenCalledOnce();
    await dispatchLifetime(worker.handlers.activate!);
    expect(worker.deleted).toEqual(["notescale-v1", "notescale-v3"]);
    expect(worker.claim).toHaveBeenCalledOnce();
  });

  it("executes cache/network responses and extends runtime cache writes", async () => {
    const worker = executeWorker();
    const cached = response("cached"); worker.entries.set("https://example.test/cached.js", cached);
    const cacheHit = dispatchFetch(worker.handlers.fetch!, "https://example.test/cached.js");
    await expect(cacheHit.response).resolves.toBe(cached);
    expect(worker.network).not.toHaveBeenCalled();
    expect(worker.caches.match).not.toHaveBeenCalled();

    const fetched = dispatchFetch(worker.handlers.fetch!, "https://example.test/new.js");
    await expect(fetched.response).resolves.toMatchObject({ name: "network" });
    expect(fetched.lifetimes).toHaveLength(1);
    await Promise.all(fetched.lifetimes);
    expect(worker.put).toHaveBeenCalledOnce();
    expect(worker.entries.get("https://example.test/new.js")?.name).toBe("network-clone");
  });

  it("falls back to the shell only for offline navigations", async () => {
    const worker = executeWorker();
    worker.network.mockRejectedValue(new Error("offline"));
    const navigation = dispatchFetch(worker.handlers.fetch!, "https://example.test/NoteScale/deep", "navigate");
    await expect(navigation.response).resolves.toMatchObject({ name: "shell" });
    const audio = dispatchFetch(worker.handlers.fetch!, "https://example.test/NoteScale/audio/missing.wav", "cors");
    await expect(audio.response).rejects.toThrow("offline");
  });

  it("reports workers already redundant and later redundant updates once each", () => {
    let installing: ServiceWorker | null = { state: "redundant", addEventListener: vi.fn() } as unknown as ServiceWorker;
    let updateFound: () => void = () => undefined;
    const registration = {
      get installing() { return installing; },
      addEventListener: (_name: string, callback: () => void) => { updateFound = callback; },
    } as unknown as ServiceWorkerRegistration;
    const onFailure = vi.fn();
    watchWorkerFailures(registration, onFailure);
    expect(onFailure).toHaveBeenCalledOnce();

    let state: ServiceWorkerState = "installing"; let stateChange: () => void = () => undefined;
    installing = { get state() { return state; }, addEventListener: (_name: string, callback: () => void) => { stateChange = callback; } } as unknown as ServiceWorker;
    updateFound();
    state = "redundant"; stateChange(); stateChange();
    expect(onFailure).toHaveBeenCalledTimes(2);
  });

  it("prepares registration only for a production-capable browser and waits for load", async () => {
    let load: () => void = () => undefined;
    const host = { addEventListener: (_name: string, callback: () => void) => { load = callback; } } as unknown as Window;
    const registration = { installing: null, addEventListener: vi.fn() } as unknown as ServiceWorkerRegistration;
    const register = vi.fn(async () => registration);
    const onFailure = vi.fn();
    expect(prepareOfflineRegistration(undefined, host, "/NoteScale/", true, onFailure)).toBe(false);
    expect(prepareOfflineRegistration({ register } as unknown as ServiceWorkerContainer, host, "/NoteScale/", false, onFailure)).toBe(false);
    expect(prepareOfflineRegistration({ register } as unknown as ServiceWorkerContainer, host, "/NoteScale/", true, onFailure)).toBe(true);
    expect(register).not.toHaveBeenCalled();
    load(); await Promise.resolve(); await Promise.resolve();
    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith("/NoteScale/sw.js");
    expect(onFailure).not.toHaveBeenCalled();
  });
});
