import assert from "node:assert/strict";
import test from "node:test";
import {
  compareCalendarKeys,
  getCustomRangeBounds,
  isLocalDateKey,
  isLocalMonthKey,
  normalizeDateRange,
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

test("getCustomRangeBounds expands a range to full-day boundaries", () => {
  const { startIso, endIso } = getCustomRangeBounds({
    start: new Date(2026, 4, 10, 15, 30, 0),
    end: new Date(2026, 5, 20, 8, 0, 0),
  });

  const start = new Date(startIso);
  const end = new Date(endIso);

  // Start snaps to 00:00:00.000, end snaps to 23:59:59.999 (local time).
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
  assert.equal(start.getMilliseconds(), 0);
  assert.equal(start.getDate(), 10);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
  assert.equal(end.getMilliseconds(), 999);
  assert.equal(end.getDate(), 20);
});

test("getCustomRangeBounds spans across months (cross-month range)", () => {
  const { startIso, endIso } = getCustomRangeBounds({
    start: new Date(2026, 3, 1, 0, 0, 0),
    end: new Date(2026, 5, 30, 0, 0, 0),
  });

  assert.equal(startIso < endIso, true);
  assert.equal(new Date(startIso).getMonth(), 3);
  assert.equal(new Date(endIso).getMonth(), 5);
});

test("normalizeDateRange keeps start before end when moving the start past it", () => {
  const current = { start: new Date(2026, 4, 1), end: new Date(2026, 4, 10) };
  const next = normalizeDateRange("start", new Date(2026, 4, 20), current);

  // New start is after the old end, so the end is pulled forward to match.
  assert.equal(next.start.getTime(), new Date(2026, 4, 20).getTime());
  assert.equal(next.end.getTime(), new Date(2026, 4, 20).getTime());
});

test("normalizeDateRange keeps end after start when moving the end before it", () => {
  const current = { start: new Date(2026, 4, 10), end: new Date(2026, 4, 20) };
  const next = normalizeDateRange("end", new Date(2026, 4, 5), current);

  assert.equal(next.end.getTime(), new Date(2026, 4, 5).getTime());
  assert.equal(next.start.getTime(), new Date(2026, 4, 5).getTime());
});

test("normalizeDateRange leaves the other bound untouched for a valid change", () => {
  const current = { start: new Date(2026, 4, 1), end: new Date(2026, 4, 20) };
  const next = normalizeDateRange("start", new Date(2026, 4, 5), current);

  assert.equal(next.start.getTime(), new Date(2026, 4, 5).getTime());
  assert.equal(next.end.getTime(), current.end.getTime());
});
