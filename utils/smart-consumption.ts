import type { Consumption, ConsumptionType } from "@/types/consumption";
import { BUILTIN_GLOSSARY_DEFINITIONS } from "@/utils/glossary-defaults";

export type ConsumptionSuggestion = {
  label: string;
  confidence: number;
  reason: "semantic" | "history" | "time";
  inferredType: ConsumptionType;
};

export type SemanticPattern = {
  label: string;
  type: ConsumptionType;
  terms: string[];
  activeHours?: [number, number];
};

const DEFAULT_SEMANTIC_PATTERNS: SemanticPattern[] = BUILTIN_GLOSSARY_DEFINITIONS.map(
  (definition) => ({
    label: definition.key.charAt(0).toUpperCase() + definition.key.slice(1),
    type: definition.type,
    terms: definition.terms,
    activeHours: definition.activeHours,
  }),
);

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

function findPatternMatch(normalized: string, patterns: SemanticPattern[]) {
  let best: { pattern: SemanticPattern; termLength: number } | null = null;

  for (const pattern of patterns) {
    for (const term of pattern.terms) {
      const normalizedTerm = normalizeText(term);
      if (!normalizedTerm || !normalized.includes(normalizedTerm)) {
        continue;
      }

      if (!best || normalizedTerm.length > best.termLength) {
        best = { pattern, termLength: normalizedTerm.length };
      }
    }
  }

  return best?.pattern;
}

export function canonicalizeConsumptionLabel(
  description: string,
  patterns: SemanticPattern[] = DEFAULT_SEMANTIC_PATTERNS,
  unlabeledLabel = "Unlabeled",
) {
  const normalized = normalizeText(description);

  if (!normalized) {
    return unlabeledLabel;
  }

  const exactPattern = findPatternMatch(normalized, patterns);

  if (exactPattern) {
    return exactPattern.label;
  }

  return toTitleCase(normalized).slice(0, 48);
}

export function inferConsumptionType(
  input: string,
  history: Consumption[] = [],
  patterns: SemanticPattern[] = DEFAULT_SEMANTIC_PATTERNS,
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

  const matchedPattern = findPatternMatch(normalized, patterns);
  if (matchedPattern) {
    return matchedPattern.type;
  }

  const canonical = canonicalizeConsumptionLabel(input, patterns);
  const matchingHistory = history.filter(
    (item) => canonicalizeConsumptionLabel(item.description, patterns) === canonical,
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
  patterns: SemanticPattern[] = DEFAULT_SEMANTIC_PATTERNS,
): ConsumptionSuggestion[] {
  const normalizedInput = normalizeText(input);

  if (!normalizedInput) {
    return [];
  }

  const currentHour = now.getHours();
  const suggestions = new Map<string, ConsumptionSuggestion>();

  for (const pattern of patterns) {
    const normalizedLabel = normalizeText(pattern.label);
    const matchesPrefix = normalizedLabel.startsWith(normalizedInput);
    const matchesTerm = pattern.terms.some((term) =>
      normalizeText(term).includes(normalizedInput),
    );
    const matchesInput = pattern.terms.some((term) =>
      normalizedInput.includes(normalizeText(term)),
    );

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
      const label = canonicalizeConsumptionLabel(item.description, patterns);
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

  const inferredType = inferConsumptionType(input, history, patterns);

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
  patterns: SemanticPattern[] = DEFAULT_SEMANTIC_PATTERNS,
) {
  if (!normalizeText(description)) {
    return {
      description: "",
      type: "expense" as ConsumptionType,
      suggestions: [],
    };
  }

  const suggestions = getConsumptionSuggestions(description, history, now, patterns);
  const topSuggestion = suggestions[0];
  const shouldApplySuggestion = Boolean(topSuggestion && topSuggestion.confidence >= 0.72);

  return {
    description:
      shouldApplySuggestion && topSuggestion
        ? topSuggestion.label
        : canonicalizeConsumptionLabel(description, patterns),
    type: topSuggestion?.inferredType ?? inferConsumptionType(description, history, patterns),
    suggestions,
  };
}

