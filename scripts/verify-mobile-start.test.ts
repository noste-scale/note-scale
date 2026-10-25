import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function terminateFixtureTree(leaderPid: number, fixtureProcessIds: number[]): void {
  if (process.platform === "win32" && processExists(leaderPid)) {
    spawnSync("taskkill", ["/PID", String(leaderPid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else if (process.platform !== "win32") {
    try {
      process.kill(-leaderPid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  for (const pid of fixtureProcessIds) {
    if (processExists(pid)) process.kill(pid, "SIGKILL");
  }
}

test("timeout reports diagnostics, exits non-zero, and terminates Expo", () => {
  const verificationStartedAt = performance.now();
  const verificationRun = spawnSync(process.execPath, [
    "--experimental-strip-types",
    join(projectRoot, "scripts", "verify-mobile-start.ts"),
    "--test-timeout-fixture",
  ], { encoding: "utf8", timeout: 10_000 });
  const elapsedMs = performance.now() - verificationStartedAt;
  const leaderPid = Number(/fixture leader pid=(\d+)/.exec(verificationRun.stdout)?.[1]);
  const fixtureMatch = /fixture pid=(\d+) descendant=(\d+)/.exec(verificationRun.stderr);
  const fixtureProcessIds = fixtureMatch ? [Number(fixtureMatch[1]), Number(fixtureMatch[2])] : [];

  try {
    assert.ifError(verificationRun.error);
    assert.ok(elapsedMs < 4_000, `failure cleanup took ${Math.round(elapsedMs)} ms`);
    assert.equal(verificationRun.status, 1);
    assert.equal(verificationRun.signal, null);
    assert.match(verificationRun.stderr, /Metro did not become healthy within 0\.1 seconds/);
    assert.match(verificationRun.stderr, /--- Expo stdout ---\s+fixture pid=\d+ descendant=\d+/);
    assert.match(verificationRun.stderr, /--- Expo stderr ---\s+fixture stderr/);
    assert.ok(Number.isInteger(leaderPid));
    assert.equal(fixtureProcessIds.length, 2);
    for (const pid of fixtureProcessIds) {
      assert.equal(processExists(pid), false, `fixture process ${pid} must not survive verification`);
    }
  } finally {
    if (Number.isInteger(leaderPid)) terminateFixtureTree(leaderPid, fixtureProcessIds);
  }
});

test("healthy Metro keeps a full response budget near the stability deadline", () => {
  const delayedFetchPreload = `
    import { setTimeout as delay } from "node:timers/promises";
    const fetch = globalThis.fetch;
    const setTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback, ms, ...args) => setTimeout(callback, Math.max(1, ms - 10), ...args);
    globalThis.fetch = async (url, options) => {
      await delay(25, undefined, { signal: options.signal });
      return fetch(url, options);
    };
  `;
  const verificationRun = spawnSync(process.execPath, [
    "--experimental-strip-types",
    "--import", `data:text/javascript,${encodeURIComponent(delayedFetchPreload)}`,
    join(projectRoot, "scripts", "verify-mobile-start.ts"),
  ], { encoding: "utf8", timeout: 45_000 });
  assert.ifError(verificationRun.error);
  assert.equal(verificationRun.status, 0, verificationRun.stderr);
  assert.match(verificationRun.stdout, /Verified Expo\/Metro startup, typed routes/);
});
