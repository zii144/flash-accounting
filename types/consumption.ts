export interface Consumption {
  id: string;
  amount: number;
  description: string;
  category?: string;
  date: string; // ISO date string
}

export type ConsumptionCategory = 'food' | 'transport' | 'entertainment' | 'shopping' | 'bills' | 'other';
