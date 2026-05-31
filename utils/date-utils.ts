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

export function getLocalDaySqlExpression(columnName: string): string {
  return `DATE(${columnName}, 'localtime')`;
}

export function getLocalMonthSqlExpression(columnName: string): string {
  return `strftime('%Y-%m', ${columnName}, 'localtime')`;
}
