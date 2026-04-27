import type { Consumption } from "../types/consumption";

type LedgerEntry = Pick<Consumption, "amount" | "type">;

export function getSignedAmount(entry: LedgerEntry): number {
  return entry.type === "income" ? entry.amount : -entry.amount;
}

export function calculateNetTotal(entries: LedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + getSignedAmount(entry), 0);
}
