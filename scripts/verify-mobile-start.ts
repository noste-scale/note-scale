import { spawn, type ChildProcess } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { finished } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const isTimeoutFixture = process.argv[2] === "--test-timeout-fixture";
const startupTimeoutMs = isTimeoutFixture ? 100 : 30_000;
const stabilityWindowMs = 5_000;
const pollIntervalMs = 250;
const diagnosticCharacterLimit = 64 * 1024;
const host = "127.0.0.1";
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileDirectory = join(projectRoot, "apps", "mobile");
const routerTypesPath = join(mobileDirectory, ".expo", "types", "router.d.ts");

async function allocateTemporaryPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  if (!address || typeof address === "string") throw new Error("Could not allocate a temporary local port.");

  return address.port;
}

function isProcessRunning(expoProcess: ChildProcess): boolean {
  return expoProcess.exitCode === null && expoProcess.signalCode === null;
}

async function isMetroHealthy(port: number, timeoutMs = 1_000): Promise<boolean> {
  if (isTimeoutFixture) return false;

  try {
    const response = await fetch(`http://${host}:${port}/status`, {
      signal: AbortSignal.timeout(Math.max(1, Math.ceil(timeoutMs))),
    });

    return response.ok && await response.text() === "packager-status:running";
  } catch {
    return false;
  }
}

async function waitForExit(expoProcess: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (!isProcessRunning(expoProcess)) return true;

  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      expoProcess.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    expoProcess.once("exit", onExit);

    if (!isProcessRunning(expoProcess)) {
      expoProcess.off("exit", onExit);
      clearTimeout(timeout);
      resolve(true);
    }
  });
}

function isProcessGroupRunning(pid: number): boolean {
  try {
    process.kill(-pid, 0);

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((error as NodeJS.ErrnoException).code === "EPERM") return true;

    throw error;
  }
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function waitForGroupExit(pid: number, timeoutMs: number): Promise<boolean> {
  const exitDeadlineMs = performance.now() + timeoutMs;
  while (isProcessGroupRunning(pid)) {
    if (performance.now() >= exitDeadlineMs) return false;

    await delay(50);
  }

  return true;
}

async function terminateWindowsProcessTree(expoProcess: ChildProcess): Promise<void> {
  if (!expoProcess.pid) return;

  await new Promise<void>((resolve, reject) => {
    const terminationProcess = spawn(
      "taskkill",
      ["/PID", String(expoProcess.pid), "/T", "/F"],
      {
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      }
    );
    let settled = false;
    let terminationErrorOutput = "";
    terminationProcess.stderr.setEncoding("utf8");
    terminationProcess.stderr.on("data", (chunk: string) => {
      terminationErrorOutput = (terminationErrorOutput + chunk).slice(-4_096);
    });
    const settleTermination = (error?: Error) => {
      if (settled) return;

      settled = true;
      clearTimeout(timeout);

      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      terminationProcess.kill();
      settleTermination(new Error(`taskkill timed out for Expo process ${expoProcess.pid}.`));
    }, 5_000);
    terminationProcess.once("error", settleTermination);
    terminationProcess.once("close", (code) => {
      if (code === 0) {
        settleTermination();
      } else {
        const errorSuffix = terminationErrorOutput.trim() ? `: ${terminationErrorOutput.trim()}` : ".";
        settleTermination(new Error(`taskkill failed for Expo process ${expoProcess.pid} with exit code ${code}${errorSuffix}`));
      }
    });
  });

  if (isProcessRunning(expoProcess) && !await waitForExit(expoProcess, 1_000)) {
    throw new Error(`Expo process ${expoProcess.pid} survived taskkill.`);
  }
}

async function stopExpoProcessTree(expoProcess: ChildProcess): Promise<void> {
  if (!expoProcess.pid) return;
  if (process.platform === "win32") {
    try {
      await terminateWindowsProcessTree(expoProcess);
    } catch (error) {
      expoProcess.kill("SIGKILL");

      if (isProcessRunning(expoProcess) && !await waitForExit(expoProcess, 1_000)) {
        throw new AggregateError(
          [error, new Error(`Expo process ${expoProcess.pid} survived fallback termination.`)],
          "Windows tree cleanup failed.",
          { cause: error },
        );
      }

      throw error;
    }

    return;
  }

  signalProcessGroup(expoProcess.pid, "SIGTERM");

  if (await waitForGroupExit(expoProcess.pid, 3_000)) return;

  signalProcessGroup(expoProcess.pid, "SIGKILL");

  if (!await waitForGroupExit(expoProcess.pid, 2_000)) {
    throw new Error(`Expo process group ${expoProcess.pid} did not terminate.`);
  }
}

