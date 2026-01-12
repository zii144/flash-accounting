/**
 * Utility functions for formatting dates, currency, and other display values
 */

export type ResolvedLanguage = "en" | "zh" | "es" | "fr" | "de" | "ja";

/**
 * Locale mapping for date/time formatting
 */
export const LOCALE_MAP: Record<ResolvedLanguage, string> = {
  en: "en-US",
  zh: "zh-TW",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
};

/**
 * Format currency with thousand separators
 */
export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format date based on language and context
 */
export const formatDate = (
  dateString: string,
  language: ResolvedLanguage,
  todayLabel: string,
  yesterdayLabel: string
): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return todayLabel;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return yesterdayLabel;
  }

  return date.toLocaleDateString(LOCALE_MAP[language] || "en-US", {
    month: "short",
    day: "numeric",
  });
};

/**
 * Format time based on language
 */
export const formatTime = (dateString: string, language: ResolvedLanguage): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString(LOCALE_MAP[language] || "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Format date for grouped display (day view)
 */
export const formatGroupedDate = (
  dateString: string,
  language: ResolvedLanguage,
  todayLabel: string,
  yesterdayLabel: string
): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return todayLabel;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return yesterdayLabel;
  }

  return date.toLocaleDateString(LOCALE_MAP[language] || "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format date for month view
 */
export const formatMonthLabel = (
  dateString: string,
  language: ResolvedLanguage
): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(LOCALE_MAP[language] || "en-US", {
    month: "long",
    year: "numeric",
  });
};
