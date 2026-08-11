import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { offlineWorkerSource, pagesBase } from "./src/pwa.ts";

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }))).flat();
}

function offlineWorker(base: string): Plugin {
  return {
    name: "notescale-offline-worker",
    apply: "build",
    async closeBundle() {
      const directory = join(import.meta.dirname, "dist");
      const files = (await filesIn(directory))
        .filter((file) => relative(directory, file).replaceAll("\\", "/") !== "sw.js")
        .sort();
      const hash = createHash("sha256").update(`base:${base}\0`);
      for (const file of files) hash.update(relative(directory, file).replaceAll("\\", "/")).update("\0").update(await readFile(file)).update("\0");
      const cacheId = `notescale-${hash.digest("hex").slice(0, 16)}`;
      const assets = files.map((file) => `${base}${relative(directory, file).replaceAll("\\", "/")}`);
      const source = offlineWorkerSource(await readFile(new URL("./src/sw.ts", import.meta.url), "utf8"), assets, base, cacheId);
      await writeFile(join(directory, "sw.js"), source);
    },
  };
}

export default defineConfig(() => {
  const base = pagesBase(process.env.GITHUB_REPOSITORY, process.env.GITHUB_ACTIONS, process.env.VITE_BASE_PATH);
  return { base, plugins: [react(), offlineWorker(base)] };
});
