#!/usr/bin/env bash
# Streamlined local iOS release pipeline (see RELEASE_IOS.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WORKSPACE="ios/flashaccounting.xcworkspace"
SCHEME="flashaccounting"
ARCHIVE_PATH="ios/build/flashaccounting.xcarchive"
EXPORT_PATH="ios/build/export"
EXPORT_PLIST="ios/ExportOptions.plist"
BUNDLE_ID="com.zii.flash.accounting"
METADATA_DIR="fastlane/metadata"
SCREENSHOTS_DIR="fastlane/screenshots"
ASC_KEY="fastlane/asc_api_key.json"

usage() {
  cat <<'EOF'
Usage: scripts/release-ios.sh <command>

Commands:
  check       Run pre-archive checks (typecheck, tests, deps, env)
  bump        Bump iOS build number in app.json and Info.plist
  versions    Print current marketing version and build number
  archive     Create a Release .xcarchive with xcodebuild
  upload      Export and upload the latest archive to App Store Connect
  testflight  Run check + archive + upload (full TestFlight pipeline)
  metadata    Push App Store text metadata (description, keywords, etc.) via fastlane
  screenshots Regenerate the screenshot layout and push it via fastlane (no text, no binary)
  open        Open the Xcode workspace

Environment:
  SKIP_CHECKS=1     Skip check step in testflight
  SKIP_UPLOAD=1     Archive only; do not upload
  BUILD_NUMBER=N    Set build number explicitly for bump
  FORCE=1           metadata/screenshots: skip the HTML preview confirmation (for CI)
EOF
}

require_workspace() {
  if [[ ! -d "$WORKSPACE" ]]; then
    echo "error: missing $WORKSPACE — run: npx expo prebuild --platform ios && npx pod-install" >&2
    exit 1
  fi
}

read_versions() {
  MARKETING_VERSION="$(python3 - <<'PY'
import json
print(json.load(open("app.json"))["expo"]["version"])
PY
)"
  BUILD_NUMBER="$(python3 - <<'PY'
import json
print(json.load(open("app.json"))["expo"]["ios"]["buildNumber"])
PY
)"
}

sync_info_plist() {
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $MARKETING_VERSION" ios/flashaccounting/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" ios/flashaccounting/Info.plist
}

cmd_versions() {
  read_versions
  native_marketing="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" ios/flashaccounting/Info.plist 2>/dev/null || echo missing)"
  native_build="$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" ios/flashaccounting/Info.plist 2>/dev/null || echo missing)"
  echo "app.json:  $MARKETING_VERSION ($BUILD_NUMBER)"
  echo "Info.plist: $native_marketing ($native_build)"
}

