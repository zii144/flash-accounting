import type { ConsumptionType } from "@/types/consumption";

export type BuiltinGlossaryKey =
  | "dinner"
  | "lunch"
  | "breakfast"
  | "coffee"
  | "groceries"
  | "transport"
  | "shopping"
  | "subscription"
  | "rent"
  | "salary"
  | "freelance"
  | "refund";

export const BUILTIN_GLOSSARY_KEYS: BuiltinGlossaryKey[] = [
  "dinner",
  "lunch",
  "breakfast",
  "coffee",
  "groceries",
  "transport",
  "shopping",
  "subscription",
  "rent",
  "salary",
  "freelance",
  "refund",
];

export type BuiltinGlossaryOverride = {
  label?: string;
  extraTerms?: string[];
  disabled?: boolean;
  type?: ConsumptionType;
};

export type CustomGlossaryEntry = {
  id: string;
  label: string;
  type: ConsumptionType;
  terms: string[];
  activeHours?: [number, number];
};

export type GlossaryPreferences = {
  version: 1;
  builtinOverrides: Partial<Record<BuiltinGlossaryKey, BuiltinGlossaryOverride>>;
  customEntries: CustomGlossaryEntry[];
};

export type BuiltinGlossaryDefinition = {
  key: BuiltinGlossaryKey;
  type: ConsumptionType;
  terms: string[];
  activeHours?: [number, number];
};

export type GlossaryEntryView = {
  id: string;
  source: "builtin" | "custom";
  builtinKey?: BuiltinGlossaryKey;
  label: string;
  defaultLabel?: string;
  type: ConsumptionType;
  terms: string[];
  defaultTerms?: string[];
  extraTerms?: string[];
  disabled: boolean;
  hasCustomization: boolean;
  activeHours?: [number, number];
};
