import assert from "node:assert/strict";
import test from "node:test";
import type { Consumption } from "../types/consumption";
import { buildCategoryDetail, buildTrendSeries } from "../utils/diagram-data";

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

function makeRecord(
  id: string,
  amount: number,
  description: string,
  type: "expense" | "income",
): Consumption {
  const isoDate = new Date(2026, 4, 1, 12, 0, 0).toISOString();

  return {
    id,
    amount,
    description,
    type,
    date: isoDate,
    createdAt: isoDate,
    updatedAt: isoDate,
    deletedAt: null,
  };
}

const identity = (description: string) => description;

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

test("buildCategoryDetail returns matching expenses sorted largest-first with total", () => {
  const records: Consumption[] = [
    makeRecord("a", 30, "Coffee", "expense"),
    makeRecord("b", 90, "Coffee", "expense"),
    makeRecord("c", 15, "Coffee", "expense"),
    makeRecord("d", 50, "Groceries", "expense"),
  ];

  const detail = buildCategoryDetail(records, identity, "Coffee");

  assert.deepEqual(
    detail.records.map((record) => record.id),
    ["b", "a", "c"],
  );
  assert.equal(detail.total, 135);
});

test("buildCategoryDetail excludes income and non-matching categories", () => {
  const records: Consumption[] = [
    makeRecord("a", 40, "Salary", "income"),
    makeRecord("b", 40, "Coffee", "expense"),
    makeRecord("c", 40, "Coffee", "income"),
  ];

  const detail = buildCategoryDetail(records, identity, "Coffee");

  assert.deepEqual(
    detail.records.map((record) => record.id),
    ["b"],
  );
  assert.equal(detail.total, 40);
});

test("buildCategoryDetail groups by canonical label, not raw description", () => {
  const canonicalize = (description: string) =>
    description.toLowerCase().includes("starbucks") ? "Coffee" : description;
  const records: Consumption[] = [
    makeRecord("a", 25, "Starbucks downtown", "expense"),
    makeRecord("b", 75, "Starbucks airport", "expense"),
    makeRecord("c", 10, "Rent", "expense"),
  ];

  const detail = buildCategoryDetail(records, canonicalize, "Coffee");

  assert.deepEqual(
    detail.records.map((record) => record.id),
    ["b", "a"],
  );
  assert.equal(detail.total, 100);
});

test("buildCategoryDetail returns an empty result when nothing matches", () => {
  const records: Consumption[] = [makeRecord("a", 20, "Coffee", "expense")];

  const detail = buildCategoryDetail(records, identity, "Travel");

  assert.deepEqual(detail.records, []);
  assert.equal(detail.total, 0);
});