async function drainOutput(expoProcess: ChildProcess): Promise<void> {
  const drained = Promise.allSettled([finished(expoProcess.stdout!), finished(expoProcess.stderr!)]);
  const timedOut = Symbol("timed-out");
  const results = await Promise.race([drained, delay(1_000, timedOut, { ref: false })]);

  if (results === timedOut) {
    expoProcess.stdout?.destroy();
    expoProcess.stderr?.destroy();
    throw new Error("Timed out waiting for Expo output streams to finish.");
  }

  const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

  if (errors.length) throw new AggregateError(errors.map(({ reason }) => reason), "Expo output stream failed.");
}

function appendDiagnosticOutput(
  current: string,
  chunk: string,
  truncated: boolean
): [string, boolean] {
  const combinedOutput = current + chunk;

  return combinedOutput.length > diagnosticCharacterLimit
    ? [combinedOutput.slice(-diagnosticCharacterLimit), true]
    : [combinedOutput, truncated];
}

function renderOutput(output: string, truncated: boolean): string {
  return `${truncated ? "[earlier output truncated]\n" : ""}${output || "(empty)"}`;
}

function formatFailure(error: unknown): string {
  if (error instanceof AggregateError) {
    const causes = error.errors.map((cause, index) => `Cause ${index + 1}:\n${formatFailure(cause)}`).join("\n");

    return `${error.stack ?? error.message}\n${causes}`;
  }

  return error instanceof Error ? error.stack ?? error.message : String(error);
}

if (!isTimeoutFixture) await rm(routerTypesPath, { force: true });

const port = await allocateTemporaryPort();
const expoCli = createRequire(join(mobileDirectory, "package.json")).resolve("expo/bin/cli");
const timeoutFixtureSource = [
  "const { spawn } = require('node:child_process');",
  "const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
  "console.log(`fixture pid=${process.pid} descendant=${descendant.pid}`);",
  "console.error('fixture stderr');",
  "setInterval(() => {}, 1000);",
].join("");
const expoArguments = isTimeoutFixture
  ? ["-e", timeoutFixtureSource]
  : [expoCli, "start", "--offline", "--port", String(port), "--max-workers", "1"];
