import type { Consumption } from "@/types/consumption";
import { getFirebase } from "@/utils/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from "firebase/firestore";

function toFirestoreConsumption(consumption: Consumption): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    id: consumption.id,
    amount: Number(consumption.amount),
    description: consumption.description ?? "",
    type: (consumption.type ?? "expense") as "expense" | "income",
    date: consumption.date,
  };

  if (typeof consumption.category === "string" && consumption.category.length > 0) {
    normalized.category = consumption.category;
  }

  return normalized;
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

export async function cloudGetTotalCount(uid: string): Promise<number> {
  const col = userConsumptionsCollection(uid);
  const snap = await getCountFromServer(col);
  return snap.data().count;
}

export async function cloudGetAll(uid: string): Promise<Consumption[]> {
  const col = userConsumptionsCollection(uid);
  const snap = await getDocs(query(col, orderBy("date", "desc")));
  return snap.docs.map((d) => d.data() as Consumption);
}

export async function cloudGetMinDate(uid: string): Promise<string | null> {
  const col = userConsumptionsCollection(uid);
  const snap = await getDocs(query(col, orderBy("date", "asc"), limit(1)));
  if (snap.empty) return null;
  const first = snap.docs[0]?.data() as Consumption | undefined;
  return first?.date ?? null;
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
  const col = userConsumptionsCollection(uid);

  const total = await cloudGetTotalCount(uid);
  const fetchLimit = Math.min(total, page * pageSize);

  const constraints: QueryConstraint[] = [
    orderBy(sortBy, sortOrder === "ASC" ? "asc" : "desc"),
    limit(fetchLimit),
  ];

  let snap;
  try {
    snap = await getDocs(query(col, ...constraints));
  } catch {
    // Fallback to date ordering if composite indexes are missing.
    snap = await getDocs(
      query(col, orderBy("date", "desc"), limit(fetchLimit))
    );
  }

  const all = snap.docs.map((d) => d.data() as Consumption);
  const offset = (page - 1) * pageSize;
  const data = all.slice(offset, offset + pageSize);

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
    const batch = writeBatch(col.firestore);
    const chunk = consumptions.slice(index, index + 450);

    for (const consumption of chunk) {
      batch.set(doc(col, consumption.id), toFirestoreConsumption(consumption), { merge: true });
    }

    await batch.commit();
  }
}

export async function cloudUpdate(uid: string, consumption: Consumption): Promise<void> {
  const col = userConsumptionsCollection(uid);
  await updateDoc(doc(col, consumption.id), { ...toFirestoreConsumption(consumption) });
}

export async function cloudDelete(uid: string, id: string): Promise<void> {
  const col = userConsumptionsCollection(uid);
  await deleteDoc(doc(col, id));
}

export async function cloudClearAll(uid: string): Promise<void> {
  const col = userConsumptionsCollection(uid);

  while (true) {
    const snap = await getDocs(query(col, orderBy("date", "desc"), limit(500)));
    if (snap.empty) return;

    const batch = writeBatch(col.firestore);
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

export function buildCloudTimeFilterConstraints(
  timeFilter: "all" | "today" | "week" | "month" | "year"
): QueryConstraint[] {
  if (timeFilter === "all") return [];

  const now = new Date();
  if (timeFilter === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return [where("date", ">=", start.toISOString()), where("date", "<=", end.toISOString())];
  }

  if (timeFilter === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return [where("date", ">=", weekAgo.toISOString())];
  }

  if (timeFilter === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return [where("date", ">=", monthStart.toISOString())];
  }

  const yearStart = new Date(now.getFullYear(), 0, 1);
  return [where("date", ">=", yearStart.toISOString())];
}

export async function cloudGetAllFiltered(
  uid: string,
  timeFilter: "all" | "today" | "week" | "month" | "year",
  sortBy: "date" | "amount" = "date",
  sortOrder: "ASC" | "DESC" = "DESC"
): Promise<Consumption[]> {
  const col = userConsumptionsCollection(uid);
  const constraints: QueryConstraint[] = [
    ...buildCloudTimeFilterConstraints(timeFilter),
    orderBy(sortBy, sortOrder === "ASC" ? "asc" : "desc"),
  ];

  let snap;
  try {
    snap = await getDocs(query(col, ...constraints));
  } catch {
    // Most common failure is missing indexes; date ordering is usually available.
    snap = await getDocs(query(col, ...buildCloudTimeFilterConstraints(timeFilter), orderBy("date", "desc")));
  }

  return snap.docs.map((d) => d.data() as Consumption);
}
