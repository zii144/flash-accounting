import assert from "node:assert/strict";
import test from "node:test";
import {
  getPurchasePackage,
  hasActiveEntitlement,
  hasUnlimitedLocalAccess,
  resolveStoragePlan,
} from "../utils/revenuecat";

const ENTITLEMENTS = {
  proEntitlementId: "cloud_sync_pro",
  plusEntitlementId: "local_unlimited",
};

function createCustomerInfo(activeEntitlements: string[]) {
  const active = Object.fromEntries(
    activeEntitlements.map((identifier) => [
      identifier,
      {
        identifier,
        isActive: true,
      },
    ])
  );

  return {
    entitlements: {
      active,
      all: active,
    },
  };
}

test("resolveStoragePlan returns pro when cloud entitlement is active", () => {
  const customerInfo = createCustomerInfo(["cloud_sync_pro"]);
  assert.equal(resolveStoragePlan(customerInfo as never, ENTITLEMENTS), "pro");
});

test("resolveStoragePlan returns plus when only local entitlement is active", () => {
  const customerInfo = createCustomerInfo(["local_unlimited"]);
  assert.equal(resolveStoragePlan(customerInfo as never, ENTITLEMENTS), "plus");
});

test("resolveStoragePlan prefers pro over plus when both are active", () => {
  const customerInfo = createCustomerInfo(["cloud_sync_pro", "local_unlimited"]);
  assert.equal(resolveStoragePlan(customerInfo as never, ENTITLEMENTS), "pro");
});

test("resolveStoragePlan returns basic when no entitlements are active", () => {
  const customerInfo = createCustomerInfo([]);
  assert.equal(resolveStoragePlan(customerInfo as never, ENTITLEMENTS), "basic");
});

test("hasUnlimitedLocalAccess is true for plus and pro plans", () => {
  assert.equal(
    hasUnlimitedLocalAccess(createCustomerInfo(["local_unlimited"]) as never, ENTITLEMENTS),
    true
  );
  assert.equal(
    hasUnlimitedLocalAccess(createCustomerInfo(["cloud_sync_pro"]) as never, ENTITLEMENTS),
    true
  );
  assert.equal(hasUnlimitedLocalAccess(createCustomerInfo([]) as never, ENTITLEMENTS), false);
});

test("getPurchasePackage resolves lifetime package for plus", () => {
  const lifetimePackage = {
    identifier: "plus_lifetime",
    packageType: "LIFETIME",
    product: { priceString: "USD $14.99" },
  };

  const offering = {
    identifier: "default",
    serverDescription: "default",
    metadata: {},
    availablePackages: [lifetimePackage],
    lifetime: lifetimePackage,
    annual: null,
    monthly: null,
    sixMonth: null,
    threeMonth: null,
    twoMonth: null,
    weekly: null,
  };

  assert.equal(getPurchasePackage(offering as never, "plus"), lifetimePackage);
});

test("hasActiveEntitlement returns false for missing customer info", () => {
  assert.equal(hasActiveEntitlement(null, "cloud_sync_pro"), false);
});
