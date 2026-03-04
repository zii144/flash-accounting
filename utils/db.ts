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
 * Type for the run function passed to transaction operations.
 * Use this instead of the global run() to ensure queries execute within the transaction.
 */
export type RunInTransaction = (
  sql: string,
  params?: (string | number | null)[]
) => Promise<SQLite.SQLiteRunResult>;

/**
 * Executes multiple SQL operations in a transaction
 * If any operation fails, all changes are rolled back.
 * Uses withExclusiveTransactionAsync on native (Android, iOS) for proper locking and error handling.
 * Falls back to withTransactionAsync on web where exclusive transactions aren't supported.
 *
 * @param operations Array of operations that receive runInTransaction - use it for all DB writes
 */
export async function transaction(
  operations: ((runInTransaction: RunInTransaction) => Promise<void>)[]
): Promise<void> {
  const database = await openDatabase();

  // withExclusiveTransactionAsync is not supported on web - it properly handles
  // constraint violations and avoids database lock issues on native
  if (
    typeof (database as SQLite.SQLiteDatabase & { withExclusiveTransactionAsync?: unknown })
      .withExclusiveTransactionAsync === 'function'
  ) {
    await (
      database as SQLite.SQLiteDatabase & {
        withExclusiveTransactionAsync: (
          task: (txn: { runAsync: SQLite.SQLiteDatabase['runAsync'] }) => Promise<void>
        ) => Promise<void>;
      }
    ).withExclusiveTransactionAsync(async (txn) => {
      const runInTransaction: RunInTransaction = (sql, params = []) =>
        txn.runAsync(sql, params);
      for (const operation of operations) {
        await operation(runInTransaction);
      }
    });
  } else {
    // Web fallback
    await database.withTransactionAsync(async () => {
      const runInTransaction: RunInTransaction = (sql, params = []) =>
        database.runAsync(sql, params);
      for (const operation of operations) {
        await operation(runInTransaction);
      }
    });
  }
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
