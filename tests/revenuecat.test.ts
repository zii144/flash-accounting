import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentOffering,
  getRevenueCatConfig,
  getRevenueCatPreferredLocale,
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

function runWithRevenueCatEnv(
  env: Record<string, string | undefined>,
  isDev: boolean | undefined,
  callback: () => void
) {
  const previousEnv = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(env)) {
    previousEnv.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
  const previousDev = runtime.__DEV__;

  if (isDev === undefined) {
    delete runtime.__DEV__;
  } else {
    runtime.__DEV__ = isDev;
  }

  try {
    callback();
  } finally {
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    if (previousDev === undefined) {
      delete runtime.__DEV__;
    } else {
      runtime.__DEV__ = previousDev;
    }
  }
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

test("getCurrentOffering prefers the RevenueCat dashboard current offering", () => {
  const currentOffering = { identifier: "default" };
  const offerings = {
    current: currentOffering,
    all: {
      default: currentOffering,
      legacy: { identifier: "legacy" },
    },
  };

  assert.equal(getCurrentOffering(offerings as never, "legacy"), currentOffering);
});

test("getCurrentOffering falls back to configured offering id when current is unset", () => {
  const fallbackOffering = { identifier: "staging" };
  const offerings = {
    current: null,
    all: {
      staging: fallbackOffering,
    },
  };

  assert.equal(getCurrentOffering(offerings as never, "staging"), fallbackOffering);
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

test("getPurchasePackage does not fall back to the wrong package type for pro plans", () => {
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

  assert.equal(getPurchasePackage(offering as never, "monthly"), null);
  assert.equal(getPurchasePackage(offering as never, "annual"), null);
});

test("getRevenueCatConfig prefers the test store key in debug builds", () => {
  runWithRevenueCatEnv(
    {
      EXPO_OS: "ios",
      EXPO_PUBLIC_REVENUECAT_API_KEY_TEST: "test_key",
      EXPO_PUBLIC_REVENUECAT_API_KEY_IOS: "ios_key",
      EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID: "android_key",
    },
    true,
    () => {
      const config = getRevenueCatConfig();
      assert.ok(config);
      assert.equal(config.apiKey, "test_key");
    }
  );
});

test("getRevenueCatConfig uses platform keys outside debug builds", () => {
  runWithRevenueCatEnv(
    {
      EXPO_OS: "android",
      EXPO_PUBLIC_REVENUECAT_API_KEY_TEST: "test_key",
      EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID: "android_key",
    },
    false,
    () => {
      const config = getRevenueCatConfig();
      assert.ok(config);
      assert.equal(config.apiKey, "android_key");
    }
  );
});

test("getRevenueCatPreferredLocale maps app zh to RevenueCat Traditional Chinese", () => {
  assert.equal(getRevenueCatPreferredLocale("zh", "zh"), "zh_Hant");
});

test("getRevenueCatPreferredLocale preserves supported device locales when using device language", () => {
  assert.equal(getRevenueCatPreferredLocale("device", "en", "zh-TW"), "zh_Hant");
  assert.equal(getRevenueCatPreferredLocale("device", "en", "ja-JP"), "ja");
});

test("getRevenueCatPreferredLocale maps app Japanese to RevenueCat Japanese", () => {
  assert.equal(getRevenueCatPreferredLocale("ja", "ja"), "ja");
});

test("getRevenueCatPreferredLocale maps regional device locales through the app language bridge", () => {
  assert.equal(getRevenueCatPreferredLocale("device", "es", "es-MX"), "es_ES");
  assert.equal(getRevenueCatPreferredLocale("device", "fr", "fr-CA"), "fr_FR");
  assert.equal(getRevenueCatPreferredLocale("device", "de", "de-AT"), "de_DE");
});

test("getRevenueCatPreferredLocale supports RevenueCat dashboard locale overrides", () => {
  runWithRevenueCatEnv(
    {
      EXPO_PUBLIC_REVENUECAT_PAYWALL_LOCALE_ES: "es_419",
      EXPO_PUBLIC_REVENUECAT_PAYWALL_LOCALE_FR: "fr_CA",
    },
    undefined,
    () => {
      assert.equal(getRevenueCatPreferredLocale("es", "es"), "es_419");
      assert.equal(getRevenueCatPreferredLocale("device", "fr", "fr-CA"), "fr_CA");
    }
  );
});

test("hasActiveEntitlement returns false for missing customer info", () => {
  assert.equal(hasActiveEntitlement(null, "cloud_sync_pro"), false);
});
