import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SEED_COUNT,
  DEFAULT_SEED_DAYS,
  generateSeedRecords,
  SUPPORTED_SEED_LOCALES,
  type SeedLocale,
} from "../../utils/seed-data";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(scriptDir, "output");

function parseArgs(argv: string[]) {
  const args = new Set(argv);
  const langArg = argv.find((arg) => arg.startsWith("--lang="))?.split("=")[1];
  const countArg = argv.find((arg) => arg.startsWith("--count="))?.split("=")[1];
  const daysArg = argv.find((arg) => arg.startsWith("--days="))?.split("=")[1];
  const seedArg = argv.find((arg) => arg.startsWith("--seed="))?.split("=")[1];

  return {
    all: args.has("--all"),
    lang: langArg as SeedLocale | undefined,
    count: countArg ? Number(countArg) : DEFAULT_SEED_COUNT,
    days: daysArg ? Number(daysArg) : DEFAULT_SEED_DAYS,
    seed: seedArg ? Number(seedArg) : undefined,
  };
}

function summarizeLocale(
  locale: SeedLocale,
  options: { count: number; days: number; seed?: number },
) {
  const batch = generateSeedRecords(locale, options);
  const expenseTotal = batch.records
    .filter((record) => record.type === "expense")
    .reduce((sum, record) => sum + record.amount, 0);
  const incomeTotal = batch.records
    .filter((record) => record.type === "income")
    .reduce((sum, record) => sum + record.amount, 0);

  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${locale}.json`);
  writeFileSync(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");

  console.log(
    [
      `[${locale}] wrote ${batch.records.length} records to ${outputPath}`,
      `range: ${batch.startDate.slice(0, 10)} -> ${batch.endDate.slice(0, 10)}`,
      `expenses: ${expenseTotal.toFixed(2)} | income: ${incomeTotal.toFixed(2)}`,
    ].join("\n"),
  );
}

export function runSeedAll(options?: Omit<Parameters<typeof summarizeLocale>[1], never> & {
  count?: number;
  days?: number;
  seed?: number;
}) {
  const parsed = parseArgs(process.argv.slice(2));

  for (const locale of SUPPORTED_SEED_LOCALES) {
    summarizeLocale(locale, {
      count: options?.count ?? parsed.count,
      days: options?.days ?? parsed.days,
      seed: options?.seed ?? parsed.seed,
    });
  }
}

export function runSeedCli(locale?: SeedLocale) {
  const options = parseArgs(process.argv.slice(2));

  if (options.all) {
    runSeedAll({
      count: options.count,
      days: options.days,
      seed: options.seed,
    });
    return;
  }

  const targetLocale = locale ?? options.lang ?? "en";

  if (!SUPPORTED_SEED_LOCALES.includes(targetLocale)) {
    throw new Error(`Unsupported seed locale: ${targetLocale}`);
  }

  summarizeLocale(targetLocale, {
    count: options.count,
    days: options.days,
    seed: options.seed,
  });
}
