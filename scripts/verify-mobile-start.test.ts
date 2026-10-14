import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function killFixtureTree(leaderPid: number, pids: number[]): void {
  if (process.platform === "win32" && processExists(leaderPid)) {
    spawnSync("taskkill", ["/PID", String(leaderPid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else if (process.platform !== "win32") {
    try {
      process.kill(-leaderPid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  for (const pid of pids) if (processExists(pid)) process.kill(pid, "SIGKILL");
}

test("timeout reports diagnostics, exits non-zero, and terminates Expo", () => {
  const started = performance.now();
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    join(root, "scripts", "verify-mobile-start.ts"),
    "--test-timeout-fixture",
  ], { encoding: "utf8", timeout: 10_000 });
  const elapsed = performance.now() - started;
  const leaderPid = Number(/fixture leader pid=(\d+)/.exec(result.stdout)?.[1]);
  const fixture = /fixture pid=(\d+) descendant=(\d+)/.exec(result.stderr);
  const pids = fixture ? [Number(fixture[1]), Number(fixture[2])] : [];

  try {
    assert.ifError(result.error);
    assert.ok(elapsed < 4_000, `failure cleanup took ${Math.round(elapsed)} ms`);
    assert.equal(result.status, 1);
    assert.equal(result.signal, null);
    assert.match(result.stderr, /Metro did not become healthy within 0\.1 seconds/);
    assert.match(result.stderr, /--- Expo stdout ---\s+fixture pid=\d+ descendant=\d+/);
    assert.match(result.stderr, /--- Expo stderr ---\s+fixture stderr/);
    assert.ok(Number.isInteger(leaderPid));
    assert.equal(pids.length, 2);
    for (const pid of pids) assert.equal(processExists(pid), false, `fixture process ${pid} must not survive verification`);
  } finally {
    if (Number.isInteger(leaderPid)) killFixtureTree(leaderPid, pids);
  }
});
