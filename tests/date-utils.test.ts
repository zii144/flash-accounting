import assert from "node:assert/strict";
import test from "node:test";
import {
  compareCalendarKeys,
  isLocalDateKey,
  isLocalMonthKey,
  parseLocalDateKey,
  parseLocalMonthKey,
  toDisplayDate,
} from "../utils/date-utils";

test("recognizes local day and month keys", () => {
  assert.equal(isLocalDateKey("2026-04-27"), true);
  assert.equal(isLocalDateKey("2026-04"), false);
  assert.equal(isLocalMonthKey("2026-04"), true);
  assert.equal(isLocalMonthKey("2026-04-27"), false);
});

test("parses local date keys without UTC day drift", () => {
  const parsed = parseLocalDateKey("2026-04-27");

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 3);
  assert.equal(parsed.getDate(), 27);
  assert.equal(parsed.getHours(), 12);
});

test("parses local month keys without UTC month drift", () => {
  const parsed = parseLocalMonthKey("2026-04");

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 3);
  assert.equal(parsed.getDate(), 1);
  assert.equal(parsed.getHours(), 12);
});

test("creates display dates from local calendar keys", () => {
  const day = toDisplayDate("2026-12-31");
  const month = toDisplayDate("2026-12");

  assert.equal(day.getDate(), 31);
  assert.equal(month.getMonth(), 11);
});

test("compares calendar keys lexically", () => {
  assert.equal(compareCalendarKeys("2026-04-27", "2026-04-28") < 0, true);
  assert.equal(compareCalendarKeys("2026-05", "2026-04") > 0, true);
});
