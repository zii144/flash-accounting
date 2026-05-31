import assert from "node:assert/strict";
import test from "node:test";
import { generateSeedRecords, SUPPORTED_SEED_LOCALES } from "../utils/seed-data";

test("generateSeedRecords creates about 150 records across roughly three months", () => {
  const batch = generateSeedRecords("en", { count: 150, days: 90, seed: 42 });

  assert.equal(batch.records.length, 150);

  const firstDay = batch.records[0]?.date.slice(0, 10);
  const lastDay = batch.records.at(-1)?.date.slice(0, 10);

  assert.ok(firstDay);
  assert.ok(lastDay);

  const spanDays =
    (new Date(lastDay).getTime() - new Date(firstDay).getTime()) / (1000 * 60 * 60 * 24);

  assert.ok(spanDays >= 60);
  assert.ok(batch.records.every((record) => record.description.length > 0));
});

test("generateSeedRecords localizes descriptions per language", () => {
  const english = generateSeedRecords("en", { count: 150, seed: 7 });
  const chinese = generateSeedRecords("zh", { count: 150, seed: 7 });

  assert.ok(english.records.some((record) => record.description === "Coffee"));
  assert.ok(chinese.records.some((record) => record.description === "咖啡"));
  assert.notEqual(
    english.records[0]?.description,
    chinese.records[0]?.description,
  );
});

test("supported seed locales cover all app languages", () => {
  assert.deepEqual(SUPPORTED_SEED_LOCALES, ["en", "zh", "es", "fr", "de", "ja"]);
});
