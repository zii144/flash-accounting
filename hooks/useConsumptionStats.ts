import { getAll } from '@/utils/db';
import { TimeFilter } from '@/utils/constants';

export interface ConsumptionStats {
  total: number;
  count: number;
  logDay: number;
}

export interface GroupedConsumption {
  date: string;
  consumptions: Array<{
    id: string;
    amount: number;
    description: string;
    category?: string;
    date: string;
  }>;
  total: number;
}

/**
 * Hook for optimized statistics queries using SQL
 */
export function useConsumptionStats() {
  /**
   * Get total amount and count for filtered consumptions
   */
  const getStats = async (timeFilter: TimeFilter = 'all'): Promise<ConsumptionStats> => {
    try {
      const [whereClause, params] = buildTimeFilterClause(timeFilter);
      
      // Get total amount and count in a single query
      const result = await getAll<{ total: number; count: number }>(
        `SELECT 
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as count
         FROM consumptions
         ${whereClause}`,
        params
      );

      const stats = result[0] || { total: 0, count: 0 };

      // Calculate log day (days since first entry)
      const firstDateResult = await getAll<{ min_date: string }>(
        `SELECT MIN(date) as min_date FROM consumptions`
      );
      
      let logDay = 0;
      if (firstDateResult[0]?.min_date) {
        const firstDate = new Date(firstDateResult[0].min_date).setHours(0, 0, 0, 0);
        const today = new Date().setHours(0, 0, 0, 0);
        const diffTime = today - firstDate;
        logDay = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      }

      return {
        total: stats.total || 0,
        count: stats.count || 0,
        logDay,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { total: 0, count: 0, logDay: 0 };
    }
  };

  /**
   * Get consumptions grouped by day
   */
  const getGroupedByDay = async (
    timeFilter: TimeFilter = 'all',
    sortBy: 'date' | 'amount' = 'date',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<GroupedConsumption[]> => {
    try {
      const [whereClause, params] = buildTimeFilterClause(timeFilter);
      
      // Always sort by date first for grouping, then by the selected field
      const orderBy = sortBy === 'date' 
        ? `date ${sortOrder}`
        : `date DESC, amount ${sortOrder}`;
      
      const results = await getAll<{
        date: string;
        id: string;
        amount: number;
        description: string;
        category: string | null;
        date_full: string;
      }>(
        `SELECT 
          DATE(date) as date,
          id,
          amount,
          description,
          category,
          date as date_full
         FROM consumptions
         ${whereClause}
         ORDER BY ${orderBy}`,
        params
      );

      // Group by date
      const grouped: { [key: string]: GroupedConsumption } = {};
      
      results.forEach((row) => {
        const dateKey = row.date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            consumptions: [],
            total: 0,
          };
        }
        
        grouped[dateKey].consumptions.push({
          id: row.id,
          amount: row.amount,
          description: row.description,
          category: row.category || undefined,
          date: row.date_full,
        });
        
        grouped[dateKey].total += row.amount;
      });

      // Sort groups by date, and items within groups by the selected criteria
      return Object.values(grouped)
        .map((group) => {
          // Sort items within group if sorting by amount
          if (sortBy === 'amount') {
            group.consumptions.sort((a, b) => {
              return sortOrder === 'DESC' ? b.amount - a.amount : a.amount - b.amount;
            });
          }
          return group;
        })
        .sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return sortOrder === 'DESC' ? dateB - dateA : dateA - dateB;
        });
    } catch (error) {
      console.error('Failed to get grouped by day:', error);
      return [];
    }
  };

  /**
   * Get consumptions grouped by month
   */
  const getGroupedByMonth = async (
    timeFilter: TimeFilter = 'all',
    sortBy: 'date' | 'amount' = 'date',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<GroupedConsumption[]> => {
    try {
      const [whereClause, params] = buildTimeFilterClause(timeFilter);
      
      // Always sort by date first for grouping, then by the selected field
      const orderBy = sortBy === 'date' 
        ? `date ${sortOrder}`
        : `date DESC, amount ${sortOrder}`;
      
      const results = await getAll<{
        year_month: string;
        id: string;
        amount: number;
        description: string;
        category: string | null;
        date_full: string;
      }>(
        `SELECT 
          strftime('%Y-%m', date) as year_month,
          id,
          amount,
          description,
          category,
          date as date_full
         FROM consumptions
         ${whereClause}
         ORDER BY ${orderBy}`,
        params
      );

      // Group by month
      const grouped: { [key: string]: GroupedConsumption } = {};
      
      results.forEach((row) => {
        const monthKey = row.year_month;
        if (!grouped[monthKey]) {
          grouped[monthKey] = {
            date: monthKey,
            consumptions: [],
            total: 0,
          };
        }
        
        grouped[monthKey].consumptions.push({
          id: row.id,
          amount: row.amount,
          description: row.description,
          category: row.category || undefined,
          date: row.date_full,
        });
        
        grouped[monthKey].total += row.amount;
      });

      // Sort groups by date, and items within groups by the selected criteria
      return Object.values(grouped)
        .map((group) => {
          // Sort items within group if sorting by amount
          if (sortBy === 'amount') {
            group.consumptions.sort((a, b) => {
              return sortOrder === 'DESC' ? b.amount - a.amount : a.amount - b.amount;
            });
          }
          return group;
        })
        .sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return sortOrder === 'DESC' ? dateB - dateA : dateA - dateB;
        });
    } catch (error) {
      console.error('Failed to get grouped by month:', error);
      return [];
    }
  };

  /**
   * Get filtered consumptions with sorting
   */
  const getFilteredConsumptions = async (
    timeFilter: TimeFilter = 'all',
    sortBy: 'date' | 'amount' = 'date',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ) => {
    try {
      const [whereClause, params] = buildTimeFilterClause(timeFilter);
      
      return await getAll<{
        id: string;
        amount: number;
        description: string;
        category: string | null;
        date: string;
      }>(
        `SELECT * FROM consumptions
         ${whereClause}
         ORDER BY ${sortBy} ${sortOrder}`,
        params
      );
    } catch (error) {
      console.error('Failed to get filtered consumptions:', error);
      return [];
    }
  };

  return {
    getStats,
    getGroupedByDay,
    getGroupedByMonth,
    getFilteredConsumptions,
  };
}

/**
 * Builds WHERE clause for time filtering
 * Returns tuple of [WHERE clause, params array]
 */
function buildTimeFilterClause(timeFilter: TimeFilter): [string, (string | number)[]] {
  const now = new Date();
  
  switch (timeFilter) {
    case 'today': {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return [
        `WHERE date >= ? AND date <= ?`,
        [todayStart.toISOString(), todayEnd.toISOString()]
      ];
    }
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return [
        `WHERE date >= ?`,
        [weekAgo.toISOString()]
      ];
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return [
        `WHERE date >= ?`,
        [monthStart.toISOString()]
      ];
    }
    case 'year': {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return [
        `WHERE date >= ?`,
        [yearStart.toISOString()]
      ];
    }
    default:
      return ['', []];
  }
}
