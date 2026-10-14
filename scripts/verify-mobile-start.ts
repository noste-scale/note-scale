import { spawn, type ChildProcess } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { finished } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const timeoutFixture = process.argv[2] === "--test-timeout-fixture";
const startTimeoutMs = timeoutFixture ? 100 : 30_000;
const stabilityMs = 5_000;
const pollMs = 250;
const diagnosticLimit = 64 * 1024;
const host = "127.0.0.1";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileDirectory = join(root, "apps", "mobile");
const routerTypes = join(mobileDirectory, ".expo", "types", "router.d.ts");

async function temporaryPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === "string") throw new Error("Could not allocate a temporary local port.");
  return address.port;
}

function isRunning(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

async function metroIsHealthy(port: number, timeoutMs = 1_000): Promise<boolean> {
  if (timeoutFixture) return false;
  try {
    const response = await fetch(`http://${host}:${port}/status`, {
      signal: AbortSignal.timeout(Math.max(1, Math.ceil(timeoutMs))),
    });
    return response.ok && await response.text() === "packager-status:running";
  } catch {
    return false;
  }
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (!isRunning(child)) return true;
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    child.once("exit", onExit);
    if (!isRunning(child)) {
      child.off("exit", onExit);
      clearTimeout(timeout);
      resolve(true);
    }
  });
}

function groupIsRunning(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((error as NodeJS.ErrnoException).code === "EPERM") return true;
    throw error;
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function waitForGroupExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;
  while (groupIsRunning(pid)) {
    if (performance.now() >= deadline) return false;
    await delay(50);
  }
  return true;
}

async function taskkill(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  await new Promise<void>((resolve, reject) => {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let settled = false;
    let taskkillError = "";
    killer.stderr.setEncoding("utf8");
    killer.stderr.on("data", (chunk: string) => { taskkillError = (taskkillError + chunk).slice(-4_096); });
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      killer.kill();
      finish(new Error(`taskkill timed out for Expo process ${child.pid}.`));
    }, 5_000);
    killer.once("error", finish);
    killer.once("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(
        `taskkill failed for Expo process ${child.pid} with exit code ${code}${taskkillError.trim() ? `: ${taskkillError.trim()}` : "."}`,
      ));
    });
  });
  if (isRunning(child) && !await waitForExit(child, 1_000)) {
    throw new Error(`Expo process ${child.pid} survived taskkill.`);
  }
}

async function stop(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  if (process.platform === "win32") {
    try {
      await taskkill(child);
    } catch (error) {
      child.kill("SIGKILL");
      if (isRunning(child) && !await waitForExit(child, 1_000)) {
        throw new AggregateError(
          [error, new Error(`Expo process ${child.pid} survived fallback termination.`)],
          "Windows tree cleanup failed.",
          { cause: error },
        );
      }
      throw error;
    }
    return;
  }

  signalGroup(child.pid, "SIGTERM");
  if (await waitForGroupExit(child.pid, 3_000)) return;
  signalGroup(child.pid, "SIGKILL");
  if (!await waitForGroupExit(child.pid, 2_000)) {
    throw new Error(`Expo process group ${child.pid} did not terminate.`);
  }
}

async function drainOutput(child: ChildProcess): Promise<void> {
  const drained = Promise.allSettled([finished(child.stdout!), finished(child.stderr!)]);
  const timedOut = Symbol("timed-out");
  const results = await Promise.race([drained, delay(1_000, timedOut, { ref: false })]);
  if (results === timedOut) {
    child.stdout?.destroy();
    child.stderr?.destroy();
    throw new Error("Timed out waiting for Expo output streams to finish.");
  }
  const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (errors.length) throw new AggregateError(errors.map(({ reason }) => reason), "Expo output stream failed.");
}

function appendTail(current: string, chunk: string, truncated: boolean): [string, boolean] {
  const combined = current + chunk;
  return combined.length > diagnosticLimit
    ? [combined.slice(-diagnosticLimit), true]
    : [combined, truncated];
}

function renderOutput(output: string, truncated: boolean): string {
  return `${truncated ? "[earlier output truncated]\n" : ""}${output || "(empty)"}`;
}

