import type { Consumption, ConsumptionType } from "@/types/consumption";
import { createConsumptionRecord } from "@/utils/consumption-record";
import { sanitizeDescription } from "@/utils/validation";

type CsvImportColumn = "date" | "type" | "amount" | "description" | "category";

export type CsvImportResult = {
  consumptions: Consumption[];
};

const HEADER_ALIASES: Record<string, CsvImportColumn> = {
  date: "date",
  time: "date",
  type: "type",
  amount: "amount",
  description: "description",
  category: "category",
};

function splitCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase();
}

function parseConsumptionType(value: string, rowNumber: number): ConsumptionType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "expense" || normalized === "income") {
    return normalized;
  }

  throw new Error(`Row ${rowNumber}: Type must be expense or income.`);
}

function parseAmount(value: string, rowNumber: number): number {
  const amount = Number(value.trim().replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Row ${rowNumber}: Amount must be greater than zero.`);
  }

  return amount;
}

function parseDate(value: string, rowNumber: number): string {
  const timestamp = Date.parse(value.trim());
  if (Number.isNaN(timestamp)) {
    throw new Error(`Row ${rowNumber}: Date is invalid.`);
  }

  return new Date(timestamp).toISOString();
}

function getRequiredColumnIndex(
  columnMap: Partial<Record<CsvImportColumn, number>>,
  column: CsvImportColumn
): number {
  const index = columnMap[column];
  if (index === undefined) {
    throw new Error(`CSV must include ${column} column.`);
  }
  return index;
}

export function parseConsumptionsCsv(csv: string): CsvImportResult {
  const rows = splitCsvRows(csv);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one record.");
  }

  const headerRow = rows[0] ?? [];
  const columnMap: Partial<Record<CsvImportColumn, number>> = {};

  headerRow.forEach((header, index) => {
    const column = HEADER_ALIASES[normalizeHeader(header)];
    if (column && columnMap[column] === undefined) {
      columnMap[column] = index;
    }
  });

  const dateIndex = getRequiredColumnIndex(columnMap, "date");
  const typeIndex = getRequiredColumnIndex(columnMap, "type");
  const amountIndex = getRequiredColumnIndex(columnMap, "amount");
  const descriptionIndex = columnMap.description;
  const categoryIndex = columnMap.category;
  const importedAt = new Date().toISOString();

  const consumptions = rows.slice(1).map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const date = parseDate(row[dateIndex] ?? "", rowNumber);

    return createConsumptionRecord({
      id: `csv-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 10)}`,
      amount: parseAmount(row[amountIndex] ?? "", rowNumber),
      description:
        descriptionIndex === undefined ? "" : sanitizeDescription(row[descriptionIndex] ?? ""),
      type: parseConsumptionType(row[typeIndex] ?? "", rowNumber),
      category: categoryIndex === undefined ? undefined : row[categoryIndex]?.trim() || undefined,
      date,
      createdAt: importedAt,
      updatedAt: importedAt,
    });
  });

  return { consumptions };
}
