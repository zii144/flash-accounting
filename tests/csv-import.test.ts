import assert from "node:assert/strict";
import test from "node:test";
import { buildConsumptionsCsv } from "../utils/export";
import { parseConsumptionsCsv } from "../utils/csv-import";

test("parseConsumptionsCsv imports the app export format", () => {
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

  const result = parseConsumptionsCsv(csv);

  assert.equal(result.consumptions.length, 2);
  assert.equal(result.consumptions[0]?.amount, 12.5);
  assert.equal(result.consumptions[0]?.description, 'Taxi "home"');
  assert.equal(result.consumptions[0]?.type, "expense");
  assert.equal(result.consumptions[0]?.category, "transport");
  assert.equal(result.consumptions[1]?.type, "income");
});

test("parseConsumptionsCsv supports quoted commas", () => {
  const result = parseConsumptionsCsv(
    'Date,Type,Amount,Description,Category\n"2026-04-27T16:30:00.000Z","expense","1,234.50","Lunch, drinks","food"'
  );

  assert.equal(result.consumptions[0]?.amount, 1234.5);
  assert.equal(result.consumptions[0]?.description, "Lunch, drinks");
});

test("parseConsumptionsCsv rejects invalid required fields", () => {
  assert.throws(
    () => parseConsumptionsCsv("Date,Type,Amount\nnot-a-date,expense,12"),
    /Date is invalid/
  );
  assert.throws(
    () => parseConsumptionsCsv("Date,Type,Amount\n2026-04-27T16:30:00.000Z,other,12"),
    /Type must be expense or income/
  );
});