cmd_bump() {
  read_versions
  if [[ -n "${BUILD_NUMBER:-}" ]]; then
    next_build="$BUILD_NUMBER"
  else
    next_build=$((BUILD_NUMBER + 1))
  fi
  BUILD_NUMBER="$next_build"
  python3 - <<PY
import json
path = "app.json"
with open(path, encoding="utf-8") as handle:
    data = json.load(handle)
data["expo"]["ios"]["buildNumber"] = "$BUILD_NUMBER"
with open(path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
PY
  sync_info_plist
  echo "Bumped iOS build number to $BUILD_NUMBER (version $MARKETING_VERSION)"
  cmd_versions
}

cmd_check() {
  echo "==> Installing dependencies"
  npm ci
  npx pod-install

  echo "==> Release checks"
  npm run typecheck
  npm test
  npx expo install --check
  npm run verify:ios:env

  echo "==> Version sanity"
  cmd_versions
}

cmd_archive() {
  require_workspace
  read_versions
  sync_info_plist

  if [[ ! -f .env ]]; then
    echo "error: missing .env — copy .env.example and fill production values" >&2
    exit 1
  fi

  echo "==> Archiving $SCHEME ($MARKETING_VERSION build $BUILD_NUMBER)"
  rm -rf "$ARCHIVE_PATH"
  mkdir -p ios/build

  xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE_PATH" \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM=8KKMD5SMNP \
    PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID"

  echo "Archive ready: $ARCHIVE_PATH"
}

cmd_upload() {
  require_workspace
  if [[ ! -d "$ARCHIVE_PATH" ]]; then
    echo "error: archive not found at $ARCHIVE_PATH — run: scripts/release-ios.sh archive" >&2
    exit 1
  fi

  echo "==> Uploading to App Store Connect (TestFlight)"
  rm -rf "$EXPORT_PATH"
  mkdir -p "$EXPORT_PATH"

  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$EXPORT_PLIST" \
    -exportPath "$EXPORT_PATH" \
    -allowProvisioningUpdates

  echo "Upload submitted. Check App Store Connect > TestFlight for processing status."
}

cmd_testflight() {
  if [[ "${SKIP_CHECKS:-}" != "1" ]]; then
    cmd_check
  fi
  cmd_archive
  if [[ "${SKIP_UPLOAD:-}" != "1" ]]; then
    cmd_upload
  fi
}

cmd_metadata() {
  if ! command -v fastlane >/dev/null 2>&1; then
    echo "error: fastlane not installed — run: brew install fastlane  (or: gem install fastlane)" >&2
    exit 1
  fi

  if [[ ! -d "$METADATA_DIR" ]]; then
    echo "error: missing $METADATA_DIR — run: node scripts/gen-appstore-metadata.mjs" >&2
    exit 1
  fi

  if [[ ! -f "$ASC_KEY" ]]; then
    echo "error: missing $ASC_KEY" >&2
    echo "  Copy fastlane/asc_api_key.example.json to $ASC_KEY and fill in your" >&2
    echo "  App Store Connect API key (App Store Connect > Users and Access > Integrations)." >&2
    exit 1
  fi

  # Refuse to push while any REPLACE_ME placeholder remains (e.g. the support URL).
  if grep -rIl 'REPLACE_ME' "$METADATA_DIR" >/dev/null 2>&1; then
    echo "error: placeholder 'REPLACE_ME' still present in metadata — fix these files first:" >&2
    grep -rIl 'REPLACE_ME' "$METADATA_DIR" | sed 's/^/  /' >&2
    echo "  Tip: set your real support URL everywhere with:" >&2
    echo "    grep -rl REPLACE_ME $METADATA_DIR | xargs sed -i '' 's|https://REPLACE_ME.example.com/support|https://YOUR-SUPPORT-URL|g'" >&2
    exit 1
  fi

  echo "==> Pushing App Store metadata (text only — no binary, no screenshots)"
  local force_flag=()
  if [[ "${FORCE:-}" == "1" ]]; then
    force_flag=(--force)
  fi
  fastlane deliver "${force_flag[@]}"
  echo "Metadata push submitted. Review in App Store Connect > App Store."
}

cmd_screenshots() {
  if ! command -v fastlane >/dev/null 2>&1; then
    echo "error: fastlane not installed — run: brew install fastlane  (or: gem install fastlane)" >&2
    exit 1
  fi

  if [[ ! -f "$ASC_KEY" ]]; then
    echo "error: missing $ASC_KEY" >&2
    echo "  Copy fastlane/asc_api_key.example.json to $ASC_KEY and fill in your" >&2
    echo "  App Store Connect API key (App Store Connect > Users and Access > Integrations)." >&2
    exit 1
  fi

  echo "==> Generating screenshot layout from captures/"
  node scripts/gen-appstore-screenshots.mjs

  if ! find "$SCREENSHOTS_DIR" -mindepth 2 -name '*.png' -print -quit 2>/dev/null | grep -q .; then
    echo "error: no screenshots generated under $SCREENSHOTS_DIR — check captures/" >&2
    exit 1
  fi

  # Screenshots only: no binary, no text metadata. overwrite replaces whatever is
  # already on the editable version so re-runs are clean. These flags override the
  # text-only defaults in fastlane/Deliverfile.
  echo "==> Pushing App Store screenshots (no binary, no text metadata)"
  local force_flag=()
  if [[ "${FORCE:-}" == "1" ]]; then
    force_flag=(--force)
  fi
  fastlane deliver \
    --skip_binary_upload true \
    --skip_metadata true \
    --skip_screenshots false \
    --overwrite_screenshots true \
    "${force_flag[@]}"
  echo "Screenshot push submitted. Review in App Store Connect > App Store."
}

cmd_open() {
  require_workspace
  xed ios
}

main() {
  local command="${1:-}"
  case "$command" in
    check) cmd_check ;;
    bump) cmd_bump ;;
    versions) cmd_versions ;;
    archive) cmd_archive ;;
    upload) cmd_upload ;;
    testflight) cmd_testflight ;;
    metadata) cmd_metadata ;;
    screenshots) cmd_screenshots ;;
    open) cmd_open ;;
    ""|-h|--help|help) usage ;;
    *)
      echo "error: unknown command '$command'" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
