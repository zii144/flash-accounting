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
  ];
}
