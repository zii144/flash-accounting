export type ConsumptionType = 'expense' | 'income';

export interface Consumption {
  id: string;
  amount: number;
  description: string;
  type: ConsumptionType;
  category?: string;
  date: string; // ISO date string
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type ConsumptionDraft = Omit<
  Consumption,
  "id" | "date" | "createdAt" | "updatedAt" | "deletedAt"
>;

export type ConsumptionCategory = 'food' | 'transport' | 'entertainment' | 'shopping' | 'bills' | 'other';
