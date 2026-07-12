import { DE_SEED_LOCALE } from "./de";
import { EN_SEED_LOCALE } from "./en";
import { ES_SEED_LOCALE } from "./es";
import { FR_SEED_LOCALE } from "./fr";
import { JA_SEED_LOCALE } from "./ja";
import { ZH_SEED_LOCALE } from "./zh";
import type { SeedLocale, SeedLocaleDefinition } from "../types";

// Demo-seed data is a dev tool and only ships for the original locales.
// Languages without a definition fall back to the English merchant set.
export const SEED_LOCALE_DEFINITIONS: Partial<Record<SeedLocale, SeedLocaleDefinition>> = {
  en: EN_SEED_LOCALE,
  zh: ZH_SEED_LOCALE,
  es: ES_SEED_LOCALE,
  fr: FR_SEED_LOCALE,
  de: DE_SEED_LOCALE,
  ja: JA_SEED_LOCALE,
};

export function getSeedLocaleDefinition(locale: SeedLocale): SeedLocaleDefinition {
  return SEED_LOCALE_DEFINITIONS[locale] ?? EN_SEED_LOCALE;
}
