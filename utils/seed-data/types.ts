import type { Consumption, ConsumptionCategory, ConsumptionType } from "@/types/consumption";
import type { ResolvedLanguage } from "@/utils/formatting";

export type SeedLocale = ResolvedLanguage;

export type SeedTemplate = {
  description: string;
  type: ConsumptionType;
  category?: ConsumptionCategory;
  minAmount: number;
  maxAmount: number;
  weight: number;
  activeHours?: [number, number];
};

export type MonthlySeedTemplate = SeedTemplate & {
  dayOfMonth: number;
};

export type SeedLocaleDefinition = {
  locale: SeedLocale;
  dailyTemplates: SeedTemplate[];
  monthlyTemplates: MonthlySeedTemplate[];
};

export type SeedGeneratorOptions = {
  count?: number;
  days?: number;
  endDate?: Date;
  seed?: number;
};

export type GeneratedSeedBatch = {
  locale: SeedLocale;
  records: Consumption[];
  startDate: string;
  endDate: string;
};

export const DEFAULT_SEED_COUNT = 150;
export const DEFAULT_SEED_DAYS = 90;

export const SUPPORTED_SEED_LOCALES: SeedLocale[] = ["en", "zh", "es", "fr", "de", "ja"];
