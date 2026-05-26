import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_DIRS = ["app", "components", "contexts", "hooks"] as const;

const FORBIDDEN_FILES = [
  "components/CaptureAutomation.tsx",
  "scripts/capture-ios-screenshots.py",
] as const;

const FORBIDDEN_PATTERNS = [
  "CaptureAutomation",
  "capture:setForm",
  "capture:submitExpense",
  "capture:screenshot",
  "capture:video",
  "__flashAccountingCaptureStarted",
  "EXPO_PUBLIC_CAPTURE",
] as const;

function readSourceFiles(dir: string): string[] {
  const absoluteDir = path.join(ROOT, dir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const entryPath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readSourceFiles(path.relative(ROOT, entryPath)));
      continue;
    }

    if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function findForbiddenMatches(filePath: string, content: string): string[] {
  const relativePath = path.relative(ROOT, filePath);
  const matches: string[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (content.includes(pattern)) {
      matches.push(`${relativePath} contains "${pattern}"`);
    }
  }

  return matches;
}

test("capture automation files are removed from the repo", () => {
  for (const relativePath of FORBIDDEN_FILES) {
    assert.equal(
      fs.existsSync(path.join(ROOT, relativePath)),
      false,
      `expected ${relativePath} to be deleted`
    );
  }
});

test("root layout does not mount capture automation", () => {
  const layoutPath = path.join(ROOT, "app/_layout.tsx");
  const layoutSource = fs.readFileSync(layoutPath, "utf8");

  assert.equal(layoutSource.includes("CaptureAutomation"), false);
  assert.equal(layoutSource.includes("<CaptureAutomation"), false);
  assert.match(layoutSource, /<Stack[\s\S]*<\/Stack>/);
});

test("consumption form does not expose capture event hooks", () => {
  const formPath = path.join(ROOT, "components/ConsumptionForm.tsx");
  const formSource = fs.readFileSync(formPath, "utf8");

  assert.equal(formSource.includes("DeviceEventEmitter"), false);
  assert.equal(formSource.includes("capture:setForm"), false);
  assert.equal(formSource.includes("capture:submitExpense"), false);
});

test("app source tree contains no capture automation hooks", () => {
  const violations = SOURCE_DIRS.flatMap((dir) =>
    readSourceFiles(dir).flatMap((filePath) =>
      findForbiddenMatches(filePath, fs.readFileSync(filePath, "utf8"))
    )
  );

  assert.deepEqual(
    violations,
    [],
    violations.length > 0
      ? `capture automation references found:\n- ${violations.join("\n- ")}`
      : undefined
  );
});
