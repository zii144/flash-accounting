import type { Consumption, ConsumptionType } from "@/types/consumption";

export type ConsumptionSuggestion = {
  label: string;
  confidence: number;
  reason: "semantic" | "history" | "time";
  inferredType: ConsumptionType;
};

type SemanticPattern = {
  label: string;
  type: ConsumptionType;
  terms: string[];
  activeHours?: [number, number];
};

const SEMANTIC_PATTERNS: SemanticPattern[] = [
  {
    label: "Dinner",
    type: "expense",
    terms: ["dinner", "dine", "dining", "supper", "fine dine", "restaurant", "hangout dine", "night dine", "nite dine"],
    activeHours: [18, 21],
  },
  {
    label: "Lunch",
    type: "expense",
    terms: ["lunch", "noon meal", "meal", "bento"],
    activeHours: [11, 14],
  },
  {
    label: "Breakfast",
    type: "expense",
    terms: ["breakfast", "brunch", "morning meal"],
    activeHours: [6, 11],
  },
  {
    label: "Coffee",
    type: "expense",
    terms: ["coffee", "latte", "americano", "cafe", "tea", "drink"],
    activeHours: [7, 18],
  },
  {
    label: "Groceries",
    type: "expense",
    terms: ["grocery", "groceries", "supermarket", "market", "food shopping"],
  },
  {
    label: "Transport",
    type: "expense",
    terms: ["uber", "taxi", "bus", "metro", "train", "parking", "gas", "transport", "mrt"],
  },
  {
    label: "Shopping",
    type: "expense",
    terms: ["shopping", "clothes", "clothing", "shoes", "store", "mall"],
  },
  {
    label: "Subscription",
    type: "expense",
    terms: ["subscription", "netflix", "spotify", "icloud", "saas", "membership"],
  },
  {
    label: "Rent",
    type: "expense",
    terms: ["rent", "mortgage", "housing"],
  },
  {
    label: "Salary",
    type: "income",
    terms: ["salary", "paycheck", "payroll", "wage", "income"],
  },
  {
    label: "Freelance",
    type: "income",
    terms: ["freelance", "client paid", "invoice paid", "project paid"],
  },
  {
    label: "Refund",
    type: "income",
    terms: ["refund", "reimburse", "cashback", "rebate"],
  },
];

const EXPENSE_WORDS = [
  "buy",
  "bought",
  "paid",
  "spend",
  "spent",
  "bill",
  "fee",
  "dinner",
  "lunch",
  "coffee",
  "uber",
  "taxi",
];

const INCOME_WORDS = [
  "salary",
  "paycheck",
  "payroll",
  "freelance",
  "invoice",
  "refund",
  "reimburse",
  "cashback",
  "bonus",
  "income",
];

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase())
    .join(" ");
}

function hourDistance(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 - diff);
}

function isHourInRange(hour: number, range?: [number, number]) {
  if (!range) {
    return false;
  }

  const [start, end] = range;
  return hour >= start && hour <= end;
}

export function canonicalizeConsumptionLabel(description: string) {
  const normalized = normalizeText(description);

  if (!normalized) {
    return "Unlabeled";
  }

  const exactPattern = SEMANTIC_PATTERNS.find((pattern) =>
    pattern.terms.some((term) => normalized.includes(normalizeText(term)))
  );

  if (exactPattern) {
    return exactPattern.label;
  }

  return toTitleCase(normalized).slice(0, 48);
}

export function inferConsumptionType(
  input: string,
  history: Consumption[] = [],
): ConsumptionType {
  const normalized = normalizeText(input);

  if (!normalized) {
    return "expense";
  }

  if (INCOME_WORDS.some((word) => normalized.includes(word))) {
    return "income";
  }

  if (EXPENSE_WORDS.some((word) => normalized.includes(word))) {
    return "expense";
  }

  const canonical = canonicalizeConsumptionLabel(input);
  const matchingHistory = history.filter(
    (item) => canonicalizeConsumptionLabel(item.description) === canonical
  );

  if (matchingHistory.length > 0) {
    const incomeCount = matchingHistory.filter((item) => item.type === "income").length;
    return incomeCount > matchingHistory.length / 2 ? "income" : "expense";
  }

  return "expense";
}

export function getConsumptionSuggestions(
  input: string,
  history: Consumption[] = [],
  now: Date = new Date(),
): ConsumptionSuggestion[] {
  const normalizedInput = normalizeText(input);

  if (!normalizedInput) {
    return [];
  }

  const currentHour = now.getHours();
  const suggestions = new Map<string, ConsumptionSuggestion>();

  for (const pattern of SEMANTIC_PATTERNS) {
    const normalizedLabel = normalizeText(pattern.label);
    const matchesPrefix = normalizedLabel.startsWith(normalizedInput);
    const matchesTerm = pattern.terms.some((term) => normalizeText(term).includes(normalizedInput));
    const matchesInput = pattern.terms.some((term) => normalizedInput.includes(normalizeText(term)));

    if (!matchesPrefix && !matchesTerm && !matchesInput) {
      continue;
    }

    const timeBoost = isHourInRange(currentHour, pattern.activeHours) ? 0.2 : 0;
    const baseConfidence = matchesInput ? 0.78 : matchesPrefix ? 0.72 : 0.58;
    suggestions.set(pattern.label, {
      label: pattern.label,
      confidence: Math.min(0.98, baseConfidence + timeBoost),
      reason: timeBoost > 0 ? "time" : "semantic",
      inferredType: pattern.type,
    });
  }

  const historicalMatches = history
    .map((item) => {
      const label = canonicalizeConsumptionLabel(item.description);
      const normalizedLabel = normalizeText(label);
      const date = new Date(item.date);
      const distance = Number.isNaN(date.getTime()) ? 12 : hourDistance(currentHour, date.getHours());
      const prefixMatch = normalizedLabel.startsWith(normalizedInput);
      const containsMatch = normalizedLabel.includes(normalizedInput);

      if (!prefixMatch && !containsMatch) {
        return null;
      }

      return {
        item,
        label,
        score: (prefixMatch ? 0.68 : 0.5) + Math.max(0, 0.24 - distance * 0.04),
        timeMatched: distance <= 2,
      };
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match));

  for (const match of historicalMatches) {
    const existing = suggestions.get(match.label);
    const nextConfidence = Math.min(0.98, match.score + (existing?.confidence ?? 0) * 0.2);
    const next: ConsumptionSuggestion = {
      label: match.label,
      confidence: Math.max(existing?.confidence ?? 0, nextConfidence),
      reason: match.timeMatched ? "time" : "history",
      inferredType: match.item.type,
    };
    suggestions.set(match.label, next);
  }

  const inferredType = inferConsumptionType(input, history);

  return Array.from(suggestions.values())
    .map((suggestion) => ({
      ...suggestion,
      inferredType: suggestion.inferredType ?? inferredType,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export function getSmartDraftEnhancement(
  description: string,
  history: Consumption[] = [],
  now: Date = new Date(),
) {
  if (!normalizeText(description)) {
    return {
      description: "",
      type: "expense" as ConsumptionType,
      suggestions: [],
    };
  }

  const suggestions = getConsumptionSuggestions(description, history, now);
  const topSuggestion = suggestions[0];
  const shouldApplySuggestion = Boolean(topSuggestion && topSuggestion.confidence >= 0.72);

  return {
    description:
      shouldApplySuggestion && topSuggestion ? topSuggestion.label : canonicalizeConsumptionLabel(description),
    type: topSuggestion?.inferredType ?? inferConsumptionType(description, history),
    suggestions,
  };
}
