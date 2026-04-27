import type { Consumption } from "@/types/consumption";
import { normalizeConsumptionRecord } from "@/utils/consumption-record";
import { getActiveConsumptions } from "@/utils/sync";
import {
  collection,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getFirebase } from "@/utils/firebase";

function toFirestoreConsumption(consumption: Consumption): Record<string, unknown> {
  const normalized = normalizeConsumptionRecord(consumption);

  return {
    id: normalized.id,
    amount: Number(normalized.amount),
    description: normalized.description,
    type: normalized.type,
    category: normalized.category ?? null,
    date: normalized.date,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    deletedAt: normalized.deletedAt ?? null,
  };
}

function requireServices() {
  const services = getFirebase();
  if (!services) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }
  return services;
}

function userConsumptionsCollection(uid: string) {
  const { firestore } = requireServices();
  return collection(firestore, "users", uid, "consumptions");
}

function sortByDateDesc(left: Consumption, right: Consumption): number {
  return right.date.localeCompare(left.date);
}

export async function cloudGetSnapshot(uid: string): Promise<Consumption[]> {
  const col = userConsumptionsCollection(uid);
  const snap = await getDocs(col);
  return snap.docs.map((docSnapshot) =>
    normalizeConsumptionRecord(docSnapshot.data() as Consumption)
  );
}

export async function cloudGetTotalCount(uid: string): Promise<number> {
  const snapshot = await cloudGetSnapshot(uid);
  return getActiveConsumptions(snapshot).length;
}

export async function cloudGetAll(uid: string): Promise<Consumption[]> {
  const snapshot = await cloudGetSnapshot(uid);
  return getActiveConsumptions(snapshot);
}

export async function cloudGetMinDate(uid: string): Promise<string | null> {
  const activeConsumptions = await cloudGetAll(uid);
  const earliest = [...activeConsumptions].sort((left, right) => left.date.localeCompare(right.date))[0];
  return earliest?.date ?? null;
}

export async function cloudLoadPaginated(
  uid: string,
  options: {
    page: number;
    pageSize: number;
    sortBy?: "date" | "amount";
    sortOrder?: "ASC" | "DESC";
  }
): Promise<{
  data: Consumption[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const { page, pageSize, sortBy = "date", sortOrder = "DESC" } = options;
  const activeConsumptions = await cloudGetAll(uid);
  const sorted = [...activeConsumptions].sort((left, right) => {
    if (sortBy === "amount") {
      return sortOrder === "DESC" ? right.amount - left.amount : left.amount - right.amount;
    }

    return sortOrder === "DESC"
      ? right.date.localeCompare(left.date)
      : left.date.localeCompare(right.date);
  });

  const total = sorted.length;
  const offset = (page - 1) * pageSize;
  const data = sorted.slice(offset, offset + pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    hasMore: offset + data.length < total,
  };
}

export async function cloudSave(uid: string, consumption: Consumption): Promise<void> {
  const col = userConsumptionsCollection(uid);
  await setDoc(doc(col, consumption.id), toFirestoreConsumption(consumption), { merge: true });
}

export async function cloudUpsertMany(uid: string, consumptions: Consumption[]): Promise<void> {
  const col = userConsumptionsCollection(uid);

  for (let index = 0; index < consumptions.length; index += 450) {
    const chunk = consumptions.slice(index, index + 450);
    await Promise.all(
      chunk.map((consumption) =>
        setDoc(doc(col, consumption.id), toFirestoreConsumption(consumption), { merge: true })
      )
    );
  }
}

export async function cloudUpdate(uid: string, consumption: Consumption): Promise<void> {
  await cloudSave(uid, consumption);
}

export async function cloudClearAll(uid: string): Promise<void> {
  const snapshot = await cloudGetSnapshot(uid);
  const timestamp = new Date().toISOString();
  const tombstones = snapshot.map((consumption) =>
    normalizeConsumptionRecord({
      ...consumption,
      updatedAt: timestamp,
      deletedAt: timestamp,
    })
  );

  await cloudUpsertMany(uid, tombstones);
}

export async function cloudGetAllFiltered(
  uid: string,
  timeFilter: "all" | "today" | "week" | "month" | "year",
  sortBy: "date" | "amount" = "date",
  sortOrder: "ASC" | "DESC" = "DESC"
): Promise<Consumption[]> {
  const activeConsumptions = await cloudGetAll(uid);
  const now = new Date();

  const filtered = activeConsumptions.filter((consumption) => {
    const recordDate = new Date(consumption.date);
    if (timeFilter === "all") {
      return true;
    }

    if (timeFilter === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return recordDate >= start && recordDate <= end;
    }

    if (timeFilter === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return recordDate >= weekAgo;
    }

    if (timeFilter === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return recordDate >= monthStart;
    }

    const yearStart = new Date(now.getFullYear(), 0, 1);
    return recordDate >= yearStart;
  });

  return filtered.sort((left, right) => {
    if (sortBy === "amount") {
      return sortOrder === "DESC" ? right.amount - left.amount : left.amount - right.amount;
    }

    return sortOrder === "DESC"
      ? sortByDateDesc(left, right)
      : left.date.localeCompare(right.date);
  });
}
