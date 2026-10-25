import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDirectory = join(projectRoot, "apps", "web", "dist");

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const filesByEntry = await Promise.all(entries.map((entry) => {
    const childPath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(childPath) : [childPath];
  }));
  return filesByEntry.flat();
}

const files = (await listFiles(buildDirectory))
  .filter((file) => relative(buildDirectory, file).replaceAll("\\", "/") !== "sw.js")
  .sort();
const workerSource = await readFile(join(buildDirectory, "sw.js"), "utf8");
const baseMatch = /const BASE = ("[^"]+");/.exec(workerSource);
const cacheMatch = /const CACHE = "([^"]+)";/.exec(workerSource);
const precacheMatch = /const PRECACHE = (\[[^;]+\]);/.exec(workerSource);
assert.ok(baseMatch && cacheMatch && precacheMatch, "built service worker constants must be emitted");
const base = JSON.parse(baseMatch[1]!) as string;
assert.ok(base.startsWith("/") && base.endsWith("/"), "build base must be absolute and slash-terminated");

const expectedInventory = files.map((file) => `${base}${relative(buildDirectory, file).replaceAll("\\", "/")}`);
const precachedPaths = JSON.parse(precacheMatch[1]!) as string[];
assert.deepEqual(precachedPaths, expectedInventory, "precache must equal the complete emitted inventory");

const indexHtml = await readFile(join(buildDirectory, "index.html"), "utf8");
const scriptPaths = expectedInventory.filter((path) => /\/assets\/index-[^/]+\.js$/.test(path));
const stylePaths = expectedInventory.filter((path) => /\/assets\/index-[^/]+\.css$/.test(path));
assert.ok(scriptPaths.length > 0 && stylePaths.length > 0, "hashed JavaScript and CSS must be emitted");
for (const assetPath of [...scriptPaths, ...stylePaths]) {
  assert.ok(indexHtml.includes(assetPath), `${assetPath} must use the configured base in index.html`);
}
assert.ok(precachedPaths.includes(`${base}manifest.webmanifest`), "manifest must be precached");
assert.ok(precachedPaths.includes(`${base}icon.svg`), "icon must be precached");

const pitchNames = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const expectedAudioPaths = [4, 5].flatMap((octave) => pitchNames.map((pitchName) => `${base}audio/${pitchName}${octave}.wav`)).sort();
assert.deepEqual(precachedPaths.filter((path) => path.endsWith(".wav")).sort(), expectedAudioPaths, "all 24 production WAVs must be precached");

const inventoryHash = createHash("sha256").update(`base:${base}\0`);
for (const file of files) {
  inventoryHash.update(relative(buildDirectory, file).replaceAll("\\", "/")).update("\0").update(await readFile(file)).update("\0");
}
assert.equal(cacheMatch[1]!, `notescale-${inventoryHash.digest("hex").slice(0, 16)}`, "cache id must derive from emitted paths and bytes");

console.log(`Verified web build inventory, ${base} base, 24 WAVs, and content-derived cache id.`);
