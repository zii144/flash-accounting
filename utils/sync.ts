import type { Consumption } from "@/types/consumption";
import {
  getConsumptionRevision,
  isConsumptionDeleted,
  normalizeConsumptionRecord,
} from "@/utils/consumption-record";

function compareIsoStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

export function compareConsumptionRevisions(left: Consumption, right: Consumption): number {
  const revisionComparison = compareIsoStrings(
    getConsumptionRevision(left),
    getConsumptionRevision(right)
  );

  if (revisionComparison !== 0) {
    return revisionComparison;
  }

  const leftDeleted = isConsumptionDeleted(left);
  const rightDeleted = isConsumptionDeleted(right);

  if (leftDeleted !== rightDeleted) {
    return leftDeleted ? 1 : -1;
  }

  return compareIsoStrings(left.date, right.date);
}

export function mergeConsumptionSnapshots(
  localSnapshot: Consumption[],
  cloudSnapshot: Consumption[]
): Consumption[] {
  const merged = new Map<string, Consumption>();

  for (const rawRecord of [...cloudSnapshot, ...localSnapshot]) {
    const record = normalizeConsumptionRecord(rawRecord);
    const current = merged.get(record.id);

    if (!current || compareConsumptionRevisions(record, current) >= 0) {
      merged.set(record.id, record);
    }
  }

  return Array.from(merged.values()).sort((left, right) =>
    compareIsoStrings(right.updatedAt, left.updatedAt)
  );
}

export function getActiveConsumptions(snapshot: Consumption[]): Consumption[] {
  return snapshot
    .filter((consumption) => !isConsumptionDeleted(consumption))
    .sort((left, right) => compareIsoStrings(right.date, left.date));
}

export function buildCloudSyncPlan(
  localSnapshot: Consumption[],
  cloudSnapshot: Consumption[]
): Consumption[] {
  const cloudById = new Map(
    cloudSnapshot.map((record) => [record.id, normalizeConsumptionRecord(record)])
  );

  return localSnapshot
    .map((record) => normalizeConsumptionRecord(record))
    .filter((record) => {
      const cloudRecord = cloudById.get(record.id);
      if (!cloudRecord) {
        return true;
      }

      return compareConsumptionRevisions(record, cloudRecord) > 0;
    })
    .sort((left, right) => compareIsoStrings(left.updatedAt, right.updatedAt));
}
