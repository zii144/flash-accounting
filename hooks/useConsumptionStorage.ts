import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePro } from "@/contexts/ProContext";
import type { Consumption } from "@/types/consumption";
import { AppError } from "@/utils/app-error";
import { normalizeConsumptionRecord, markConsumptionDeleted } from "@/utils/consumption-record";
import { FREE_LOCAL_RECORD_LIMIT } from "@/utils/constants";
import {
  cloudGetSnapshot,
  cloudSave,
} from "@/utils/cloud/consumptions";
import { getAll, getFirst, run, transaction, type RunInTransaction } from "@/utils/db";
import { ensureDatabaseInitialized } from "@/utils/db-schema";
import { getActiveConsumptions, buildCloudSyncPlan, mergeConsumptionSnapshots } from "@/utils/sync";
import { logger } from "@/utils/logger";

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: "date" | "amount";
  sortOrder?: "ASC" | "DESC";
}

export interface PaginatedResult {
  data: Consumption[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type SyncStatus = "idle" | "syncing" | "pending" | "error";

type StoredSyncMetadata = {
  hasPendingLocalChanges: boolean;
  lastSyncedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

export interface SyncSnapshot extends StoredSyncMetadata {
  status: SyncStatus;
}

type SyncQueueItem = {
  id: number;
  uid: string;
  consumptionId: string;
  consumption: Consumption;
  createdAt: string;
};

type ConsumptionStorageValue = {
  consumptions: Consumption[];
  isLoading: boolean;
  isSyncBusy: boolean;
  syncSnapshot: SyncSnapshot;
  totalCount: number;
  saveConsumption: (consumption: Consumption) => Promise<void>;
  updateConsumption: (consumption: Consumption) => Promise<void>;
  deleteConsumption: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  loadPaginated: (options: PaginationOptions) => Promise<PaginatedResult>;
  getAllForExport: () => Promise<Consumption[]>;
  syncLocalToCloud: () => Promise<{ uploaded: number }>;
  pullCloudToLocal: () => Promise<{ downloaded: number }>;
};

const DEFAULT_SYNC_METADATA: StoredSyncMetadata = {
  hasPendingLocalChanges: false,
  lastSyncedAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
};

const DEFAULT_SYNC_SNAPSHOT: SyncSnapshot = {
  status: "idle",
  ...DEFAULT_SYNC_METADATA,
};

const ConsumptionStorageContext = createContext<ConsumptionStorageValue | null>(null);

function buildSyncSnapshot(metadata: StoredSyncMetadata, isSyncBusy: boolean): SyncSnapshot {
  if (isSyncBusy) {
    return { ...metadata, status: "syncing" };
  }

  if (metadata.hasPendingLocalChanges) {
    return { ...metadata, status: "pending" };
  }

  if (metadata.lastErrorAt) {
    return { ...metadata, status: "error" };
  }

  return { ...metadata, status: "idle" };
}

function getSyncMetadataKeys(uid: string) {
  return {
    pending: `sync:pending_local_changes:${uid}`,
    lastSyncedAt: `sync:last_synced_at:${uid}`,
    lastErrorAt: `sync:last_error_at:${uid}`,
    lastErrorMessage: `sync:last_error_message:${uid}`,
  };
}

async function getAllLocalSnapshot(): Promise<Consumption[]> {
  await ensureDatabaseInitialized();
  const rows = await getAll<Consumption>(
    "SELECT * FROM consumptions ORDER BY COALESCE(updatedAt, date) DESC, date DESC"
  );
  return rows.map((row) => normalizeConsumptionRecord(row));
}

async function getAllLocalConsumptions(): Promise<Consumption[]> {
  return getActiveConsumptions(await getAllLocalSnapshot());
}

async function getLocalConsumptionCount(): Promise<number> {
  await ensureDatabaseInitialized();
  const countResult = await getAll<{ count: number }>(
    "SELECT COUNT(*) as count FROM consumptions WHERE deletedAt IS NULL"
  );
  return countResult[0]?.count || 0;
}

async function getLocalConsumptionById(id: string): Promise<Consumption | null> {
  await ensureDatabaseInitialized();
  const result = await getFirst<Consumption>("SELECT * FROM consumptions WHERE id = ?", [id]);
  return result ? normalizeConsumptionRecord(result) : null;
}

async function upsertLocalConsumption(
  consumption: Consumption,
  runInTransaction?: RunInTransaction
): Promise<void> {
  const normalized = normalizeConsumptionRecord(consumption);
  const execute = runInTransaction ?? run;

  await execute(
    `INSERT OR REPLACE INTO consumptions
      (id, amount, description, type, category, date, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalized.id,
      normalized.amount,
      normalized.description,
      normalized.type,
      normalized.category ?? null,
      normalized.date,
      normalized.createdAt,
      normalized.updatedAt,
      normalized.deletedAt ?? null,
    ]
  );
}

async function replaceLocalSnapshot(consumptions: Consumption[]): Promise<void> {
  await ensureDatabaseInitialized();

  const operations = [
    async (runInTransaction: RunInTransaction) => {
      await runInTransaction("DELETE FROM consumptions");
    },
    ...consumptions.map(
      (consumption) => async (runInTransaction: RunInTransaction) => {
        await upsertLocalConsumption(consumption, runInTransaction);
      }
    ),
  ];

  await transaction(operations);
}

async function getMetadataValue(key: string): Promise<string | null> {
  await ensureDatabaseInitialized();
  const result = await getFirst<{ value: string }>("SELECT value FROM db_metadata WHERE key = ?", [
    key,
  ]);
  return result?.value ?? null;
}

async function setMetadataValue(key: string, value: string): Promise<void> {
  await ensureDatabaseInitialized();
  await run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)", [key, value]);
}

async function deleteMetadataValue(key: string): Promise<void> {
  await ensureDatabaseInitialized();
  await run("DELETE FROM db_metadata WHERE key = ?", [key]);
}

async function countQueuedSyncItems(uid: string): Promise<number> {
  await ensureDatabaseInitialized();
  const result = await getAll<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE uid = ?",
    [uid]
  );
  return result[0]?.count || 0;
}

async function getStoredSyncMetadata(uid: string): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);
  const [queueCount, pendingValue, lastSyncedAt, lastErrorAt, lastErrorMessage] = await Promise.all([
    countQueuedSyncItems(uid),
    getMetadataValue(keys.pending),
    getMetadataValue(keys.lastSyncedAt),
    getMetadataValue(keys.lastErrorAt),
    getMetadataValue(keys.lastErrorMessage),
  ]);

  return {
    hasPendingLocalChanges: queueCount > 0 || pendingValue === "true",
    lastSyncedAt,
    lastErrorAt,
    lastErrorMessage,
  };
}

async function markPendingLocalChanges(uid: string, error?: unknown): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);
  await setMetadataValue(keys.pending, "true");

  if (error) {
    await Promise.all([
      setMetadataValue(keys.lastErrorAt, new Date().toISOString()),
      setMetadataValue(keys.lastErrorMessage, error instanceof Error ? error.message : String(error)),
    ]);
  }

  return getStoredSyncMetadata(uid);
}

async function markSyncError(uid: string, error: unknown): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);

  await Promise.all([
    setMetadataValue(keys.lastErrorAt, new Date().toISOString()),
    setMetadataValue(keys.lastErrorMessage, error instanceof Error ? error.message : String(error)),
  ]);

  return getStoredSyncMetadata(uid);
}

async function markSyncSuccess(uid: string): Promise<StoredSyncMetadata> {
  const keys = getSyncMetadataKeys(uid);

  await Promise.all([
    setMetadataValue(keys.pending, "false"),
    setMetadataValue(keys.lastSyncedAt, new Date().toISOString()),
    deleteMetadataValue(keys.lastErrorAt),
    deleteMetadataValue(keys.lastErrorMessage),
  ]);

  return getStoredSyncMetadata(uid);
}

async function queueSyncConsumption(uid: string, consumption: Consumption): Promise<void> {
  const queuedAt = new Date().toISOString();
  const payload = JSON.stringify(normalizeConsumptionRecord(consumption));

  await run(
    `INSERT INTO sync_queue (uid, consumptionId, payload, createdAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(uid, consumptionId)
     DO UPDATE SET payload = excluded.payload, createdAt = excluded.createdAt`,
    [uid, consumption.id, payload, queuedAt]
  );
}

async function getQueuedSyncItems(uid: string): Promise<SyncQueueItem[]> {
  await ensureDatabaseInitialized();
  const rows = await getAll<{
    id: number;
    uid: string;
    consumptionId: string;
    payload: string;
    createdAt: string;
  }>(
    "SELECT id, uid, consumptionId, payload, createdAt FROM sync_queue WHERE uid = ? ORDER BY createdAt ASC, id ASC",
    [uid]
  );

  return rows.map((row) => ({
    id: row.id,
    uid: row.uid,
    consumptionId: row.consumptionId,
    consumption: normalizeConsumptionRecord(JSON.parse(row.payload) as Consumption),
    createdAt: row.createdAt,
  }));
}

async function clearQueuedSyncItems(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) {
    return;
  }

  await transaction(
    itemIds.map((itemId) => async (runInTransaction) => {
      await runInTransaction("DELETE FROM sync_queue WHERE id = ?", [itemId]);
    })
  );
}

async function clearSyncQueue(uid: string): Promise<void> {
  await run("DELETE FROM sync_queue WHERE uid = ?", [uid]);
}

async function processPendingCloudSync(uid: string): Promise<{ processed: number }> {
  const queuedItems = await getQueuedSyncItems(uid);
  if (queuedItems.length === 0) {
    return { processed: 0 };
  }

  const processedItemIds: number[] = [];

  try {
    for (const item of queuedItems) {
      await cloudSave(uid, item.consumption);
      processedItemIds.push(item.id);
    }
  } catch (error) {
    if (processedItemIds.length > 0) {
      await clearQueuedSyncItems(processedItemIds);
    }
    throw error;
  }

  await clearQueuedSyncItems(processedItemIds);
  return { processed: processedItemIds.length };
}

function useConsumptionStorageController(): ConsumptionStorageValue {
  const { user } = useAuth();
  const { isPro } = usePro();
  const cloudEnabled = Boolean(user?.uid && isPro);

  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [syncSnapshot, setSyncSnapshot] = useState<SyncSnapshot>(DEFAULT_SYNC_SNAPSHOT);
  const [totalCount, setTotalCount] = useState(0);
  const isInitializedRef = useRef(false);
  const initModeRef = useRef<string>("");
  const syncInFlightRef = useRef<Promise<{ processed: number; activeCount: number }> | null>(null);

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

  const refreshLocalState = useCallback(async () => {
    const activeConsumptions = await getAllLocalConsumptions();
    setConsumptions(activeConsumptions);
    setTotalCount(activeConsumptions.length);
    return activeConsumptions;
  }, []);

  const synchronizeCloudState = useCallback(
    async (uid: string, options?: { discardLocalPendingChanges?: boolean }) => {
      if (syncInFlightRef.current && !options?.discardLocalPendingChanges) {
        return syncInFlightRef.current;
      }

      const task = (async () => {
        setIsSyncBusy(true);
        setSyncSnapshot((currentSnapshot) => ({ ...currentSnapshot, status: "syncing" }));

        try {
          let activeConsumptions: Consumption[] = [];
          let processed = 0;

          if (options?.discardLocalPendingChanges) {
            const cloudSnapshot = await cloudGetSnapshot(uid);
            await replaceLocalSnapshot(cloudSnapshot);
            await clearSyncQueue(uid);
            activeConsumptions = getActiveConsumptions(cloudSnapshot);
          } else {
            const [localSnapshot, cloudSnapshot] = await Promise.all([
              getAllLocalSnapshot(),
              cloudGetSnapshot(uid),
            ]);

            const mergedSnapshot = mergeConsumptionSnapshots(localSnapshot, cloudSnapshot);
            await replaceLocalSnapshot(mergedSnapshot);

            const syncPlan = buildCloudSyncPlan(mergedSnapshot, cloudSnapshot);
            for (const record of syncPlan) {
              await queueSyncConsumption(uid, record);
            }

            const syncResult = await processPendingCloudSync(uid);
            processed = syncResult.processed;
            activeConsumptions = getActiveConsumptions(mergedSnapshot);
          }

          setConsumptions(activeConsumptions);
          setTotalCount(activeConsumptions.length);

          const nextMetadata = await markSyncSuccess(uid);
          applyStoredSyncMetadata(nextMetadata);

          return {
            processed,
            activeCount: activeConsumptions.length,
          };
        } catch (error) {
          logger.error("Failed to synchronize cloud state", error, { uid });
          const nextMetadata = await markSyncError(uid, error);
          applyStoredSyncMetadata(nextMetadata);
          throw error;
        } finally {
          setIsSyncBusy(false);
          syncInFlightRef.current = null;
        }
      })();

      syncInFlightRef.current = task;
      return task;
    },
    [applyStoredSyncMetadata]
  );

  const loadConsumptions = useCallback(async () => {
    try {
      await refreshLocalState();
    } catch (error) {
      logger.error("Failed to load consumptions", error);
      setConsumptions([]);
      setTotalCount(0);
    }
  }, [refreshLocalState]);

  const initialize = useCallback(async () => {
    try {
      await ensureDatabaseInitialized();

      if (cloudEnabled && user?.uid) {
        await synchronizeCloudState(user.uid);
      } else {
        await refreshLocalState();
        setSyncSnapshot(DEFAULT_SYNC_SNAPSHOT);
      }
    } catch (error) {
      logger.error("Failed to initialize database", error);
      try {
        await refreshLocalState();
      } catch {
        setConsumptions([]);
        setTotalCount(0);
      }

      if (cloudEnabled && user?.uid) {
        try {
          const nextMetadata = await markSyncError(user.uid, error);
          applyStoredSyncMetadata(nextMetadata);
        } catch (metadataError) {
          logger.error("Failed to record sync initialization error", metadataError);
        }
      } else {
        setSyncSnapshot(DEFAULT_SYNC_SNAPSHOT);
      }
    } finally {
      setIsLoading(false);
      isInitializedRef.current = true;
    }
  }, [applyStoredSyncMetadata, cloudEnabled, refreshLocalState, synchronizeCloudState, user?.uid]);

  const loadPaginatedConsumptions = useCallback(
    async (options: PaginationOptions): Promise<PaginatedResult> => {
      try {
        await ensureDatabaseInitialized();
        const { page, pageSize, sortBy = "date", sortOrder = "DESC" } = options;
        const offset = (page - 1) * pageSize;

        const validSortBy = sortBy === "date" || sortBy === "amount" ? sortBy : "date";
        const validSortOrder = sortOrder === "ASC" || sortOrder === "DESC" ? sortOrder : "DESC";
        const orderBy = `${validSortBy} ${validSortOrder}`;

        const data = await getAll<Consumption>(
          `SELECT * FROM consumptions
           WHERE deletedAt IS NULL
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`,
          [pageSize, offset]
        );

        const total = await getLocalConsumptionCount();

        return {
          data: data.map((row) => normalizeConsumptionRecord(row)),
          total,
          page,
          pageSize,
          hasMore: offset + data.length < total,
        };
      } catch (error) {
        logger.error("Failed to load paginated consumptions", error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    const nextModeKey = cloudEnabled ? `cloud:${user?.uid ?? ""}` : "local";
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

  const attemptBackgroundSync = useCallback(
    async (uid: string) => {
      try {
        const syncResult = await synchronizeCloudState(uid);
        if (syncResult.processed > 0) {
          logger.info("Processed queued cloud sync operations", { processed: syncResult.processed });
        }
      } catch (error) {
        logger.error("Background cloud sync failed", error, { uid });
      }
    },
    [synchronizeCloudState]
  );

  const saveConsumption = useCallback(
    async (consumption: Consumption) => {
      try {
        if (!consumption.id || !consumption.date) {
          throw new Error("Invalid consumption data: missing required fields");
        }

        if (consumption.amount <= 0 || Number.isNaN(consumption.amount)) {
          throw new AppError(
            "INVALID_CONSUMPTION",
            "Invalid consumption data: amount must be greater than zero"
          );
        }

        const timestamp = new Date().toISOString();
        const normalized = normalizeConsumptionRecord({
          ...consumption,
          createdAt: consumption.createdAt ?? timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        });

        if (!cloudEnabled && totalCount >= FREE_LOCAL_RECORD_LIMIT) {
          throw new AppError("LOCAL_LIMIT_REACHED");
        }

        await upsertLocalConsumption(normalized);

        setConsumptions((prev) =>
          getActiveConsumptions([normalized, ...prev.filter((item) => item.id !== normalized.id)])
        );
        setTotalCount((prev) => prev + 1);

        if (cloudEnabled && user?.uid) {
          await queueSyncConsumption(user.uid, normalized);
          const nextMetadata = await markPendingLocalChanges(user.uid);
          applyStoredSyncMetadata(nextMetadata);
          void attemptBackgroundSync(user.uid);
        }
      } catch (error) {
        logger.error("Failed to save consumption", error, { consumptionId: consumption.id });
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(
          "SAVE_CONSUMPTION_FAILED",
          error instanceof Error ? error.message : "Failed to save consumption. Please try again.",
          { cause: error }
        );
      }
    },
    [applyStoredSyncMetadata, attemptBackgroundSync, cloudEnabled, totalCount, user?.uid]
  );

  const deleteConsumption = useCallback(
    async (id: string) => {
      try {
        if (!id || typeof id !== "string") {
          throw new Error("Invalid consumption ID");
        }

        await ensureDatabaseInitialized();
        const existing = await getLocalConsumptionById(id);

        if (!existing || existing.deletedAt) {
          throw new AppError("CONSUMPTION_NOT_FOUND", "Consumption not found");
        }

        if (cloudEnabled && user?.uid) {
          const timestamp = new Date().toISOString();
          const deletedRecord = markConsumptionDeleted(existing, timestamp);
          await upsertLocalConsumption(deletedRecord);
          await queueSyncConsumption(user.uid, deletedRecord);
          const nextMetadata = await markPendingLocalChanges(user.uid);
          applyStoredSyncMetadata(nextMetadata);
          void attemptBackgroundSync(user.uid);
        } else {
          await run("DELETE FROM consumptions WHERE id = ?", [id]);
        }

        setConsumptions((prev) => prev.filter((consumption) => consumption.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        logger.error("Failed to delete consumption", error, { consumptionId: id });
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(
          "DELETE_CONSUMPTION_FAILED",
          error instanceof Error ? error.message : "Failed to delete consumption. Please try again.",
          { cause: error }
        );
      }
    },
    [applyStoredSyncMetadata, attemptBackgroundSync, cloudEnabled, user?.uid]
  );

  const updateConsumption = useCallback(
    async (consumption: Consumption) => {
      try {
        if (!consumption.id || !consumption.date) {
          throw new Error("Invalid consumption data: missing required fields");
        }

        if (consumption.amount <= 0 || Number.isNaN(consumption.amount)) {
          throw new AppError(
            "INVALID_CONSUMPTION",
            "Invalid consumption data: amount must be greater than zero"
          );
        }

        const existing = await getLocalConsumptionById(consumption.id);
        if (!existing || existing.deletedAt) {
          throw new AppError("CONSUMPTION_NOT_FOUND", "Consumption not found");
        }

        const normalized = normalizeConsumptionRecord({
          ...consumption,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        });

        await upsertLocalConsumption(normalized);

        setConsumptions((prev) =>
          getActiveConsumptions(
            prev.map((item) => (item.id === normalized.id ? normalized : item))
          )
        );

        if (cloudEnabled && user?.uid) {
          await queueSyncConsumption(user.uid, normalized);
          const nextMetadata = await markPendingLocalChanges(user.uid);
          applyStoredSyncMetadata(nextMetadata);
          void attemptBackgroundSync(user.uid);
        }
      } catch (error) {
        logger.error("Failed to update consumption", error, { consumptionId: consumption.id });
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(
          "UPDATE_CONSUMPTION_FAILED",
          error instanceof Error ? error.message : "Failed to update consumption. Please try again.",
          { cause: error }
        );
      }
    },
    [applyStoredSyncMetadata, attemptBackgroundSync, cloudEnabled, user?.uid]
  );

  const clearAll = useCallback(async () => {
    try {
      await ensureDatabaseInitialized();

      if (cloudEnabled && user?.uid) {
        const activeConsumptions = await getAllLocalConsumptions();
        const deletedAt = new Date().toISOString();

        await transaction(
          activeConsumptions.map((consumption) => async (runInTransaction) => {
            await upsertLocalConsumption(markConsumptionDeleted(consumption, deletedAt), runInTransaction);
          })
        );

        for (const consumption of activeConsumptions) {
          await queueSyncConsumption(user.uid, markConsumptionDeleted(consumption, deletedAt));
        }

        const nextMetadata = await markPendingLocalChanges(user.uid);
        applyStoredSyncMetadata(nextMetadata);
        void attemptBackgroundSync(user.uid);
      } else {
        await run("DELETE FROM consumptions");
      }

      setConsumptions([]);
      setTotalCount(0);
    } catch (error) {
      logger.error("Failed to clear consumptions", error);
      throw error;
    }
  }, [applyStoredSyncMetadata, attemptBackgroundSync, cloudEnabled, user?.uid]);

  const getAllForExport = useCallback(async (): Promise<Consumption[]> => {
    return getAllLocalConsumptions();
  }, []);

  const syncLocalToCloud = useCallback(async (): Promise<{ uploaded: number }> => {
    if (!user?.uid || !isPro) {
      throw new AppError("CLOUD_SYNC_NOT_AVAILABLE");
    }

    const result = await synchronizeCloudState(user.uid);
    return { uploaded: result.processed };
  }, [isPro, synchronizeCloudState, user?.uid]);

  const pullCloudToLocal = useCallback(async (): Promise<{ downloaded: number }> => {
    if (!user?.uid || !isPro) {
      throw new AppError("CLOUD_SYNC_NOT_AVAILABLE");
    }

    const result = await synchronizeCloudState(user.uid, {
      discardLocalPendingChanges: true,
    });

    return { downloaded: result.activeCount };
  }, [isPro, synchronizeCloudState, user?.uid]);

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

export function ConsumptionStorageProvider({ children }: { children: React.ReactNode }) {
  const value = useConsumptionStorageController();
  return React.createElement(ConsumptionStorageContext.Provider, { value }, children);
}

export function useConsumptionStorage(): ConsumptionStorageValue {
  const context = useContext(ConsumptionStorageContext);
  if (!context) {
    throw new Error("useConsumptionStorage must be used within ConsumptionStorageProvider");
  }
  return context;
}
