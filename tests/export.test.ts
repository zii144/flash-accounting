import assert from "node:assert/strict";
import test from "node:test";
import { buildConsumptionsCsv } from "../utils/export";

test("buildConsumptionsCsv includes the type column and escapes text fields", () => {
  const csv = buildConsumptionsCsv(
    [
      {
        id: "expense-1",
        amount: 12.5,
        description: 'Taxi "home"',
        type: "expense",
        category: "transport",
        date: "2026-04-27T16:30:00.000Z",
        createdAt: "2026-04-27T16:30:00.000Z",
        updatedAt: "2026-04-27T16:30:00.000Z",
      },
      {
        id: "income-1",
        amount: 50,
        description: "Refund",
        type: "income",
        date: "2026-04-28T08:15:00.000Z",
        createdAt: "2026-04-28T08:15:00.000Z",
        updatedAt: "2026-04-28T08:15:00.000Z",
      },
    ],
    "en-US"
  );

  const lines = csv.split("\n");

  assert.equal(lines[0], "Date,Type,Amount,Description,Category");
  assert.equal(lines[1]?.includes('"expense"'), true);
  assert.equal(lines[1]?.includes('"Taxi ""home"""'), true);
  assert.equal(lines[2]?.includes('"income"'), true);
});
