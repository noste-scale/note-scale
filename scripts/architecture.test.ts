import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const eslint = new ESLint({ cwd: projectRoot });

test("core compilation excludes Node ambient types and all DOM/worker library variants", () => {
  const config = ts.readConfigFile(resolve(projectRoot, "packages/music/tsconfig.json"), ts.sys.readFile);

  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(projectRoot, "packages/music"));

  assert.deepEqual(parsed.errors, []);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const platformFiles = program.getSourceFiles().filter((file) => {
    const filename = file.fileName.replaceAll("\\", "/");

    return /\/lib\.(?:dom|webworker)[^/]*\.d\.ts$/i.test(filename) || /\/@types\/node\//i.test(filename);
  });

  assert.deepEqual(parsed.options.types, []);
  assert.deepEqual(platformFiles.map((file) => file.fileName), []);
});

test("architecture accepts inward core/package/app imports", async () => {
  for (const [file, source] of [
    ["packages/music/src/training.ts", 'import "./exercises";'],
    ["packages/music/tests/training.test.ts", 'import "vitest"; import "../src/index";'],
    ["apps/web/src/app-model.ts", 'import "@notescale/music"; import "react"; import "./domain";'],
    ["apps/mobile/app/_layout.tsx", 'import "@notescale/music"; import "@react-native-async-storage/async-storage";'],
    ...(process.platform === "win32" ? [["packages/music/src/training.ts", 'import "../Src/notes";']] : []),
  ]) {
    const [result] = await eslint.lintText(source!, { filePath: resolve(projectRoot, file!) });

    assert.equal(result?.errorCount, 0, JSON.stringify(result?.messages));
  }
});

test("architecture rejects framework, platform, cross-app and package-internal dependencies", async () => {
  for (const [file, source] of [
    ["packages/music/src/training.ts", 'import "react";'],
    ["packages/music/src/training.ts", 'type Node = import("react").ReactNode;'],
    ["packages/music/src/training.ts", 'void import(`react`);'],
    ["packages/music/src/training.ts", 'const moduleName = "react"; void import(moduleName);'],
    ["packages/music/src/training.ts", 'const moduleName = "react"; require(moduleName);'],
    ["packages/music/src/training.ts", 'const moduleName = "react"; void import(`./${moduleName}`);'],
    ["packages/music/src/training.ts", 'import "react-native";'],
    ["packages/music/src/training.ts", 'import "node:fs";'],
    ["packages/music/src/training.ts", 'export * from "../../../apps/web/src/domain";'],
    ["packages/music/src/training.ts", 'import "../tests/training.test";'],
    ["packages/music/tests/training.test.ts", 'import "expo";'],
    ["apps/web/src/app-model.ts", 'export * from "../../mobile/src/domain";'],
    ["apps/web/src/app-model.ts", `import ${JSON.stringify(resolve(projectRoot, "apps/mobile/src/domain.ts"))};`],
    ["apps/mobile/src/domain.ts", 'void import("../../web/src/domain");'],
    ["apps/mobile/src/domain.ts", 'require("@notescale/web");'],
    ["apps/web/src/app-model.ts", 'import "../../../packages/music/src/types";'],
    ["apps/mobile/src/domain.ts", 'import "@notescale/music/src/types";'],
    ...(process.platform === "win32" ? [
      ["packages/music/src/training.ts", 'import "../../../Apps/web/src/domain";'],
      ["apps/mobile/src/domain.ts", 'import "../../../Apps/web/src/domain";'],
      ["apps/web/src/app-model.ts", 'import "../../../Packages/music/src/types";'],
    ] : []),
  ]) {
    const [result] = await eslint.lintText(source!, { filePath: resolve(projectRoot, file!) });

    assert.ok(result?.messages.some((message) => message.ruleId === "architecture/import-boundaries" && message.message.includes("Architecture boundary")), `${file}: ${source}`);
  }
});

test("core rejects browser globals and only mobile composition imports concrete storage", async () => {
  for (const [file, source, rule] of [
    ["packages/music/src/training.ts", 'window.localStorage.getItem("progress");', "no-restricted-globals"],
    ["packages/music/src/training.ts", 'globalThis.fetch("https://example.test");', "no-restricted-globals"],
    ["apps/mobile/src/progress.tsx", 'import "@react-native-async-storage/async-storage";', "architecture/import-boundaries"],
    ["apps/mobile/src/theme.tsx", 'void import("@react-native-async-storage/async-storage");', "architecture/import-boundaries"],
    ["apps/mobile/src/theme.tsx", 'require("@react-native-async-storage/async-storage");', "architecture/import-boundaries"],
    ["apps/mobile/src/adapter.ts", 'import "@react-native-async-storage/async-storage";', "architecture/import-boundaries"],
    ["apps/mobile/app/(tabs)/index.tsx", 'import "@react-native-async-storage/async-storage";', "architecture/import-boundaries"],
    ["apps/web/src/adapter.ts", 'import "@react-native-async-storage/async-storage";', "architecture/import-boundaries"],
  ]) {
    const [result] = await eslint.lintText(source!, { filePath: resolve(projectRoot, file!) });

    assert.ok(result?.messages.some((message) => message.ruleId === rule), `${file}: ${source}`);
  }
});

test("import and global guards cover every executable JavaScript/TypeScript extension", async () => {
  for (const extension of ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"]) {
    const [result] = await eslint.lintText('import "react"; globalThis.fetch("https://example.test");', {
      filePath: resolve(projectRoot, `packages/music/src/probe.${extension}`),
    });

    assert.ok(result?.messages.some((message) => message.ruleId === "architecture/import-boundaries"), extension);
    assert.ok(result?.messages.some((message) => message.ruleId === "no-restricted-globals"), extension);
  }
});
