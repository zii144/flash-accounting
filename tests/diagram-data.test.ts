import assert from "node:assert/strict";
import test from "node:test";
import { buildTrendSeries } from "../utils/diagram-data";

function makeExpense(id: string, amount: number, date: Date) {
  const isoDate = date.toISOString();

  return {
    id,
    amount,
    description: id,
    type: "expense" as const,
    date: isoDate,
    createdAt: isoDate,
    updatedAt: isoDate,
    deletedAt: null,
  };
}

test("buildTrendSeries groups records by local day for month filter", () => {
  const records = [
    makeExpense("1", 100, new Date(2026, 4, 1, 9, 0, 0)),
    makeExpense("2", 50, new Date(2026, 4, 1, 21, 0, 0)),
  ];

  const trend = buildTrendSeries(records, "month", "en");

  assert.equal(trend.length, 1);
  assert.equal(trend[0]?.expense, 150);
  assert.equal(trend[0]?.key, "2026-05-01");
});

test("buildTrendSeries sorts trend points chronologically by key", () => {
  const records = [
    makeExpense("1", 20, new Date(2026, 4, 3, 12, 0, 0)),
    makeExpense("2", 10, new Date(2026, 4, 1, 12, 0, 0)),
  ];

  const trend = buildTrendSeries(records, "month", "en");

  assert.deepEqual(
    trend.map((datum) => datum.key),
    ["2026-05-01", "2026-05-03"],
  );
});
