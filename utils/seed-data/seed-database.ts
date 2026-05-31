import type { Consumption } from "@/types/consumption";
import { run, transaction } from "@/utils/db";
import { ensureDatabaseInitialized } from "@/utils/db-schema";
import { generateSeedRecords } from "./generator";
import type { SeedGeneratorOptions, SeedLocale } from "./types";

type SeedDatabaseOptions = SeedGeneratorOptions & {
  replaceExisting?: boolean;
};

async function insertSeedRecords(records: Consumption[]) {
  await transaction(
    records.map((record) => async (runInTransaction) => {
      await runInTransaction(
        `INSERT OR REPLACE INTO consumptions
          (id, amount, description, type, category, date, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.amount,
          record.description,
          record.type,
          record.category ?? null,
          record.date,
          record.createdAt,
          record.updatedAt,
          record.deletedAt ?? null,
        ],
      );
    }),
  );
}

export async function seedDemoExpenses(locale: SeedLocale, options: SeedDatabaseOptions = {}) {
  await ensureDatabaseInitialized();

  if (options.replaceExisting) {
    await run("DELETE FROM consumptions");
  }

  const batch = generateSeedRecords(locale, options);
  await insertSeedRecords(batch.records);

  return batch;
}
