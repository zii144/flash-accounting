const LOCAL_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;

export function isLocalDateKey(value: string): boolean {
  return LOCAL_DATE_KEY_REGEX.test(value);
}

export function isLocalMonthKey(value: string): boolean {
  return LOCAL_MONTH_KEY_REGEX.test(value);
}

export function parseLocalDateKey(value: string): Date {
  if (!isLocalDateKey(value)) {
    throw new Error(`Invalid local date key: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function parseLocalMonthKey(value: string): Date {
  if (!isLocalMonthKey(value)) {
    throw new Error(`Invalid local month key: ${value}`);
  }

  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

export function toDisplayDate(value: string): Date {
  if (isLocalDateKey(value)) {
    return parseLocalDateKey(value);
  }

  if (isLocalMonthKey(value)) {
    return parseLocalMonthKey(value);
  }

  return new Date(value);
}

export function compareCalendarKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Expands an inclusive day range into ISO boundaries: the start of the first
 * day (00:00:00.000) through the end of the last day (23:59:59.999). Used to
 * build the custom-range SQL filter for the diagram.
 */
export function getCustomRangeBounds(range: DateRange): { startIso: string; endIso: string } {
  const rangeStart = new Date(range.start);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(range.end);
  rangeEnd.setHours(23, 59, 59, 999);
  return { startIso: rangeStart.toISOString(), endIso: rangeEnd.toISOString() };
}

/**
 * Applies a new start or end date to a range while keeping start <= end. When
 * a new start lands after the current end (or a new end before the current
 * start), the other bound is pulled along so the range never inverts.
 */
export function normalizeDateRange(
  which: "start" | "end",
  nextDate: Date,
  current: DateRange,
): DateRange {
  if (which === "start") {
    const end = nextDate > current.end ? nextDate : current.end;
    return { start: nextDate, end };
  }

  const start = nextDate < current.start ? nextDate : current.start;
  return { start, end: nextDate };
}

export function getLocalDaySqlExpression(columnName: string): string {
  return `DATE(${columnName}, 'localtime')`;
}

export function getLocalMonthSqlExpression(columnName: string): string {
  return `strftime('%Y-%m', ${columnName}, 'localtime')`;
}