const expoProcess = spawn(
  process.execPath,
  expoArguments,
  {
    cwd: mobileDirectory,
    detached: process.platform !== "win32",
    env: { ...process.env, CI: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }
);

let stdout = "";
let stderr = "";
let stdoutTruncated = false;
let stderrTruncated = false;
let routerResolutionFailure: string | undefined;
let routerFailureRaised = false;
let spawnError: Error | undefined;
expoProcess.stdout.setEncoding("utf8");
expoProcess.stderr.setEncoding("utf8");
expoProcess.stdout.on("data", (chunk: string) => {
  routerResolutionFailure ??= /[^\r\n]*expo-router\/internal\/(?:routing|testing)[^\r\n]*/i.exec(stdout + chunk)?.[0];
  [stdout, stdoutTruncated] = appendDiagnosticOutput(stdout, chunk, stdoutTruncated);
});
expoProcess.stderr.on("data", (chunk: string) => {
  routerResolutionFailure ??= /[^\r\n]*expo-router\/internal\/(?:routing|testing)[^\r\n]*/i.exec(stderr + chunk)?.[0];
  [stderr, stderrTruncated] = appendDiagnosticOutput(stderr, chunk, stderrTruncated);
});
expoProcess.once("error", (error) => {
  spawnError = error;
});

let cleanupPromise: Promise<void> | undefined;
let interruptedSignal: "SIGINT" | "SIGTERM" | undefined;
const cleanupExpoOnce = () => cleanupPromise ??= stopExpoProcessTree(expoProcess);
const requestInterrupt = (signal: "SIGINT" | "SIGTERM") => {
  if (interruptedSignal) return;

  interruptedSignal = signal;
  void cleanupExpoOnce().catch(() => undefined);
};
const onSigint = () => requestInterrupt("SIGINT");
const onSigterm = () => requestInterrupt("SIGTERM");
process.on("SIGINT", onSigint);
process.on("SIGTERM", onSigterm);

if (isTimeoutFixture) console.log(`fixture leader pid=${expoProcess.pid}`);

function assertExpoIsActive(phase: string): void {
  if (interruptedSignal) throw new Error(`Received ${interruptedSignal}; cleaning up Expo.`);
  if (spawnError) throw spawnError;
  if (routerResolutionFailure) {
    routerFailureRaised = true;
    throw new Error(`Expo Router internal resolution failed: ${routerResolutionFailure.trim()}`);
  }
  if (!isProcessRunning(expoProcess)) {
    throw new Error(`Expo exited ${phase} (code ${expoProcess.exitCode}, signal ${expoProcess.signalCode}).`);
  }
}

let verificationFailure: unknown;

try {
  const startupDeadlineMs = performance.now() + startupTimeoutMs;
  while (true) {
    assertExpoIsActive("before Metro became healthy");
    const remainingStartupMs = startupDeadlineMs - performance.now();

    if (remainingStartupMs <= 0) {
      throw new Error(`Metro did not become healthy within ${startupTimeoutMs / 1_000} seconds.`);
    }

    const metroIsReady = await isMetroHealthy(port, Math.min(1_000, remainingStartupMs));
    assertExpoIsActive("before Metro became healthy");

    if (performance.now() > startupDeadlineMs) {
      throw new Error(`Metro did not become healthy within ${startupTimeoutMs / 1_000} seconds.`);
    }
    if (metroIsReady) break;

    const remainingStartupPollMs = Math.max(1, startupDeadlineMs - performance.now());

    if (await waitForExit(expoProcess, Math.min(pollIntervalMs, remainingStartupPollMs))) assertExpoIsActive("before Metro became healthy");
  }

  const stabilityDeadlineMs = performance.now() + stabilityWindowMs;
  while (performance.now() < stabilityDeadlineMs) {
    assertExpoIsActive("during the stability window");
    // The observation deadline must not shrink a healthy response's timeout to 1 ms.
    if (!await isMetroHealthy(port)) {
      throw new Error("Metro stopped reporting healthy during the stability window.");
    }

    assertExpoIsActive("during the stability window");
    const remainingStabilityMs = stabilityDeadlineMs - performance.now();

    if (remainingStabilityMs > 0 && await waitForExit(expoProcess, Math.min(pollIntervalMs, remainingStabilityMs))) {
      assertExpoIsActive("during the stability window");
    }
  }

  if (!isTimeoutFixture) {
    const generatedRouterTypes = await stat(routerTypesPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;

      throw error;
    });

    if (!generatedRouterTypes?.isFile() || generatedRouterTypes.size === 0) {
      throw new Error("Expo did not generate .expo/types/router.d.ts during typed-route bootstrap.");
    }
    if (!await readFile(routerTypesPath, "utf8").then((content) => content.includes("declare module 'expo-router'"))) {
      throw new Error("Expo generated an invalid typed-route declaration.");
    }
  }
} catch (error) {
  verificationFailure = error;
} finally {
  try {
    await cleanupExpoOnce();
  } catch (error) {
    verificationFailure = verificationFailure ? new AggregateError([verificationFailure, error], "Verification and cleanup both failed.") : error;
  }

  process.off("SIGINT", onSigint);
  process.off("SIGTERM", onSigterm);

  try {
    await drainOutput(expoProcess);
  } catch (error) {
    verificationFailure = verificationFailure ? new AggregateError([verificationFailure, error], "Verification and output drain both failed.") : error;
  }
}

if (routerResolutionFailure && !routerFailureRaised) {
  const error = new Error(`Expo Router internal resolution failed: ${routerResolutionFailure.trim()}`);
  verificationFailure = verificationFailure ? new AggregateError([verificationFailure, error], "Verification and Router resolution both failed.") : error;
}
if (interruptedSignal && !verificationFailure) verificationFailure = new Error(`Received ${interruptedSignal}; Expo stopped.`);

if (verificationFailure) {
  console.error(`Mobile start verification failed:\n${formatFailure(verificationFailure)}`);
  console.error(`\n--- Expo stdout ---\n${renderOutput(stdout, stdoutTruncated)}`);
  console.error(`\n--- Expo stderr ---\n${renderOutput(stderr, stderrTruncated)}`);

  if (interruptedSignal === "SIGINT") process.exitCode = 130;
  else if (interruptedSignal === "SIGTERM") process.exitCode = 143;
  else process.exitCode = 1;
} else {
  console.log(`Verified Expo/Metro startup, typed routes, and ${stabilityWindowMs / 1_000}-second stability on port ${port}.`);
}
