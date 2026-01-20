import * as SQLite from 'expo-sqlite';

/**
 * Database utilities for SQLite operations
 * Following React Native + Expo best practices
 */

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens the database connection
 * Returns the same instance if already open (singleton pattern)
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync('flash_accounting.db');
  return db;
}

/**
 * Executes a SQL query that doesn't return results (INSERT, UPDATE, DELETE, CREATE, etc.)
 * @param sql SQL query string
 * @param params Optional parameters for prepared statements
 */
export async function run(
  sql: string,
  params: (string | number | null)[] = []
): Promise<SQLite.SQLiteRunResult> {
  const database = await openDatabase();
  return await database.runAsync(sql, params);
}

/**
 * Executes a SQL query and returns all results
 * @param sql SQL query string
 * @param params Optional parameters for prepared statements
 */
export async function getAll<T = any>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  const database = await openDatabase();
  return await database.getAllAsync<T>(sql, params);
}

/**
 * Executes a SQL query and returns the first result
 * @param sql SQL query string
 * @param params Optional parameters for prepared statements
 */
export async function getFirst<T = any>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T | null> {
  const database = await openDatabase();
  const results = await database.getAllAsync<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Executes multiple SQL operations in a transaction
 * If any operation fails, all changes are rolled back
 * @param operations Array of operations to execute, each returning a promise
 */
export async function transaction(
  operations: (() => Promise<void>)[]
): Promise<void> {
  const database = await openDatabase();
  
  await database.withTransactionAsync(async () => {
    for (const operation of operations) {
      await operation();
    }
  });
}

/**
 * Closes the database connection
 * Useful for cleanup or testing
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
