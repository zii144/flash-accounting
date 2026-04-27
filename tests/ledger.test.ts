import assert from "node:assert/strict";
import test from "node:test";
import { calculateNetTotal, getSignedAmount } from "../utils/ledger";

test("getSignedAmount applies income and expense signs correctly", () => {
  assert.equal(getSignedAmount({ amount: 20, type: "income" }), 20);
  assert.equal(getSignedAmount({ amount: 20, type: "expense" }), -20);
});

test("calculateNetTotal returns the full ledger net total", () => {
  assert.equal(
    calculateNetTotal([
      { amount: 120, type: "income" },
      { amount: 45, type: "expense" },
      { amount: 10, type: "expense" },
    ]),
    65
  );
});
