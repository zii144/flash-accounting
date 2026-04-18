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
import { getAll, getFirst, run, transaction, type RunInTransaction } from '@/utils/db';
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

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'error';

type StoredSyncMetadata = {
  hasPendingLocalChanges: boolean;
  lastSyncedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

export interface SyncSnapshot extends StoredSyncMetadata {
  status: SyncStatus;
}

const DEFAULT_SYNC_METADATA: StoredSyncMetadata = {
  hasPendingLocalChanges: false,
  lastSyncedAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
};

const DEFAULT_SYNC_SNAPSHOT: SyncSnapshot = {
  status: 'idle',
  ...DEFAULT_SYNC_METADATA,
};

function buildSyncSnapshot(metadata: StoredSyncMetadata, isSyncBusy: boolean): SyncSnapshot {
  if (isSyncBusy) {
    return { ...metadata, status: 'syncing' };
  }

  if (metadata.hasPendingLocalChanges) {
    return { ...metadata, status: 'pending' };
  }

  if (metadata.lastErrorAt) {
    return { ...metadata, status: 'error' };
  }

  return { ...metadata, status: 'idle' };
}

function getSyncMetadataKeys(uid: string) {
  return {
    pending: `sync:pending_local_changes:${uid}`,
    lastSyncedAt: `sync:last_synced_at:${uid}`,
    lastErrorAt: `sync:last_error_at:${uid}`,
    lastErrorMessage: `sync:last_error_message:${uid}`,
  };
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

async function getMetadataValue(key: string): Promise<string | null> {
  await ensureDatabaseInitialized();
  const result = await getFirst<{ value: string }>('SELECT value FROM db_metadata WHERE key = ?', [key]);
  return result?.value ?? null;
}

async function setMetadataValue(key: string, value: string): Promise<void> {
  await ensureDatabaseInitialized();
  await run('INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)', [key, value]);
}

async function deleteMetadataValue(key: string): Promise<void> {
  await ensureDatabaseInitialized();
  await run('DELETE FROM db_metadata WHERE key = ?', [key]);
}

async function getStoredSyncMetadata(uid: string): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);
  const [pendingValue, lastSyncedAt, lastErrorAt, lastErrorMessage] = await Promise.all([
    getMetadataValue(keys.pending),
    getMetadataValue(keys.lastSyncedAt),
    getMetadataValue(keys.lastErrorAt),
    getMetadataValue(keys.lastErrorMessage),
  ]);

  return {
    hasPendingLocalChanges: pendingValue === 'true',
    lastSyncedAt,
    lastErrorAt,
    lastErrorMessage,
  };
}

async function markPendingLocalChanges(uid: string, error?: unknown): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);
  await setMetadataValue(keys.pending, 'true');

  if (error) {
    await Promise.all([
      setMetadataValue(keys.lastErrorAt, new Date().toISOString()),
      setMetadataValue(
        keys.lastErrorMessage,
        error instanceof Error ? error.message : String(error)
      ),
    ]);
  }

  return await getStoredSyncMetadata(uid);
}

async function markSyncError(uid: string, error: unknown): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);

  await Promise.all([
    setMetadataValue(keys.lastErrorAt, new Date().toISOString()),
    setMetadataValue(keys.lastErrorMessage, error instanceof Error ? error.message : String(error)),
  ]);

  return await getStoredSyncMetadata(uid);
}

async function markSyncSuccess(uid: string): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);

  await Promise.all([
    setMetadataValue(keys.pending, 'false'),
    setMetadataValue(keys.lastSyncedAt, new Date().toISOString()),
    deleteMetadataValue(keys.lastErrorAt),
    deleteMetadataValue(keys.lastErrorMessage),
  ]);

  return await getStoredSyncMetadata(uid);
}

async function markDirectCloudWriteSuccess(uid: string): Promise<StoredSyncMetadata> {
  const currentMetadata = await getStoredSyncMetadata(uid);

  if (currentMetadata.hasPendingLocalChanges) {
    return currentMetadata;
  }

  return await markSyncSuccess(uid);
}

async function replaceCloudWithLocalSnapshot(uid: string): Promise<{ cloudConsumptions: Consumption[]; uploaded: number }> {
  const localConsumptions = await getAllLocalConsumptions();

  await cloudClearAll(uid);
  if (localConsumptions.length > 0) {
    await cloudUpsertMany(uid, localConsumptions);
  }

  const cloudConsumptions = await cloudGetAll(uid);
  await replaceLocalConsumptions(cloudConsumptions);

  return {
    cloudConsumptions,
    uploaded: localConsumptions.length,
  };
}

