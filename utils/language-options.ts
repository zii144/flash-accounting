import type { LanguageContextType, Language } from "@/contexts/LanguageContext";

type Translate = LanguageContextType["t"];

export interface LanguageOption {
  code: Language;
  name: string;
}

export function getLanguageOptions(t: Translate): LanguageOption[] {
  return [
    { code: "device", name: t("device") },
    { code: "en", name: t("english") },
    { code: "zh", name: t("chinese") },
    { code: "es", name: t("spanish") },
    { code: "fr", name: t("french") },
    { code: "de", name: t("german") },
    { code: "ja", name: t("japanese") },
    // Newer locales are shown as endonyms (each language in its own script).
    { code: "hi", name: "हिन्दी" },
    { code: "pt", name: "Português" },
    { code: "ru", name: "Русский" },
    { code: "id", name: "Bahasa Indonesia" },
    { code: "ko", name: "한국어" },
    { code: "it", name: "Italiano" },
    { code: "tr", name: "Türkçe" },
    { code: "vi", name: "Tiếng Việt" },
    { code: "th", name: "ไทย" },
    { code: "pl", name: "Polski" },
  ];
}
