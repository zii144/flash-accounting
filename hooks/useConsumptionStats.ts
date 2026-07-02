import { useCallback } from "react";
import type { Consumption } from "@/types/consumption";
import { TimeFilter } from "@/utils/constants";
import { normalizeConsumptionRecord } from "@/utils/consumption-record";
import {
  compareCalendarKeys,
  getCustomRangeBounds,
  getLocalDaySqlExpression,
  getLocalMonthSqlExpression,
} from "@/utils/date-utils";
import { getAll } from "@/utils/db";
import { ensureDatabaseInitialized } from "@/utils/db-schema";
import { getSignedAmount } from "@/utils/ledger";
import { logger } from "@/utils/logger";

export interface ConsumptionStats {
  total: number;
  expenseTotal: number;
  incomeTotal: number;
  netTotal: number;
  count: number;
  expenseCount: number;
  incomeCount: number;
  logDay: number;
}

export interface GroupedConsumption {
  date: string;
  consumptions: Consumption[];
  total: number;
}

export interface PaginatedGroupedResult {
  data: GroupedConsumption[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Inclusive custom date range. When provided, it overrides the preset
 * TimeFilter so callers can request an arbitrary span (e.g. cross-month).
 */
export interface CustomDateRange {
  start: Date;
  end: Date;
}

/**
 * Hook for optimized statistics queries using SQL
 */
export function useConsumptionStats() {
  /**
   * Get total amount and count for filtered consumptions
   */
  const getStats = useCallback(async (timeFilter: TimeFilter = "all"): Promise<ConsumptionStats> => {
    try {
      await ensureDatabaseInitialized();
      const [whereClause, params] = buildTimeFilterClause(timeFilter);
      
      // Get totals and counts by type in a single query
      const result = await getAll<{ 
        total: number; 
        expenseTotal: number;
        incomeTotal: number;
        count: number;
        expenseCount: number;
        incomeCount: number;
      }>(
        `SELECT 
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenseTotal,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as incomeTotal,
          COUNT(*) as count,
          SUM(CASE WHEN type = 'expense' THEN 1 ELSE 0 END) as expenseCount,
          SUM(CASE WHEN type = 'income' THEN 1 ELSE 0 END) as incomeCount
         FROM consumptions
         ${whereClause}`,
        params
      );

      const stats = result[0] || { 
        total: 0, 
        expenseTotal: 0,
        incomeTotal: 0,
        count: 0,
        expenseCount: 0,
        incomeCount: 0,
      };

      // Calculate log day (days since first entry)
      const firstDateResult = await getAll<{ min_date: string }>(
        "SELECT MIN(date) as min_date FROM consumptions WHERE deletedAt IS NULL"
      );
      
      let logDay = 0;
      if (firstDateResult[0]?.min_date) {
        const firstDate = new Date(firstDateResult[0].min_date).setHours(0, 0, 0, 0);
        const today = new Date().setHours(0, 0, 0, 0);
        const diffTime = today - firstDate;
        logDay = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      }

      const expenseTotal = stats.expenseTotal || 0;
      const incomeTotal = stats.incomeTotal || 0;
      const netTotal = incomeTotal - expenseTotal;

      return {
        total: stats.total || 0,
        expenseTotal,
        incomeTotal,
        netTotal,
        count: stats.count || 0,
        expenseCount: stats.expenseCount || 0,
        incomeCount: stats.incomeCount || 0,
        logDay,
      };
    } catch (error) {
      logger.error("Failed to get stats", error, { timeFilter });
      return { 
        total: 0, 
        expenseTotal: 0,
        incomeTotal: 0,
        netTotal: 0,
        count: 0, 
        expenseCount: 0,
        incomeCount: 0,
        logDay: 0 
      };
    }
  }, []);

  /**
   * Get consumptions grouped by day (paginated)
   */
  const getGroupedByDay = useCallback(async (
    timeFilter: TimeFilter = "all",
    sortBy: "date" | "amount" = "date",
    sortOrder: "ASC" | "DESC" = "DESC",
    page: number = 1,
    pageSize: number = 15
  ): Promise<PaginatedGroupedResult> => {
    try {
      await ensureDatabaseInitialized();
      const [whereClause, params] = buildTimeFilterClause(timeFilter);
      const localDayExpression = getLocalDaySqlExpression("date");
      
      // Validate and sanitize sortBy and sortOrder to prevent SQL injection
      const validSortBy = sortBy === "date" || sortBy === "amount" ? sortBy : "date";
      const validSortOrder = sortOrder === "ASC" || sortOrder === "DESC" ? sortOrder : "DESC";
      
      // Always sort by date first for grouping, then by the selected field
      const orderBy = validSortBy === "date" 
        ? `date ${validSortOrder}`
        : `date DESC, amount ${validSortOrder}`;
      
      const results = await getAll<{
        group_date: string;
        id: string;
        amount: number;
        description: string;
        type: string;
        category: string | null;
        date_full: string;
        createdAt: string | null;
        updatedAt: string | null;
        deletedAt: string | null;
      }>(
        `SELECT 
          ${localDayExpression} as group_date,
          id,
          amount,
          description,
          type,
          category,
          date as date_full,
          createdAt,
          updatedAt,
          deletedAt
         FROM consumptions
         ${whereClause}
         ORDER BY ${orderBy}`,
        params
      );

      // Group by date
      const grouped: { [key: string]: GroupedConsumption } = {};

      results.forEach((row) => {
        const dateKey = row.group_date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            consumptions: [],
            total: 0,
          };
        }
        
        const entryType = (row.type || "expense") as "expense" | "income";

        grouped[dateKey].consumptions.push(normalizeConsumptionRecord({
          id: row.id,
          amount: row.amount,
          description: row.description,
          type: entryType,
          category: row.category || undefined,
          date: row.date_full,
          createdAt: row.createdAt ?? row.date_full,
          updatedAt: row.updatedAt ?? row.createdAt ?? row.date_full,
          deletedAt: row.deletedAt,
        }));
        
        // Calculate net total: income adds, expense subtracts
        grouped[dateKey].total += getSignedAmount({ amount: row.amount, type: entryType });
      });

      // Sort groups by date, and items within groups by the selected criteria
      const sortedGroups = Object.values(grouped)
        .map((group) => {
          // Sort items within group if sorting by amount
          if (sortBy === "amount") {
            group.consumptions.sort((a, b) => {
              return sortOrder === "DESC" ? b.amount - a.amount : a.amount - b.amount;
            });
          }
          return group;
        })
        .sort((a, b) => {
          return sortOrder === "DESC"
            ? compareCalendarKeys(b.date, a.date)
            : compareCalendarKeys(a.date, b.date);
        });

      // Apply pagination
      const total = sortedGroups.length;
      const offset = (page - 1) * pageSize;
      const paginatedData = sortedGroups.slice(offset, offset + pageSize);

      return {
        data: paginatedData,
        total,
        page,
        pageSize,
        hasMore: offset + paginatedData.length < total,
      };
    } catch (error) {
      logger.error("Failed to get grouped by day", error, { timeFilter, sortBy, sortOrder });
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }, []);

  /**
   * Get consumptions grouped by month (paginated)
   */
  const getGroupedByMonth = useCallback(async (
    timeFilter: TimeFilter = "all",
    sortBy: "date" | "amount" = "date",
    sortOrder: "ASC" | "DESC" = "DESC",
    page: number = 1,
    pageSize: number = 15
  ): Promise<PaginatedGroupedResult> => {
    try {
      await ensureDatabaseInitialized();
      const [whereClause, params] = buildTimeFilterClause(timeFilter);
      const localMonthExpression = getLocalMonthSqlExpression("date");
      
      // Validate and sanitize sortBy and sortOrder to prevent SQL injection
      const validSortBy = sortBy === "date" || sortBy === "amount" ? sortBy : "date";
      const validSortOrder = sortOrder === "ASC" || sortOrder === "DESC" ? sortOrder : "DESC";
      
      // Always sort by date first for grouping, then by the selected field
      const orderBy = validSortBy === "date" 
        ? `date ${validSortOrder}`
        : `date DESC, amount ${validSortOrder}`;
      
      const results = await getAll<{
        year_month: string;
        id: string;
        amount: number;
        description: string;
        type: string;
        category: string | null;
        date_full: string;
        createdAt: string | null;
        updatedAt: string | null;
        deletedAt: string | null;
      }>(
        `SELECT 
          ${localMonthExpression} as year_month,
          id,
          amount,
          description,
          type,
          category,
          date as date_full,
          createdAt,
          updatedAt,
          deletedAt
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
        
        const entryType = (row.type || "expense") as "expense" | "income";

        grouped[monthKey].consumptions.push(normalizeConsumptionRecord({
          id: row.id,
          amount: row.amount,
          description: row.description,
          type: entryType,
          category: row.category || undefined,
          date: row.date_full,
          createdAt: row.createdAt ?? row.date_full,
          updatedAt: row.updatedAt ?? row.createdAt ?? row.date_full,
          deletedAt: row.deletedAt,
        }));
        
        // Calculate net total: income adds, expense subtracts
        grouped[monthKey].total += getSignedAmount({ amount: row.amount, type: entryType });
      });

      // Sort groups by date, and items within groups by the selected criteria
      const sortedGroups = Object.values(grouped)
        .map((group) => {
          // Sort items within group if sorting by amount
          if (sortBy === "amount") {
            group.consumptions.sort((a, b) => {
              return sortOrder === "DESC" ? b.amount - a.amount : a.amount - b.amount;
            });
          }
          return group;
        })
        .sort((a, b) => {
          return sortOrder === "DESC"
            ? compareCalendarKeys(b.date, a.date)
            : compareCalendarKeys(a.date, b.date);
        });

      // Apply pagination
      const total = sortedGroups.length;
      const offset = (page - 1) * pageSize;
      const paginatedData = sortedGroups.slice(offset, offset + pageSize);

      return {
        data: paginatedData,
        total,
        page,
        pageSize,
        hasMore: offset + paginatedData.length < total,
      };
    } catch (error) {
      logger.error("Failed to get grouped by month", error, { timeFilter, sortBy, sortOrder });
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }, []);

  /**
   * Get filtered consumptions with sorting
   */
  const getFilteredConsumptions = useCallback(async (
    timeFilter: TimeFilter = "all",
    sortBy: "date" | "amount" = "date",
    sortOrder: "ASC" | "DESC" = "DESC",
    customRange: CustomDateRange | null = null
  ): Promise<Consumption[]> => {
    try {
      await ensureDatabaseInitialized();
      const [whereClause, params] = buildTimeFilterClause(timeFilter, customRange);
      
      // Validate and sanitize sortBy and sortOrder to prevent SQL injection
      const validSortBy = sortBy === "date" || sortBy === "amount" ? sortBy : "date";
      const validSortOrder = sortOrder === "ASC" || sortOrder === "DESC" ? sortOrder : "DESC";
      
      const results = await getAll<{
        id: string;
        amount: number;
        description: string;
        type: string;
        category: string | null;
        date: string;
        createdAt: string | null;
        updatedAt: string | null;
        deletedAt: string | null;
      }>(
        `SELECT * FROM consumptions
         ${whereClause}
         ORDER BY ${validSortBy} ${validSortOrder}`,
        params
      );

      return results.map((row) =>
        normalizeConsumptionRecord({
          id: row.id,
          amount: row.amount,
          description: row.description,
          type: (row.type || "expense") as Consumption["type"],
          category: row.category ?? undefined,
          date: row.date,
          createdAt: row.createdAt ?? row.date,
          updatedAt: row.updatedAt ?? row.createdAt ?? row.date,
          deletedAt: row.deletedAt,
        })
      );
    } catch (error) {
      logger.error("Failed to get filtered consumptions", error, { timeFilter, sortBy, sortOrder });
      return [];
    }
  }, []);

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
function buildTimeFilterClause(
  timeFilter: TimeFilter,
  customRange: CustomDateRange | null = null
): [string, (string | number)[]] {
  const now = new Date();
  const conditions = ["deletedAt IS NULL"];
  const params: (string | number)[] = [];

  // A custom range takes precedence over the preset filter and covers the
  // full span from the start day (inclusive) to the end day (inclusive).
  if (customRange) {
    const { startIso, endIso } = getCustomRangeBounds(customRange);
    conditions.push("date >= ?", "date <= ?");
    params.push(startIso, endIso);
    return [`WHERE ${conditions.join(" AND ")}`, params];
  }

  switch (timeFilter) {
    case "today": {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      conditions.push("date >= ?", "date <= ?");
      params.push(todayStart.toISOString(), todayEnd.toISOString());
      break;
    }
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      conditions.push("date >= ?");
      params.push(weekAgo.toISOString());
      break;
    }
    case "month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      conditions.push("date >= ?");
      params.push(monthStart.toISOString());
      break;
    }
    case "year": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      conditions.push("date >= ?");
      params.push(yearStart.toISOString());
      break;
    }
    default:
      break;
  }

  return [`WHERE ${conditions.join(" AND ")}`, params];
}
