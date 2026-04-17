import { Consumption } from '@/types/consumption';
import { useAuth } from '@/contexts/AuthContext';
import { usePro } from '@/contexts/ProContext';
import { AppError } from '@/utils/app-error';
import { FREE_LOCAL_RECORD_LIMIT } from '@/utils/constants';
import {
  cloudClearAll,
  cloudDelete,
  cloudGetAll,
  cloudSave,
  cloudUpdate,
  cloudUpsertMany,
} from '@/utils/cloud/consumptions';
import { getAll, run, transaction, type RunInTransaction } from '@/utils/db';
import { ensureDatabaseInitialized } from '@/utils/db-schema';
import { logger } from '@/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: 'date' | 'amount';
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult {
  data: Consumption[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

async function getAllLocalConsumptions(): Promise<Consumption[]> {
  await ensureDatabaseInitialized();
  return await getAll<Consumption>('SELECT * FROM consumptions ORDER BY date DESC');
}

async function getLocalConsumptionCount(): Promise<number> {
  await ensureDatabaseInitialized();
  const countResult = await getAll<{ count: number }>('SELECT COUNT(*) as count FROM consumptions');
  return countResult[0]?.count || 0;
}

async function upsertLocalConsumption(consumption: Consumption): Promise<void> {
  await ensureDatabaseInitialized();
  await run(
    `INSERT OR REPLACE INTO consumptions (id, amount, description, type, category, date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      consumption.id,
      consumption.amount,
      consumption.description || '',
      consumption.type || 'expense',
      consumption.category || null,
      consumption.date,
    ]
  );
}

async function replaceLocalConsumptions(consumptions: Consumption[]): Promise<void> {
  await ensureDatabaseInitialized();

  const operations = [
    async (runInTransaction: RunInTransaction) => {
      await runInTransaction('DELETE FROM consumptions');
    },
    ...consumptions.map(
      (consumption) => async (runInTransaction: RunInTransaction) => {
          await runInTransaction(
            `INSERT OR REPLACE INTO consumptions (id, amount, description, type, category, date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              consumption.id,
              consumption.amount,
              consumption.description || '',
              consumption.type || 'expense',
              consumption.category || null,
              consumption.date,
            ]
          );
        }
    ),
  ];

  await transaction(operations);
}

