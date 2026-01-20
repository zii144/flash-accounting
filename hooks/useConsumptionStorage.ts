import { Consumption } from '@/types/consumption';
import { getAll, run } from '@/utils/db';
import { initializeDatabase } from '@/utils/db-schema';
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

export function useConsumptionStorage() {
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const isInitializedRef = useRef(false);

  // Load all consumptions (for backward compatibility - used by SettingsModal)
  const loadConsumptions = useCallback(async () => {
    try {
      const results = await getAll<Consumption>(
        'SELECT * FROM consumptions ORDER BY date DESC'
      );
      setConsumptions(results);
      
      // Update total count
      const countResult = await getAll<{ count: number }>(
        'SELECT COUNT(*) as count FROM consumptions'
      );
      setTotalCount(countResult[0]?.count || 0);
    } catch (error) {
      console.error('Failed to load consumptions:', error);
      setConsumptions([]);
      setTotalCount(0);
    }
  }, []);

  // Initialize database - only load count, not all data
  const initialize = useCallback(async () => {
    try {
      await initializeDatabase();
      // Only get the count, don't load all consumptions
      const countResult = await getAll<{ count: number }>(
        'SELECT COUNT(*) as count FROM consumptions'
      );
      setTotalCount(countResult[0]?.count || 0);
      setConsumptions([]); // Start with empty array for pagination
    } catch (error) {
      console.error('Failed to initialize database:', error);
      setConsumptions([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
      isInitializedRef.current = true;
    }
  }, []);

  // Load paginated consumptions
  const loadPaginatedConsumptions = useCallback(
    async (options: PaginationOptions): Promise<PaginatedResult> => {
      try {
        const { page, pageSize, sortBy = 'date', sortOrder = 'DESC' } = options;
        const offset = (page - 1) * pageSize;

        // Build ORDER BY clause
        const orderBy = `${sortBy} ${sortOrder}`;

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
        console.error('Failed to load paginated consumptions:', error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    if (!isInitializedRef.current) {
      initialize();
    }
  }, [initialize]);

  const saveConsumption = useCallback(async (consumption: Consumption) => {
    try {
      // Validate before saving
      if (!consumption.id || !consumption.date) {
        throw new Error('Invalid consumption data: missing required fields');
      }

      if (consumption.amount <= 0 || isNaN(consumption.amount)) {
        throw new Error('Invalid consumption data: amount must be greater than zero');
      }

      await run(
        `INSERT INTO consumptions (id, amount, description, type, category, date) 
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

      // Optimistically update local state
      setConsumptions((prev) => [consumption, ...prev]);
      setTotalCount((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to save consumption:', error);
      // Re-throw with more context
      throw new Error(
        error instanceof Error 
          ? `Failed to save consumption: ${error.message}`
          : 'Failed to save consumption. Please try again.'
      );
    }
  }, []);

  const deleteConsumption = useCallback(async (id: string) => {
    try {
      if (!id) {
        throw new Error('Invalid consumption ID');
      }

      const result = await run('DELETE FROM consumptions WHERE id = ?', [id]);

      // Check if deletion was successful
      if (result.changes === 0) {
        console.warn('No consumption found with ID:', id);
        // Still update state optimistically
      }

      // Optimistically update local state
      setConsumptions((prev) => prev.filter((c) => c.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to delete consumption:', error);
      // Re-throw with more context
      throw new Error(
        error instanceof Error 
          ? `Failed to delete consumption: ${error.message}`
          : 'Failed to delete consumption. Please try again.'
      );
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await run('DELETE FROM consumptions');
      setConsumptions([]);
      setTotalCount(0);
    } catch (error) {
      console.error('Failed to clear consumptions:', error);
      throw error;
    }
  }, []);

  return {
    consumptions,
    isLoading,
    totalCount,
    saveConsumption,
    deleteConsumption,
    clearAll,
    refresh: loadConsumptions,
    loadPaginated: loadPaginatedConsumptions,
  };
}
