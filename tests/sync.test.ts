import assert from "node:assert/strict";
import test from "node:test";
import type { Consumption } from "../types/consumption";
import {
  buildCloudSyncPlan,
  getActiveConsumptions,
  mergeConsumptionSnapshots,
} from "../utils/sync";

function createRecord(overrides: Partial<Consumption> & Pick<Consumption, "id">): Consumption {
  const timestamp = overrides.date ?? overrides.updatedAt ?? "2026-04-27T12:00:00.000Z";

  return {
    id: overrides.id,
    amount: overrides.amount ?? 10,
    description: overrides.description ?? "",
    type: overrides.type ?? "expense",
    category: overrides.category,
    date: overrides.date ?? timestamp,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? timestamp,
    deletedAt: overrides.deletedAt ?? null,
  };
}

test("mergeConsumptionSnapshots keeps the latest revision for each record", () => {
  const local = [
    createRecord({
      id: "shared",
      amount: 15,
      updatedAt: "2026-04-27T10:00:00.000Z",
    }),
  ];
  const cloud = [
    createRecord({
      id: "shared",
      amount: 9,
      updatedAt: "2026-04-27T09:00:00.000Z",
    }),
  ];

  const merged = mergeConsumptionSnapshots(local, cloud);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.amount, 15);
});

test("buildCloudSyncPlan only uploads records newer than the cloud snapshot", () => {
  const local = [
    createRecord({
      id: "unchanged",
      updatedAt: "2026-04-27T08:00:00.000Z",
    }),
    createRecord({
      id: "newer-local",
      updatedAt: "2026-04-27T11:00:00.000Z",
    }),
  ];
  const cloud = [
    createRecord({
      id: "unchanged",
      updatedAt: "2026-04-27T08:00:00.000Z",
    }),
    createRecord({
      id: "newer-local",
      updatedAt: "2026-04-27T10:00:00.000Z",
    }),
  ];

  const plan = buildCloudSyncPlan(local, cloud);

  assert.deepEqual(
    plan.map((record) => record.id),
    ["newer-local"]
  );
});

test("getActiveConsumptions excludes tombstones", () => {
  const active = createRecord({ id: "active" });
  const deleted = createRecord({
    id: "deleted",
    deletedAt: "2026-04-27T12:30:00.000Z",
    updatedAt: "2026-04-27T12:30:00.000Z",
  });

  const visible = getActiveConsumptions([active, deleted]);

  assert.deepEqual(
    visible.map((record) => record.id),
    ["active"]
  );
});
