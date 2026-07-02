import type { ResolvedLanguage } from "@/utils/formatting";
import type { Consumption } from "@/types/consumption";
import type { TimeFilter } from "@/utils/constants";
import {
  compareCalendarKeys,
  parseLocalDateKey,
  parseLocalMonthKey,
  toLocalDateKey,
  toLocalMonthKey,
} from "@/utils/date-utils";
import { LOCALE_MAP } from "@/utils/formatting";

export type CategoryDatum = {
  label: string;
  amount: number;
  percentage: number;
  count: number;
};

export type TrendDatum = {
  key: string;
  label: string;
  expense: number;
  income: number;
  net: number;
};

export type DiagramSummary = {
  expenseTotal: number;
  incomeTotal: number;
  netTotal: number;
  topCategory: CategoryDatum | null;
  averageExpense: number;
};

function formatMonth(date: Date, language: ResolvedLanguage) {
  return date.toLocaleDateString(LOCALE_MAP[language] || "en-US", { month: "short" });
}

function formatDay(date: Date, language: ResolvedLanguage) {
  return date.toLocaleDateString(LOCALE_MAP[language] || "en-US", {
    month: "numeric",
    day: "numeric",
  });
}

function getTrendKey(date: Date, timeFilter: TimeFilter) {
  if (timeFilter === "all" || timeFilter === "year") {
    return toLocalMonthKey(date);
  }

  return toLocalDateKey(date);
}

function getTrendLabel(key: string, timeFilter: TimeFilter, language: ResolvedLanguage) {
  if (timeFilter === "all" || timeFilter === "year") {
    return formatMonth(parseLocalMonthKey(key), language);
  }

  return formatDay(parseLocalDateKey(key), language);
}

export function buildCategoryBreakdown(
  records: Consumption[],
  canonicalizeLabel: (description: string) => string,
): CategoryDatum[] {
  const expenses = records.filter((record) => record.type === "expense");
  const total = expenses.reduce((sum, record) => sum + record.amount, 0);
  const grouped = new Map<string, { amount: number; count: number }>();

  for (const record of expenses) {
    const label = canonicalizeLabel(record.description);
    const current = grouped.get(label) ?? { amount: 0, count: 0 };
    grouped.set(label, {
      amount: current.amount + record.amount,
      count: current.count + 1,
    });
  }

  return Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      amount: value.amount,
      count: value.count,
      percentage: total > 0 ? value.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export type CategoryDetail = {
  records: Consumption[];
  total: number;
};

/**
 * Collects the individual expense records that make up a single category in
 * the breakdown, sorted largest-first, along with their combined total. Used
 * by the diagram detail sheet when a chart segment is tapped.
 */
export function buildCategoryDetail(
  records: Consumption[],
  canonicalizeLabel: (description: string) => string,
  label: string,
): CategoryDetail {
  const matching = records
    .filter(
      (record) =>
        record.type === "expense" && canonicalizeLabel(record.description) === label,
    )
    .sort((a, b) => b.amount - a.amount);

  const total = matching.reduce((sum, record) => sum + record.amount, 0);

  return { records: matching, total };
}

export function buildTrendSeries(
  records: Consumption[],
  timeFilter: TimeFilter,
  language: ResolvedLanguage,
): TrendDatum[] {
  const grouped = new Map<string, TrendDatum>();

  for (const record of records) {
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const key = getTrendKey(date, timeFilter);
    const existing =
      grouped.get(key) ??
      ({
        key,
        label: getTrendLabel(key, timeFilter, language),
        expense: 0,
        income: 0,
        net: 0,
      } satisfies TrendDatum);

    if (record.type === "income") {
      existing.income += record.amount;
    } else {
      existing.expense += record.amount;
    }

    existing.net = existing.income - existing.expense;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .sort((a, b) => compareCalendarKeys(a.key, b.key))
    .slice(-14);
}

export function buildDiagramSummary(
  records: Consumption[],
  canonicalizeLabel: (description: string) => string,
): DiagramSummary {
  const categories = buildCategoryBreakdown(records, canonicalizeLabel);
  const expenseTotal = records.reduce(
    (sum, record) => sum + (record.type === "expense" ? record.amount : 0),
    0,
  );
  const incomeTotal = records.reduce(
    (sum, record) => sum + (record.type === "income" ? record.amount : 0),
    0,
  );
  const activeDays = new Set(records.map((record) => record.date.slice(0, 10))).size || 1;

  return {
    expenseTotal,
    incomeTotal,
    netTotal: incomeTotal - expenseTotal,
    topCategory: categories[0] ?? null,
    averageExpense: expenseTotal / activeDays,
  };
}