export function useConsumptionStorage() {
  const { user } = useAuth();
  const { isPro } = usePro();
  const cloudEnabled = Boolean(user?.uid && isPro);

  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const isInitializedRef = useRef(false);
  const initModeRef = useRef<string>('');

  // Load all consumptions (for backward compatibility - used by SettingsModal)
  const loadConsumptions = useCallback(async () => {
    try {
      const results = await getAllLocalConsumptions();
      setConsumptions(results);
      setTotalCount(results.length);
    } catch (error) {
      logger.error('Failed to load consumptions', error);
      setConsumptions([]);
      setTotalCount(0);
    }
  }, []);

  // Initialize database - only load count, not all data
  const initialize = useCallback(async () => {
    try {
      if (cloudEnabled && user?.uid) {
        const localConsumptions = await getAllLocalConsumptions();

        if (localConsumptions.length > 0) {
          await cloudUpsertMany(user.uid, localConsumptions);
        }

        const cloudConsumptions = await cloudGetAll(user.uid);
        await replaceLocalConsumptions(cloudConsumptions);
        setTotalCount(cloudConsumptions.length);
        setConsumptions([]);
      } else {
        const count = await getLocalConsumptionCount();
        setTotalCount(count);
        setConsumptions([]);
      }
    } catch (error) {
      logger.error('Failed to initialize database', error);
      try {
        const fallbackCount = await getLocalConsumptionCount();
        setTotalCount(fallbackCount);
      } catch {
        setTotalCount(0);
      }
      setConsumptions([]);
    } finally {
      setIsLoading(false);
      isInitializedRef.current = true;
    }
  }, [cloudEnabled, user?.uid]);

  // Load paginated consumptions
  const loadPaginatedConsumptions = useCallback(
    async (options: PaginationOptions): Promise<PaginatedResult> => {
      try {
        await ensureDatabaseInitialized();
        const { page, pageSize, sortBy = 'date', sortOrder = 'DESC' } = options;
        const offset = (page - 1) * pageSize;

        // Validate and sanitize sortBy and sortOrder to prevent SQL injection
        const validSortBy = sortBy === 'date' || sortBy === 'amount' ? sortBy : 'date';
        const validSortOrder = sortOrder === 'ASC' || sortOrder === 'DESC' ? sortOrder : 'DESC';
        const orderBy = `${validSortBy} ${validSortOrder}`;

        // Get paginated data
        const data = await getAll<Consumption>(
          `SELECT * FROM consumptions ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
          [pageSize, offset]
        );

        // Get total count
        const countResult = await getAll<{ count: number }>(
          'SELECT COUNT(*) as count FROM consumptions'
        );
        const total = countResult[0]?.count || 0;

        return {
          data,
          total,
          page,
          pageSize,
          hasMore: offset + data.length < total,
        };
      } catch (error) {
        logger.error('Failed to load paginated consumptions', error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    const nextModeKey = cloudEnabled ? `cloud:${user?.uid ?? ''}` : 'local';
    if (!isInitializedRef.current || initModeRef.current !== nextModeKey) {
      initModeRef.current = nextModeKey;
      isInitializedRef.current = false;
      setIsLoading(true);
      initialize();
    }
  }, [cloudEnabled, initialize, user?.uid]);

  const saveConsumption = useCallback(async (consumption: Consumption) => {
    try {
      // Validate before saving
      if (!consumption.id || !consumption.date) {
        throw new Error('Invalid consumption data: missing required fields');
      }

      if (consumption.amount <= 0 || isNaN(consumption.amount)) {
        throw new AppError('INVALID_CONSUMPTION', 'Invalid consumption data: amount must be greater than zero');
      }

      if (cloudEnabled && user?.uid) {
        await cloudSave(user.uid, consumption);
        await upsertLocalConsumption(consumption);
      } else {
        if (totalCount >= FREE_LOCAL_RECORD_LIMIT) {
          throw new AppError('LOCAL_LIMIT_REACHED');
        }

        await upsertLocalConsumption(consumption);
      }

      // Optimistically update local state
      setConsumptions((prev) => [consumption, ...prev]);
      setTotalCount((prev) => prev + 1);
    } catch (error) {
      logger.error('Failed to save consumption', error, { consumptionId: consumption.id });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'SAVE_CONSUMPTION_FAILED',
        error instanceof Error ? error.message : 'Failed to save consumption. Please try again.',
        { cause: error }
      );
    }
  }, [cloudEnabled, totalCount, user?.uid]);

  const deleteConsumption = useCallback(async (id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid consumption ID');
      }

      if (cloudEnabled && user?.uid) {
        await cloudDelete(user.uid, id);
      }

      await ensureDatabaseInitialized();
      const result = await run('DELETE FROM consumptions WHERE id = ?', [id]);

      if (result.changes === 0) {
        logger.warn('No consumption found with ID', { consumptionId: id });
      } else {
        logger.debug('Successfully deleted consumption', { consumptionId: id, changes: result.changes });
      }

      // Optimistically update local state
      setConsumptions((prev) => prev.filter((c) => c.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logger.error('Failed to delete consumption', error, { consumptionId: id });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'DELETE_CONSUMPTION_FAILED',
        error instanceof Error ? error.message : 'Failed to delete consumption. Please try again.',
        { cause: error }
      );
    }
  }, [cloudEnabled, user?.uid]);

  const updateConsumption = useCallback(async (consumption: Consumption) => {
    try {
      if (!consumption.id) {
        throw new Error('Invalid consumption data: missing ID');
      }

      if (!consumption.date) {
        throw new Error('Invalid consumption data: missing date');
      }

      if (consumption.amount <= 0 || isNaN(consumption.amount)) {
        throw new AppError('INVALID_CONSUMPTION', 'Invalid consumption data: amount must be greater than zero');
      }

      if (cloudEnabled && user?.uid) {
        await cloudUpdate(user.uid, consumption);
      }

      await ensureDatabaseInitialized();
      const result = await run(
        `UPDATE consumptions 
         SET amount = ?, description = ?, type = ?, category = ?, date = ?
         WHERE id = ?`,
        [
          consumption.amount,
          consumption.description || '',
          consumption.type || 'expense',
          consumption.category || null,
          consumption.date,
          consumption.id,
        ]
      );

      if (result.changes === 0) {
        throw new AppError('CONSUMPTION_NOT_FOUND', 'Consumption not found');
      }

      // Optimistically update local state
      setConsumptions((prev) =>
        prev.map((c) => (c.id === consumption.id ? { ...c, ...consumption } : c))
      );
    } catch (error) {
      logger.error('Failed to update consumption', error, { consumptionId: consumption.id });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'UPDATE_CONSUMPTION_FAILED',
        error instanceof Error ? error.message : 'Failed to update consumption. Please try again.',
        { cause: error }
      );
    }
  }, [cloudEnabled, user?.uid]);

  const clearAll = useCallback(async () => {
    try {
      if (cloudEnabled && user?.uid) {
        await cloudClearAll(user.uid);
      }

      await ensureDatabaseInitialized();
      await run('DELETE FROM consumptions');
      setConsumptions([]);
      setTotalCount(0);
    } catch (error) {
      logger.error('Failed to clear consumptions', error);
      throw error;
    }
  }, [cloudEnabled, user?.uid]);

  const getAllForExport = useCallback(async (): Promise<Consumption[]> => {
    return await getAllLocalConsumptions();
  }, []);

  const syncLocalToCloud = useCallback(async (): Promise<{ uploaded: number }> => {
    if (!user?.uid || !isPro) {
      throw new AppError('CLOUD_SYNC_NOT_AVAILABLE');
    }

    const local = await getAllLocalConsumptions();
    await cloudUpsertMany(user.uid, local);
    const cloudConsumptions = await cloudGetAll(user.uid);
    await replaceLocalConsumptions(cloudConsumptions);
    setTotalCount(cloudConsumptions.length);
    return { uploaded: local.length };
  }, [isPro, user?.uid]);

  return {
    consumptions,
    isLoading,
    totalCount,
    saveConsumption,
    updateConsumption,
    deleteConsumption,
    clearAll,
    refresh: loadConsumptions,
    loadPaginated: loadPaginatedConsumptions,
    getAllForExport,
    syncLocalToCloud,
  };
}
