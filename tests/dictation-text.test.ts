import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIosDictationText } from "../utils/dictation-text";

test("normalizeIosDictationText preserves typed duplicate text", () => {
  const originalPlatform = process.env.EXPO_OS;
  process.env.EXPO_OS = "ios";

  assert.equal(normalizeIosDictationText("appleapple", "apple"), "appleapple");
  assert.equal(normalizeIosDictationText("速速", "速"), "速速");

  process.env.EXPO_OS = originalPlatform;
});

test("normalizeIosDictationText strips dictation placeholders", () => {
  const originalPlatform = process.env.EXPO_OS;
  process.env.EXPO_OS = "ios";

  assert.equal(normalizeIosDictationText("a\uFFFCpple", "a"), "apple");

  process.env.EXPO_OS = originalPlatform;
});
