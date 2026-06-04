#!/usr/bin/env bash
# Verify production iOS JS bundle inlines EXPO_PUBLIC values from .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "error: missing .env at project root ($ROOT/.env)" >&2
  exit 1
fi

BUNDLE="${1:-$ROOT/ios/build/verify-env/main.jsbundle}"
mkdir -p "$(dirname "$BUNDLE")"

echo "Bundling Release iOS JS (same step as Xcode archive)..."
npx expo export:embed --platform ios --dev false --bundle-output "$BUNDLE" --reset-cache

BUNDLE_PATH="$BUNDLE" ENV_PATH="$ROOT/.env" python3 <<'PY'
import os, sys

bundle_path = os.environ["BUNDLE_PATH"]
env_path = os.environ["ENV_PATH"]

def load_env(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key.startswith("EXPO_PUBLIC_") and value:
                values[key] = value
    return values

with open(bundle_path, "rb") as handle:
    bundle = handle.read().decode("utf-8", "ignore")

env = load_env(env_path)
required = [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    "EXPO_PUBLIC_REVENUECAT_API_KEY_IOS",
    "EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID",
    "EXPO_PUBLIC_REVENUECAT_PLUS_ENTITLEMENT_ID",
    "EXPO_PUBLIC_REVENUECAT_OFFERING_ID",
]

optional = [
    "EXPO_PUBLIC_SENTRY_DSN",
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
]

failures: list[str] = []
warnings: list[str] = []

for key in required:
    value = env.get(key)
    if not value:
        failures.append(f"{key} missing or empty in .env")
        continue
    if value not in bundle:
        failures.append(f"{key} not embedded in bundle")

for key in optional:
    value = env.get(key)
    if not value:
        warnings.append(f"{key} not set in .env (skipped)")
        continue
    if value not in bundle:
        warnings.append(f"{key} set in .env but not embedded in bundle")

test_key = env.get("EXPO_PUBLIC_REVENUECAT_API_KEY_TEST")
if test_key and test_key in bundle:
    warnings.append(
        "EXPO_PUBLIC_REVENUECAT_API_KEY_TEST is embedded; remove it from .env before App Store upload"
    )

if failures:
    print("FAILED: production bundle is missing required env values:")
    for item in failures:
        print(f"  - {item}")
    sys.exit(1)

print("OK: required EXPO_PUBLIC values from .env are embedded in the Release bundle.")
for item in warnings:
    print(f"warn: {item}")
PY

echo "Bundle: $BUNDLE"