function failureText(error: unknown): string {
  if (error instanceof AggregateError) {
    const causes = error.errors.map((cause, index) => `Cause ${index + 1}:\n${failureText(cause)}`).join("\n");
    return `${error.stack ?? error.message}\n${causes}`;
  }
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

if (!timeoutFixture) await rm(routerTypes, { force: true });
const port = await temporaryPort();
const expoCli = createRequire(join(mobileDirectory, "package.json")).resolve("expo/bin/cli");
const fixtureSource = [
  "const { spawn } = require('node:child_process');",
  "const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
  "console.log(`fixture pid=${process.pid} descendant=${descendant.pid}`);",
  "console.error('fixture stderr');",
  "setInterval(() => {}, 1000);",
].join("");
const childArgs = timeoutFixture
  ? ["-e", fixtureSource]
  : [expoCli, "start", "--offline", "--port", String(port), "--max-workers", "1"];
const child = spawn(process.execPath, childArgs, {
  cwd: mobileDirectory,
  detached: process.platform !== "win32",
  env: { ...process.env, CI: "1" },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let stdout = "";
let stderr = "";
let stdoutTruncated = false;
let stderrTruncated = false;
let routerResolutionFailure: string | undefined;
let routerFailureRaised = false;
let spawnError: Error | undefined;
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk: string) => {
  routerResolutionFailure ??= /[^\r\n]*expo-router\/internal\/(?:routing|testing)[^\r\n]*/i.exec(stdout + chunk)?.[0];
  [stdout, stdoutTruncated] = appendTail(stdout, chunk, stdoutTruncated);
});
child.stderr.on("data", (chunk: string) => {
  routerResolutionFailure ??= /[^\r\n]*expo-router\/internal\/(?:routing|testing)[^\r\n]*/i.exec(stderr + chunk)?.[0];
  [stderr, stderrTruncated] = appendTail(stderr, chunk, stderrTruncated);
});
child.once("error", (error) => { spawnError = error; });

let cleanupPromise: Promise<void> | undefined;
let interruptedSignal: "SIGINT" | "SIGTERM" | undefined;
const cleanupOnce = () => cleanupPromise ??= stop(child);
const requestInterrupt = (signal: "SIGINT" | "SIGTERM") => {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  void cleanupOnce().catch(() => undefined);
};
const onSigint = () => requestInterrupt("SIGINT");
const onSigterm = () => requestInterrupt("SIGTERM");
process.on("SIGINT", onSigint);
process.on("SIGTERM", onSigterm);
if (timeoutFixture) console.log(`fixture leader pid=${child.pid}`);

function assertActive(phase: string): void {
  if (interruptedSignal) throw new Error(`Received ${interruptedSignal}; cleaning up Expo.`);
  if (spawnError) throw spawnError;
  if (routerResolutionFailure) {
    routerFailureRaised = true;
    throw new Error(`Expo Router internal resolution failed: ${routerResolutionFailure.trim()}`);
  }
  if (!isRunning(child)) {
    throw new Error(`Expo exited ${phase} (code ${child.exitCode}, signal ${child.signalCode}).`);
  }
}

let failure: unknown;
try {
  const deadline = performance.now() + startTimeoutMs;
  while (true) {
    assertActive("before Metro became healthy");
    const requestTime = deadline - performance.now();
    if (requestTime <= 0) {
      throw new Error(`Metro did not become healthy within ${startTimeoutMs / 1_000} seconds.`);
    }
    const healthy = await metroIsHealthy(port, Math.min(1_000, requestTime));
    assertActive("before Metro became healthy");
    if (performance.now() > deadline) {
      throw new Error(`Metro did not become healthy within ${startTimeoutMs / 1_000} seconds.`);
    }
    if (healthy) break;
    const remaining = Math.max(1, deadline - performance.now());
    if (await waitForExit(child, Math.min(pollMs, remaining))) assertActive("before Metro became healthy");
  }

  const stableUntil = performance.now() + stabilityMs;
  while (performance.now() < stableUntil) {
    assertActive("during the stability window");
    // The observation deadline must not shrink a healthy response's timeout to 1 ms.
    if (!await metroIsHealthy(port)) {
      throw new Error("Metro stopped reporting healthy during the stability window.");
    }
    assertActive("during the stability window");
    const remaining = stableUntil - performance.now();
    if (remaining > 0 && await waitForExit(child, Math.min(pollMs, remaining))) {
      assertActive("during the stability window");
    }
  }

  if (!timeoutFixture) {
    const generated = await stat(routerTypes).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!generated?.isFile() || generated.size === 0) {
      throw new Error("Expo did not generate .expo/types/router.d.ts during typed-route bootstrap.");
    }
    if (!await readFile(routerTypes, "utf8").then((content) => content.includes("declare module 'expo-router'"))) {
      throw new Error("Expo generated an invalid typed-route declaration.");
    }
  }
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanupOnce();
  } catch (error) {
    failure = failure ? new AggregateError([failure, error], "Verification and cleanup both failed.") : error;
  }
  process.off("SIGINT", onSigint);
  process.off("SIGTERM", onSigterm);
  try {
    await drainOutput(child);
  } catch (error) {
    failure = failure ? new AggregateError([failure, error], "Verification and output drain both failed.") : error;
  }
}

if (routerResolutionFailure && !routerFailureRaised) {
  const error = new Error(`Expo Router internal resolution failed: ${routerResolutionFailure.trim()}`);
  failure = failure ? new AggregateError([failure, error], "Verification and Router resolution both failed.") : error;
}
if (interruptedSignal && !failure) failure = new Error(`Received ${interruptedSignal}; Expo stopped.`);

if (failure) {
  console.error(`Mobile start verification failed:\n${failureText(failure)}`);
  console.error(`\n--- Expo stdout ---\n${renderOutput(stdout, stdoutTruncated)}`);
  console.error(`\n--- Expo stderr ---\n${renderOutput(stderr, stderrTruncated)}`);
  process.exitCode = interruptedSignal === "SIGINT" ? 130 : interruptedSignal === "SIGTERM" ? 143 : 1;
} else {
  console.log(`Verified Expo/Metro startup, typed routes, and ${stabilityMs / 1_000}-second stability on port ${port}.`);
}
