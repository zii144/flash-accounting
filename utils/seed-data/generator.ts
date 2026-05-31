import type { Consumption } from "@/types/consumption";
import { createConsumptionRecord } from "@/utils/consumption-record";
import { getSeedLocaleDefinition } from "./locales";
import {
  DEFAULT_SEED_COUNT,
  DEFAULT_SEED_DAYS,
  type GeneratedSeedBatch,
  type MonthlySeedTemplate,
  type SeedGeneratorOptions,
  type SeedLocale,
  type SeedTemplate,
} from "./types";

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

function roundAmount(amount: number) {
  return Math.round(amount * 100) / 100;
}

function pickWeightedTemplate(random: () => number, templates: SeedTemplate[]) {
  const totalWeight = templates.reduce((sum, template) => sum + template.weight, 0);
  let cursor = random() * totalWeight;

  for (const template of templates) {
    cursor -= template.weight;
    if (cursor <= 0) {
      return template;
    }
  }

  return templates[templates.length - 1];
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

function buildRecordDate(random: () => number, day: Date, template: SeedTemplate | MonthlySeedTemplate) {
  const recordDate = new Date(day);

  if (template.activeHours) {
    const [startHour, endHour] = template.activeHours;
    const hour = startHour + Math.floor(random() * (endHour - startHour + 1));
    recordDate.setHours(hour, Math.floor(random() * 60), 0, 0);
    return recordDate;
  }

  recordDate.setHours(8 + Math.floor(random() * 13), Math.floor(random() * 60), 0, 0);
  return recordDate;
}

function createRecord(
  random: () => number,
  template: SeedTemplate | MonthlySeedTemplate,
  date: Date,
  index: number,
) {
  const timestamp = buildRecordDate(random, date, template).toISOString();
  const amount = roundAmount(randomBetween(random, template.minAmount, template.maxAmount));

  return createConsumptionRecord({
    id: `seed-${timestamp}-${index}-${Math.floor(random() * 1_000_000)}`,
    amount,
    description: template.description,
    type: template.type,
    category: template.category,
    date: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });
}

function buildMonthlyRecords(
  random: () => number,
  endDate: Date,
  months: number,
  templates: MonthlySeedTemplate[],
) {
  const records: Consumption[] = [];
  let index = 0;

  for (let monthOffset = months - 1; monthOffset >= 0; monthOffset -= 1) {
    const monthAnchor = new Date(endDate.getFullYear(), endDate.getMonth() - monthOffset, 1, 12, 0, 0, 0);

    for (const template of templates) {
      const day = new Date(
        monthAnchor.getFullYear(),
        monthAnchor.getMonth(),
        template.dayOfMonth,
        12,
        0,
        0,
        0,
      );
      records.push(createRecord(random, template, day, index));
      index += 1;
    }
  }

  return records;
}

export function generateSeedRecords(
  locale: SeedLocale,
  options: SeedGeneratorOptions = {},
): GeneratedSeedBatch {
  const definition = getSeedLocaleDefinition(locale);
  const count = options.count ?? DEFAULT_SEED_COUNT;
  const days = options.days ?? DEFAULT_SEED_DAYS;
  const endDate = startOfLocalDay(options.endDate ?? new Date());
  const startDate = addLocalDays(endDate, -(days - 1));
  const random = createSeededRandom(options.seed ?? 20260530 + locale.charCodeAt(0));
  const months = Math.max(1, Math.ceil(days / 30));

  const monthlyRecords = buildMonthlyRecords(random, endDate, months, definition.monthlyTemplates);
  const records: Consumption[] = [...monthlyRecords];
  const dayPool: Date[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    dayPool.push(addLocalDays(startDate, offset));
  }

  while (records.length < count) {
    const day = dayPool[Math.floor(random() * dayPool.length)] ?? endDate;
    const template = pickWeightedTemplate(random, definition.dailyTemplates);
    records.push(createRecord(random, template, day, records.length));
  }

  records.sort((left, right) => left.date.localeCompare(right.date));

  return {
    locale,
    records: records.slice(0, count),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}
