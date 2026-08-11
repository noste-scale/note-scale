function configuredBase(value: string | undefined): string | undefined {
  const path = value?.trim();
  if (!path) return undefined;
  if (path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}/`;
}

export function pagesBase(repository: string | undefined, actions: string | undefined, explicit: string | undefined = undefined): string {
  const configured = configuredBase(explicit);
  if (configured) return configured;
  const name = repository?.split("/")[1];
  return actions && name && !name.endsWith(".github.io") ? `/${name}/` : "/";
}

export function offlineWorkerSource(template: string, assets: readonly string[], base: string, cacheId: string): string {
  return template
    .replace("__PRECACHE__", JSON.stringify(assets))
    .replace("__BASE__", JSON.stringify(base))
    .replace("__CACHE__", JSON.stringify(cacheId));
}

export function watchWorkerFailures(registration: ServiceWorkerRegistration, onFailure: () => void): void {
  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    let reported = false;
    const report = () => {
      if (!reported && worker.state === "redundant") { reported = true; onFailure(); }
    };
    report();
    worker.addEventListener("statechange", report);
  };
  watch(registration.installing);
  registration.addEventListener("updatefound", () => watch(registration.installing));
}

export function prepareOfflineRegistration(
  serviceWorker: Pick<ServiceWorkerContainer, "register"> | undefined,
  host: Pick<Window, "addEventListener">,
  base: string,
  production: boolean,
  onFailure: () => void,
): boolean {
  if (!production || !serviceWorker) return false;
  host.addEventListener("load", () => {
    void serviceWorker.register(`${base}sw.js`)
      .then((registration) => watchWorkerFailures(registration, onFailure))
      .catch(onFailure);
  });
  return true;
}
