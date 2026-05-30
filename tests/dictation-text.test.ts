import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIosDictationText } from "../utils/dictation-text";

test("normalizeIosDictationText is a no-op off iOS", () => {
  const originalPlatform = process.env.EXPO_OS;
  process.env.EXPO_OS = "android";

  assert.equal(normalizeIosDictationText("appleapple", "apple"), "appleapple");

  process.env.EXPO_OS = originalPlatform;
});

test("normalizeIosDictationText collapses duplicated dictation on iOS", () => {
  const originalPlatform = process.env.EXPO_OS;
  process.env.EXPO_OS = "ios";

  assert.equal(normalizeIosDictationText("appleapple", "apple"), "apple");
  assert.equal(normalizeIosDictationText("appleapple", ""), "apple");
  assert.equal(normalizeIosDictationText("a\uFFFCpple", "a"), "apple");

  process.env.EXPO_OS = originalPlatform;
});
