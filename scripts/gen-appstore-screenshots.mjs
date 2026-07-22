#!/usr/bin/env node
// Lay out the fastlane deliver screenshots tree for App Store Connect.
//
// Mirrors the raw device captures in
//   captures/ios26-iphone17-pro-max/screenshots/<prefix>-<screen>.png
// into
//   fastlane/screenshots/<ASC-locale>/NN_<screen>.png
// so that `fastlane deliver` (via `scripts/release-ios.sh screenshots`) uploads
// them. The numeric NN_ prefix fixes the on-store display order — deliver sorts
// screenshots alphabetically by filename.
//
// Both captures/ and fastlane/screenshots are git-ignored: the captures are the
// source of truth, this tree is a regenerable build artifact. Re-running wipes
// and rebuilds fastlane/screenshots so a removed capture never lingers on a push.
//
// The captures are 6.9" iPhone (1320x2868) shots. fastlane maps that resolution
// to APP_IPHONE_67 ("...actually 6.9-inch iPhones"), the required App Store slot.

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  existsSync,
  copyFileSync,
  statSync,
} from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAPTURES_DIR = join(ROOT, "captures", "ios26-iphone17-pro-max", "screenshots");
const SCREENSHOTS_DIR = join(ROOT, "fastlane", "screenshots");
const METADATA_DIR = join(ROOT, "fastlane", "metadata");

// Apple's 6.9" iPhone screenshot spec (portrait). deliver also accepts landscape.
const EXPECTED = [
  [1320, 2868],
  [2868, 1320],
];

// Capture filename prefix -> App Store Connect locale code.
const LOCALE_MAP = {
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  id: "id",
  it: "it",
  ja: "ja",
  ko: "ko",
  pl: "pl",
  pt: "pt-BR",
  ru: "ru",
  tr: "tr",
  zh: "zh-Hant",
};

// On-store display order. Only screens that exist for a locale are emitted, but
// they always come out in this order. Edit this to re-order the store gallery.
const SCREEN_ORDER = ["accounting", "statistics", "settings", "language"];

// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// Minimal PNG dimension reader — no dependencies. Returns [width, height].
function pngSize(file) {
  const buf = readFileSync(file);
  const sig = "\x89PNG\r\n\x1a\n";
  if (buf.length < 24 || buf.toString("latin1", 0, 8) !== sig) {
    return null; // not a PNG
  }
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

function shippedLocales() {
  // Source of truth for which locales the app ships = the metadata tree.
  if (!existsSync(METADATA_DIR)) return Object.values(LOCALE_MAP);
  return readdirSync(METADATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

if (!existsSync(CAPTURES_DIR)) {
  fail(`missing captures dir: ${CAPTURES_DIR}`);
}

// Index captures: prefix -> { screen -> absolute path }
const captures = {};
const badSize = [];
for (const name of readdirSync(CAPTURES_DIR)) {
  if (!name.toLowerCase().endsWith(".png")) continue;
  const stem = basename(name, ".png");
  const dash = stem.indexOf("-");
  if (dash < 0) continue;
  const prefix = stem.slice(0, dash);
  const screen = stem.slice(dash + 1);
  const abs = join(CAPTURES_DIR, name);

  const size = pngSize(abs);
  if (!size || !EXPECTED.some(([w, h]) => w === size[0] && h === size[1])) {
    badSize.push(`${name} (${size ? size.join("x") : "not a PNG"})`);
    continue;
  }
  (captures[prefix] ||= {})[screen] = abs;
}

if (badSize.length) {
  console.error("error: captures with unexpected dimensions (need 1320x2868):");
  for (const b of badSize) console.error(`  ${b}`);
  fail("fix or remove the offending captures, then re-run");
}

// Rebuild the destination tree from scratch.
rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const reverse = Object.fromEntries(
  Object.entries(LOCALE_MAP).map(([p, l]) => [l, p]),
);

const rows = [];
let totalFiles = 0;
for (const locale of shippedLocales()) {
  const prefix = reverse[locale];
  const shots = prefix ? captures[prefix] : undefined;
  const screens = shots ? SCREEN_ORDER.filter((s) => shots[s]) : [];
  // Any screens present in the capture set but not in SCREEN_ORDER: append them
  // so nothing is silently dropped when a new screen name appears.
  if (shots) {
    for (const s of Object.keys(shots)) {
      if (!SCREEN_ORDER.includes(s)) screens.push(s);
    }
  }

  if (screens.length) {
    const dir = join(SCREENSHOTS_DIR, locale);
    mkdirSync(dir, { recursive: true });
    screens.forEach((screen, i) => {
      const nn = String(i + 1).padStart(2, "0");
      copyFileSync(shots[screen], join(dir, `${nn}_${screen}.png`));
      totalFiles += 1;
    });
  }

  const status =
    screens.length === 0
      ? "NONE  (falls back to primary language on the store)"
      : screens.length >= SCREEN_ORDER.length
        ? "full"
        : `partial (${screens.length}/${SCREEN_ORDER.length})`;
  rows.push({ locale, count: screens.length, status, screens });
}

// ---- Report -----------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.locale.length), 6);
console.log(`\nScreenshots laid out in ${SCREENSHOTS_DIR}`);
console.log(`Source: ${CAPTURES_DIR}\n`);
console.log(`${"locale".padEnd(w)}  count  status`);
console.log(`${"-".repeat(w)}  -----  ------`);
for (const r of rows) {
  console.log(`${r.locale.padEnd(w)}  ${String(r.count).padStart(5)}  ${r.status}`);
}

const none = rows.filter((r) => r.count === 0).map((r) => r.locale);
const partial = rows.filter((r) => r.count > 0 && r.count < SCREEN_ORDER.length);
console.log(`\n${totalFiles} files across ${rows.filter((r) => r.count).length} locales.`);
if (partial.length) {
  console.log(
    `note: ${partial.length} locale(s) have fewer than ${SCREEN_ORDER.length} shots ` +
      `(${partial.map((r) => `${r.locale}:${r.count}`).join(", ")}). ` +
      `Each will show only those screenshots.`,
  );
}
if (none.length) {
  console.log(
    `note: no captures for ${none.join(", ")} — the App Store shows the primary ` +
      `language (en-US) screenshots for these until you add captures.`,
  );
}
console.log("\nNext: npm run release:ios:screenshots   (pushes via fastlane deliver)");
