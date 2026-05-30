/**
 * Application-wide constants
 */

export const STORAGE_KEYS = {
  CONSUMPTIONS: "@flash_accounting_consumptions",
  LANGUAGE: "@flash_accounting_language",
  GLOSSARY: "@flash_accounting_glossary",
  PRO_ENTITLEMENT: "@flash_accounting_pro_entitlement",
} as const;

export const FREE_LOCAL_RECORD_LIMIT = 200;

export const ANIMATION_CONFIG = {
  SPRING_DAMPING: 20,
  SPRING_STIFFNESS: 200,
  TRANSITION_DURATION: 300,
  FADE_OUT_DURATION: 200,
} as const;

export const TYPING_FEEDBACK_DELAY = 80;

export const SUPPORTED_LANGUAGES = [
  "en",
  "zh",
  "es",
  "fr",
  "de",
  "ja",
  "device",
] as const;

export type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
export type TimeFilter = "all" | "today" | "week" | "month" | "year";
export type ViewMode = "day" | "month";

export const SORT_OPTIONS: SortOption[] = [
  "date-desc",
  "date-asc",
  "amount-desc",
  "amount-asc",
];

export const TIME_FILTERS: TimeFilter[] = ["all", "today", "week", "month", "year"];
