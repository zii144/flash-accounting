import type { Consumption } from "../types/consumption";

function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildConsumptionsCsv(
  consumptions: Consumption[],
  locale: string = "en-US"
): string {
  void locale;

  const headers = ["Date", "Type", "Amount", "Description", "Category"];
  const rows = consumptions.map((consumption) => {
    const cells = [
      new Date(consumption.date).toISOString(),
      consumption.type,
      consumption.amount.toFixed(2),
      consumption.description ?? "",
      consumption.category ?? "",
    ];

    return cells.map(escapeCsvField).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
