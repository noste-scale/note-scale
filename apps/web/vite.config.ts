import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { offlineWorkerSource, pagesBase } from "./src/pwa.ts";

async function listFilesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? listFilesIn(entryPath) : [entryPath];
  }))).flat();
}

function createOfflineWorkerPlugin(base: string): Plugin {
  return {
    name: "notescale-offline-worker",
    apply: "build",
    async closeBundle() {
      const buildDirectory = join(import.meta.dirname, "dist");
      const buildFiles = (await listFilesIn(buildDirectory))
        .filter((file) => relative(buildDirectory, file).replaceAll("\\", "/") !== "sw.js")
        .sort();
      const hash = createHash("sha256").update(`base:${base}\0`);
      for (const file of buildFiles) {
        hash.update(relative(buildDirectory, file).replaceAll("\\", "/"))
          .update("\0")
          .update(await readFile(file))
          .update("\0");
      }
      const cacheId = `notescale-${hash.digest("hex").slice(0, 16)}`;
      const assets = buildFiles.map((file) => `${base}${relative(buildDirectory, file).replaceAll("\\", "/")}`);
      const workerTemplate = await readFile(new URL("./src/sw.ts", import.meta.url), "utf8");
      const workerSource = offlineWorkerSource(workerTemplate, assets, base, cacheId);
      await writeFile(join(buildDirectory, "sw.js"), workerSource);
    },
  };
}

export default defineConfig(() => {
  const base = pagesBase(process.env.GITHUB_REPOSITORY, process.env.GITHUB_ACTIONS, process.env.VITE_BASE_PATH);
  return { base, plugins: [react(), createOfflineWorkerPlugin(base)] };
});
