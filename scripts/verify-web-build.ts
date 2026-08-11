import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = join(root, "apps", "web", "dist");

async function filesIn(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesIn(child) : [child];
  }))).flat();
}

const files = (await filesIn(directory))
  .filter((file) => relative(directory, file).replaceAll("\\", "/") !== "sw.js")
  .sort();
const worker = await readFile(join(directory, "sw.js"), "utf8");
const baseMatch = /const BASE = ("[^"]+");/.exec(worker);
const cacheMatch = /const CACHE = "([^"]+)";/.exec(worker);
const precacheMatch = /const PRECACHE = (\[[^;]+\]);/.exec(worker);
assert.ok(baseMatch && cacheMatch && precacheMatch, "built service worker constants must be emitted");
const base = JSON.parse(baseMatch[1]!) as string;
assert.ok(base.startsWith("/") && base.endsWith("/"), "build base must be absolute and slash-terminated");

const expected = files.map((file) => `${base}${relative(directory, file).replaceAll("\\", "/")}`);
const precache = JSON.parse(precacheMatch[1]!) as string[];
assert.deepEqual(precache, expected, "precache must equal the complete emitted inventory");

const index = await readFile(join(directory, "index.html"), "utf8");
const scripts = expected.filter((path) => /\/assets\/index-[^/]+\.js$/.test(path));
const styles = expected.filter((path) => /\/assets\/index-[^/]+\.css$/.test(path));
assert.ok(scripts.length > 0 && styles.length > 0, "hashed JavaScript and CSS must be emitted");
for (const asset of [...scripts, ...styles]) assert.ok(index.includes(asset), `${asset} must use the configured base in index.html`);
assert.ok(precache.includes(`${base}manifest.webmanifest`), "manifest must be precached");
assert.ok(precache.includes(`${base}icon.svg`), "icon must be precached");

const stems = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const expectedAudio = [4, 5].flatMap((octave) => stems.map((stem) => `${base}audio/${stem}${octave}.wav`)).sort();
assert.deepEqual(precache.filter((path) => path.endsWith(".wav")).sort(), expectedAudio, "all 24 production WAVs must be precached");

const hash = createHash("sha256").update(`base:${base}\0`);
for (const file of files) {
  hash.update(relative(directory, file).replaceAll("\\", "/")).update("\0").update(await readFile(file)).update("\0");
}
assert.equal(cacheMatch[1]!, `notescale-${hash.digest("hex").slice(0, 16)}`, "cache id must derive from emitted paths and bytes");

console.log(`Verified web build inventory, ${base} base, 24 WAVs, and content-derived cache id.`);
