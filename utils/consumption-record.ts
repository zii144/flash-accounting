import type { Consumption, ConsumptionType } from "@/types/consumption";

type PartialConsumptionRecord = Partial<Consumption> & {
  id: string;
  amount: number;
  description?: string | null;
  type?: ConsumptionType | null;
  category?: string | null;
  date: string;
};

export function createConsumptionRecord(
  input: Omit<Consumption, "createdAt" | "updatedAt" | "deletedAt"> & {
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string | null;
  }
): Consumption {
  const createdAt = input.createdAt ?? input.date;
  const updatedAt = input.updatedAt ?? createdAt;

  return {
    id: input.id,
    amount: Number(input.amount),
    description: input.description ?? "",
    type: input.type ?? "expense",
    category: input.category ?? undefined,
    date: input.date,
    createdAt,
    updatedAt,
    deletedAt: input.deletedAt ?? null,
  };
}

export function normalizeConsumptionRecord(input: PartialConsumptionRecord): Consumption {
  return createConsumptionRecord({
    id: input.id,
    amount: Number(input.amount),
    description: input.description ?? "",
    type: input.type ?? "expense",
    category: input.category ?? undefined,
    date: input.date,
    createdAt: input.createdAt ?? input.date,
    updatedAt: input.updatedAt ?? input.createdAt ?? input.date,
    deletedAt: input.deletedAt ?? null,
  });
}

export function markConsumptionDeleted(consumption: Consumption, deletedAt: string): Consumption {
  return {
    ...consumption,
    deletedAt,
    updatedAt: deletedAt,
  };
}

export function isConsumptionDeleted(consumption: Consumption): boolean {
  return Boolean(consumption.deletedAt);
}

export function getConsumptionRevision(consumption: Consumption): string {
  return consumption.updatedAt || consumption.createdAt || consumption.date;
}
