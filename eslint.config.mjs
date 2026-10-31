import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const normalizePathCase = (path) => process.platform === "win32" ? path.toLowerCase() : path;
const projectPath = (filename) => normalizePathCase(relative(projectRoot, filename).replaceAll("\\", "/"));

const importBoundaries = {
  meta: {
    type: "problem",
    schema: [],
    messages: { forbidden: "Architecture boundary: {{source}}. {{boundary}}" },
  },
  create(context) {
    const filename = context.filename;
    const importer = projectPath(filename);
    const app = /^apps\/([^/]+)\//.exec(importer)?.[1];
    const isMusic = importer.startsWith("packages/music/");
    const isCore = importer.startsWith("packages/music/src/");
    const checkImport = (node) => {
      if (!node) return;

      const source = node?.type === "TemplateLiteral" && node.expressions.length === 0
        ? node.quasis[0].value.cooked
        : node?.value;

      if (typeof source !== "string") {
        if (isCore) context.report({
          node,
          messageId: "forbidden",
          data: { source: "nonliteral import", boundary: "Core imports require a literal module path." }
        });

        return;
      }

      const importPath = normalizePathCase(source);
      const isRelative = source.startsWith(".");
      const target = isRelative || isAbsolute(source)
        ? projectPath(resolve(dirname(filename), source))
        : importPath;
      const staysInsideMusic = isRelative && target.startsWith(isCore ? "packages/music/src/" : "packages/music/");
      const importsTestRunner = importPath === "vitest" && !isCore;
      let boundary;

      if (importPath.startsWith("@react-native-async-storage/async-storage") && importer !== "apps/mobile/app/_layout.tsx") {
        boundary = "Inject StorageAdapter from app/_layout.tsx.";
      } else if (isMusic && !staysInsideMusic && !importsTestRunner) {
        boundary = "Music source depends only on its own core; tests may use Vitest.";
      } else if (app) {
        const targetApp = /^apps\/([^/]+)(?:\/|$)/.exec(target)?.[1]
          ?? /^@notescale\/(web|mobile)(?:\/|$)/.exec(importPath)?.[1];

        if (targetApp && targetApp !== app) boundary = "Apps cannot import another app.";
        else if ((target.startsWith("packages/") || importPath.startsWith("@notescale/music/")) && importPath !== "@notescale/music") {
          boundary = "Apps consume shared music through @notescale/music, not package internals.";
        }
      }
      if (boundary) context.report({
        node,
        messageId: "forbidden",
        data: { source, boundary }
      });
    };

    return {
      ImportDeclaration: (node) => checkImport(node.source),
      ExportNamedDeclaration: (node) => checkImport(node.source),
      ExportAllDeclaration: (node) => checkImport(node.source),
      ImportExpression: (node) => checkImport(node.source),
      TSImportType: (node) => checkImport(node.source),
      TSImportEqualsDeclaration: (node) => checkImport(node.moduleReference.expression),
      CallExpression: (node) => {
        if (node.callee.type === "Identifier" && node.callee.name === "require") checkImport(node.arguments[0]);
      },
    };
  },
};

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.expo/**", "**/node_modules/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/music/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}", "apps/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: { architecture: { rules: { "import-boundaries": importBoundaries } } },
    rules: { "architecture/import-boundaries": "error" },
  },
  {
    files: ["packages/music/src/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-globals": ["error", {
        globals: ["window", "document", "navigator", "localStorage", "sessionStorage", "fetch", "XMLHttpRequest", "Audio", "AudioContext", "indexedDB"],
        checkGlobalObject: true,
      }],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
