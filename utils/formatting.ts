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

/**
 * Format amount input with thousand separators
 */
export const formatAmountInput = (value: string): string => {
  // Remove all non-digit characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, "");

  // Handle multiple decimal points - keep only the first one
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    const integerPart = parts[0];
    const decimalPart = parts.slice(1).join("");
    return `${integerPart}.${decimalPart}`;
  }

  const integerPart = parts[0];
  const decimalPart = parts[1];
  const hasDecimalPoint = cleaned.includes(".");

  // Add thousand separators to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Limit decimal places to 2
  const limitedDecimal = decimalPart ? decimalPart.slice(0, 2) : "";

  // Preserve decimal point even if no decimal digits yet (e.g., "2.")
  if (hasDecimalPoint) {
    return `${formattedInteger}.${limitedDecimal}`;
  }

  return formattedInteger;
};

/**
 * Parse formatted amount back to number string (remove commas)
 */
export const parseAmountInput = (value: string): string => {
  return value.replace(/,/g, "");
};