async function replaceLocalWithCloudSnapshot(uid: string): Promise<Consumption[]> {
  const cloudConsumptions = await cloudGetAll(uid);
  await replaceLocalConsumptions(cloudConsumptions);
  return cloudConsumptions;
}

export function useConsumptionStorage() {
  const { user } = useAuth();
  const { isPro } = usePro();
  const cloudEnabled = Boolean(user?.uid && isPro);

  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [syncSnapshot, setSyncSnapshot] = useState<SyncSnapshot>(DEFAULT_SYNC_SNAPSHOT);
  const [totalCount, setTotalCount] = useState(0);
  const isInitializedRef = useRef(false);
  const initModeRef = useRef<string>('');

  const applyStoredSyncMetadata = useCallback((metadata: StoredSyncMetadata, busy: boolean = false) => {
    const snapshot = buildSyncSnapshot(metadata, busy);
    setSyncSnapshot(snapshot);
    return snapshot;
  }, []);

  const loadSyncSnapshot = useCallback(async () => {
    if (!cloudEnabled || !user?.uid) {
      setSyncSnapshot(DEFAULT_SYNC_SNAPSHOT);
      return DEFAULT_SYNC_SNAPSHOT;
    }

    const metadata = await getStoredSyncMetadata(user.uid);
    return applyStoredSyncMetadata(metadata, isSyncBusy);
  }, [applyStoredSyncMetadata, cloudEnabled, isSyncBusy, user?.uid]);

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
        setIsSyncBusy(true);
        setSyncSnapshot((currentSnapshot) => ({ ...currentSnapshot, status: 'syncing' }));

        const localCount = await getLocalConsumptionCount();
        const currentMetadata = await getStoredSyncMetadata(user.uid);

        if (currentMetadata.hasPendingLocalChanges || (!currentMetadata.lastSyncedAt && localCount > 0)) {
          const nextMetadata = currentMetadata.hasPendingLocalChanges
            ? currentMetadata
            : await markPendingLocalChanges(user.uid);

          setTotalCount(localCount);
          setConsumptions([]);
          applyStoredSyncMetadata(nextMetadata);
        } else {
          const cloudConsumptions = await replaceLocalWithCloudSnapshot(user.uid);
          const nextMetadata = await markSyncSuccess(user.uid);

          setTotalCount(cloudConsumptions.length);
          setConsumptions([]);
          applyStoredSyncMetadata(nextMetadata);
        }
      } else {
        const count = await getLocalConsumptionCount();
        setTotalCount(count);
        setConsumptions([]);
        setSyncSnapshot(DEFAULT_SYNC_SNAPSHOT);
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

      if (cloudEnabled && user?.uid) {
        try {
          const nextMetadata = await markSyncError(user.uid, error);
          applyStoredSyncMetadata(nextMetadata);
        } catch (metadataError) {
          logger.error('Failed to record sync initialization error', metadataError);
        }
      } else {
        setSyncSnapshot(DEFAULT_SYNC_SNAPSHOT);
      }
    } finally {
      setIsLoading(false);
      setIsSyncBusy(false);
      isInitializedRef.current = true;
    }
  }, [applyStoredSyncMetadata, cloudEnabled, user?.uid]);

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
      void initialize();
    }
  }, [cloudEnabled, initialize, user?.uid]);

  useEffect(() => {
    void loadSyncSnapshot();
  }, [loadSyncSnapshot]);

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

      if (cloudEnabled && user?.uid) {
        try {
          await cloudSave(user.uid, consumption);
          const nextMetadata = await markDirectCloudWriteSuccess(user.uid);
          applyStoredSyncMetadata(nextMetadata);
        } catch (error) {
          logger.error('Cloud save failed, keeping local copy pending sync', error, {
            consumptionId: consumption.id,
          });
          const nextMetadata = await markPendingLocalChanges(user.uid, error);
          applyStoredSyncMetadata(nextMetadata);
        }
      }
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
  }, [applyStoredSyncMetadata, cloudEnabled, totalCount, user?.uid]);

  const deleteConsumption = useCallback(async (id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid consumption ID');
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

      if (cloudEnabled && user?.uid) {
        try {
          await cloudDelete(user.uid, id);
          const nextMetadata = await markDirectCloudWriteSuccess(user.uid);
          applyStoredSyncMetadata(nextMetadata);
        } catch (error) {
          logger.error('Cloud delete failed, local delete remains pending sync', error, {
            consumptionId: id,
          });
          const nextMetadata = await markPendingLocalChanges(user.uid, error);
          applyStoredSyncMetadata(nextMetadata);
        }
      }
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
  }, [applyStoredSyncMetadata, cloudEnabled, user?.uid]);

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

      if (cloudEnabled && user?.uid) {
        try {
          await cloudUpdate(user.uid, consumption);
          const nextMetadata = await markDirectCloudWriteSuccess(user.uid);
          applyStoredSyncMetadata(nextMetadata);
        } catch (error) {
          logger.error('Cloud update failed, keeping local edit pending sync', error, {
            consumptionId: consumption.id,
          });
          const nextMetadata = await markPendingLocalChanges(user.uid, error);
          applyStoredSyncMetadata(nextMetadata);
        }
      }
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
  }, [applyStoredSyncMetadata, cloudEnabled, user?.uid]);

  const clearAll = useCallback(async () => {
    try {
      await ensureDatabaseInitialized();
      await run('DELETE FROM consumptions');
      setConsumptions([]);
      setTotalCount(0);

      if (cloudEnabled && user?.uid) {
        try {
          await cloudClearAll(user.uid);
          const nextMetadata = await markSyncSuccess(user.uid);
          applyStoredSyncMetadata(nextMetadata);
        } catch (error) {
          logger.error('Cloud clear failed, keeping local device empty and pending sync', error);
          const nextMetadata = await markPendingLocalChanges(user.uid, error);
          applyStoredSyncMetadata(nextMetadata);
        }
      }
    } catch (error) {
      logger.error('Failed to clear consumptions', error);
      throw error;
    }
  }, [applyStoredSyncMetadata, cloudEnabled, user?.uid]);

  const getAllForExport = useCallback(async (): Promise<Consumption[]> => {
    return await getAllLocalConsumptions();
  }, []);

  const syncLocalToCloud = useCallback(async (): Promise<{ uploaded: number }> => {
    if (!user?.uid || !isPro) {
      throw new AppError('CLOUD_SYNC_NOT_AVAILABLE');
    }

    setIsSyncBusy(true);
    setSyncSnapshot((currentSnapshot) => ({ ...currentSnapshot, status: 'syncing' }));

    try {
      const result = await replaceCloudWithLocalSnapshot(user.uid);
      const nextMetadata = await markSyncSuccess(user.uid);

      setConsumptions([]);
      setTotalCount(result.cloudConsumptions.length);
      applyStoredSyncMetadata(nextMetadata);

      return { uploaded: result.uploaded };
    } catch (error) {
      logger.error('Failed to replace cloud with local snapshot', error);
      const nextMetadata = await markPendingLocalChanges(user.uid, error);
      applyStoredSyncMetadata(nextMetadata);
      throw error;
    } finally {
      setIsSyncBusy(false);
    }
  }, [applyStoredSyncMetadata, isPro, user?.uid]);

  const pullCloudToLocal = useCallback(async (): Promise<{ downloaded: number }> => {
    if (!user?.uid || !isPro) {
      throw new AppError('CLOUD_SYNC_NOT_AVAILABLE');
    }

    setIsSyncBusy(true);
    setSyncSnapshot((currentSnapshot) => ({ ...currentSnapshot, status: 'syncing' }));

    try {
      const cloudConsumptions = await replaceLocalWithCloudSnapshot(user.uid);
      const nextMetadata = await markSyncSuccess(user.uid);

      setConsumptions([]);
      setTotalCount(cloudConsumptions.length);
      applyStoredSyncMetadata(nextMetadata);

      return { downloaded: cloudConsumptions.length };
    } catch (error) {
      logger.error('Failed to replace local snapshot with cloud', error);
      const nextMetadata = await markSyncError(user.uid, error);
      applyStoredSyncMetadata(nextMetadata);
      throw error;
    } finally {
      setIsSyncBusy(false);
    }
  }, [applyStoredSyncMetadata, isPro, user?.uid]);

  return {
    consumptions,
    isLoading,
    isSyncBusy,
    syncSnapshot,
    totalCount,
    saveConsumption,
    updateConsumption,
    deleteConsumption,
    clearAll,
    refresh: loadConsumptions,
    loadPaginated: loadPaginatedConsumptions,
    getAllForExport,
    syncLocalToCloud,
    pullCloudToLocal,
  };
}
