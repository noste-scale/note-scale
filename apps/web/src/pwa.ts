function configuredBase(value: string | undefined): string | undefined {
  const path = value?.trim();
  if (!path) return undefined;
  if (path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}/`;
}

export function pagesBase(repository: string | undefined, actions: string | undefined, explicit: string | undefined = undefined): string {
  const configuredPath = configuredBase(explicit);
  if (configuredPath) return configuredPath;
  const repositoryName = repository?.split("/")[1];
  return actions && repositoryName && !repositoryName.endsWith(".github.io") ? `/${repositoryName}/` : "/";
}

export function offlineWorkerSource(template: string, assets: readonly string[], base: string, cacheId: string): string {
  return template
    .replace("__PRECACHE__", JSON.stringify(assets))
    .replace("__BASE__", JSON.stringify(base))
    .replace("__CACHE__", JSON.stringify(cacheId));
}

export function watchWorkerFailures(registration: ServiceWorkerRegistration, onFailure: () => void): void {
  const watchWorker = (worker: ServiceWorker | null) => {
    if (!worker) return;
    let hasReportedFailure = false;
    const reportFailure = () => {
      if (!hasReportedFailure && worker.state === "redundant") {
        hasReportedFailure = true;
        onFailure();
      }
    };
    reportFailure();
    worker.addEventListener("statechange", reportFailure);
  };
  watchWorker(registration.installing);
  registration.addEventListener("updatefound", () => watchWorker(registration.installing));
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
