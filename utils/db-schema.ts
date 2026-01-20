import AsyncStorage from '@react-native-async-storage/async-storage';
import { Consumption } from '@/types/consumption';
import { STORAGE_KEYS } from './constants';
import { run, transaction, getFirst } from './db';

const MIGRATION_KEY = '@flash_accounting_db_migrated';

/**
 * Database schema version
 * Increment this when making schema changes
 */
const DB_VERSION = 1;

/**
 * Initializes the database schema
 * Creates tables and indexes if they don't exist
 */
export async function initializeSchema(): Promise<void> {
  // Create consumptions table
  await run(`
    CREATE TABLE IF NOT EXISTS consumptions (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      date TEXT NOT NULL
    )
  `);

  // Create indexes for better query performance
  await run(`
    CREATE INDEX IF NOT EXISTS idx_consumptions_date 
    ON consumptions(date DESC)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_consumptions_amount 
    ON consumptions(amount DESC)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_consumptions_category 
    ON consumptions(category)
  `);

  // Create metadata table for tracking migrations and version
  await run(`
    CREATE TABLE IF NOT EXISTS db_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )
  `);
}

/**
 * Checks if migration from AsyncStorage has been completed
 */
export async function isMigrationCompleted(): Promise<boolean> {
  try {
    const result = await getFirst<{ value: string }>(
      'SELECT value FROM db_metadata WHERE key = ?',
      [MIGRATION_KEY]
    );
    return result?.value === 'true';
  } catch (error) {
    // Table might not exist yet, return false
    return false;
  }
}

/**
 * Marks migration as completed
 */
async function markMigrationCompleted(): Promise<void> {
  await run(
    'INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)',
    [MIGRATION_KEY, 'true']
  );
}

/**
 * Migrates data from AsyncStorage to SQLite
 * Reads all consumptions from AsyncStorage, inserts them into SQLite in a transaction,
 * then clears the old key and sets migration flag
 */
export async function migrateFromAsyncStorage(): Promise<void> {
  // Check if migration already completed
  if (await isMigrationCompleted()) {
    return;
  }

  try {
    // Read data from AsyncStorage
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CONSUMPTIONS);
    
    if (!data) {
      // No data to migrate, just mark as completed
      await markMigrationCompleted();
      return;
    }

    const consumptions: Consumption[] = JSON.parse(data);
    
    if (!Array.isArray(consumptions) || consumptions.length === 0) {
      // Empty or invalid data, mark as completed
      await markMigrationCompleted();
      return;
    }

    // Insert all consumptions in a transaction
    await transaction(
      consumptions.map((consumption) => async () => {
        await run(
          `INSERT INTO consumptions (id, amount, description, category, date) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            consumption.id,
            consumption.amount,
            consumption.description,
            consumption.category || null,
            consumption.date,
          ]
        );
      })
    );

    // Clear old AsyncStorage key
    await AsyncStorage.removeItem(STORAGE_KEYS.CONSUMPTIONS);

    // Mark migration as completed
    await markMigrationCompleted();

    console.log(`Migrated ${consumptions.length} consumptions from AsyncStorage to SQLite`);
  } catch (error) {
    console.error('Migration failed:', error);
    // Don't throw - allow app to continue even if migration fails
    // Migration will be retried on next app start
  }
}

/**
 * Initializes the database and runs migrations
 * Should be called once when the app starts
 */
export async function initializeDatabase(): Promise<void> {
  await initializeSchema();
  await migrateFromAsyncStorage();
}
