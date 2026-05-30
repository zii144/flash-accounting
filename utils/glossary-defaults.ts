import type {
  BuiltinGlossaryDefinition,
  BuiltinGlossaryKey,
  GlossaryPreferences,
} from "@/types/glossary";
import type { ResolvedLanguage } from "@/utils/formatting";
import { LOCALE_BUILTIN_TERMS } from "@/utils/glossary-locale-terms";

export const DEFAULT_GLOSSARY_PREFERENCES: GlossaryPreferences = {
  version: 1,
  builtinOverrides: {},
  customEntries: [],
};

export const BUILTIN_GLOSSARY_DEFINITIONS: BuiltinGlossaryDefinition[] = [
  {
    key: "dinner",
    type: "expense",
    terms: [
      "dinner",
      "dine",
      "dining",
      "supper",
      "fine dine",
      "restaurant",
      "hangout dine",
      "night dine",
      "nite dine",
    ],
    activeHours: [18, 21],
  },
  {
    key: "lunch",
    type: "expense",
    terms: ["lunch", "noon meal", "meal", "bento"],
    activeHours: [11, 14],
  },
  {
    key: "breakfast",
    type: "expense",
    terms: ["breakfast", "brunch", "morning meal"],
    activeHours: [6, 11],
  },
  {
    key: "coffee",
    type: "expense",
    terms: ["coffee", "latte", "americano", "cafe", "tea", "drink"],
    activeHours: [7, 18],
  },
  {
    key: "groceries",
    type: "expense",
    terms: ["grocery", "groceries", "supermarket", "market", "food shopping"],
  },
  {
    key: "transport",
    type: "expense",
    terms: ["uber", "taxi", "bus", "metro", "train", "parking", "gas", "transport", "mrt"],
  },
  {
    key: "shopping",
    type: "expense",
    terms: ["shopping", "clothes", "clothing", "shoes", "store", "mall"],
  },
  {
    key: "subscription",
    type: "expense",
    terms: ["subscription", "netflix", "spotify", "icloud", "saas", "membership"],
  },
  {
    key: "rent",
    type: "expense",
    terms: ["rent", "mortgage", "housing"],
  },
  {
    key: "salary",
    type: "income",
    terms: ["salary", "paycheck", "payroll", "wage", "income"],
  },
  {
    key: "freelance",
    type: "income",
    terms: ["freelance", "client paid", "invoice paid", "project paid"],
  },
  {
    key: "refund",
    type: "income",
    terms: ["refund", "reimburse", "cashback", "rebate"],
  },
];

export function getBuiltinDefinition(key: BuiltinGlossaryKey) {
  const definition = BUILTIN_GLOSSARY_DEFINITIONS.find((item) => item.key === key);
  if (!definition) {
    throw new Error(`Unknown glossary key: ${key}`);
  }
  return definition;
}

export function getLocalizedBuiltinTerms(
  key: BuiltinGlossaryKey,
  language: ResolvedLanguage,
) {
  const definition = getBuiltinDefinition(key);
  const localeTerms = LOCALE_BUILTIN_TERMS[language]?.[key] ?? [];
  return Array.from(new Set([...definition.terms, ...localeTerms]));
}

export function glossaryLabelKey(key: BuiltinGlossaryKey) {
  return `glossary.${key}`;
}
