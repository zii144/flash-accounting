#!/usr/bin/env node
// Sync landing-page copy from the App Store metadata tree.
//
// fastlane/metadata/<locale>/*.txt is the single source of truth for all
// marketing copy (16 locales, final native text — see fastlane/TRANSLATION_STATUS.md).
// This script derives src/generated/content.json from it so the website never
// drifts from the store listing. Run automatically by `npm run dev` / `npm run build`.

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const METADATA_DIR = join(HERE, "..", "..", "fastlane", "metadata");
const OUT_FILE = join(HERE, "..", "src", "generated", "content.json");

// Website language code → App Store Connect locale folder.
// Order here is the order of the language picker.
const LOCALES = [
  { lang: "en", asc: "en-US", label: "English" },
  { lang: "zh-Hant", asc: "zh-Hant", label: "繁體中文" },
  { lang: "ja", asc: "ja", label: "日本語" },
  { lang: "ko", asc: "ko", label: "한국어" },
  { lang: "es", asc: "es-ES", label: "Español" },
  { lang: "fr", asc: "fr-FR", label: "Français" },
  { lang: "de", asc: "de-DE", label: "Deutsch" },
  { lang: "it", asc: "it", label: "Italiano" },
  { lang: "pt", asc: "pt-BR", label: "Português" },
  { lang: "ru", asc: "ru", label: "Русский" },
  { lang: "hi", asc: "hi", label: "हिन्दी" },
  { lang: "id", asc: "id", label: "Bahasa Indonesia" },
  { lang: "vi", asc: "vi", label: "Tiếng Việt" },
  { lang: "th", asc: "th", label: "ไทย" },
  { lang: "tr", asc: "tr", label: "Türkçe" },
  { lang: "pl", asc: "pl", label: "Polski" },
];

// Languages that have localized screenshots under public/shots/
// (captures/ios26-iphone17-pro-max exports; others fall back to English).
const SHOT_LANGS = ["en", "zh", "es", "fr", "de", "ja"];

function read(asc, field) {
  return readFileSync(join(METADATA_DIR, asc, `${field}.txt`), "utf8").trim();
}

// The store description is structured text: paragraphs separated by blank
// lines; every feature is one paragraph whose first line is a short title and
// the rest is the body. The trailing "16 languages" paragraph lists every
// language name, so filter it out by its invariant content.
function parseFeatures(description) {
  const paragraphs = description.split(/\r?\n\s*\n/);
  const features = [];
  for (const p of paragraphs) {
    const lines = p.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    if (p.includes("Polski")) continue; // the 16-language list block
    features.push({ title: lines[0], body: lines.slice(1).join(" ") });
  }
  return features;
}

if (!existsSync(METADATA_DIR)) {
  console.error(`sync-content: missing ${METADATA_DIR}`);
  console.error("Run from a full repo checkout (the website reuses fastlane metadata).");
  process.exit(1);
}

const locales = {};
for (const { lang, asc, label } of LOCALES) {
  const description = read(asc, "description");
  locales[lang] = {
    asc,
    label,
    name: read(asc, "name"),
    subtitle: read(asc, "subtitle"),
    promo: read(asc, "promotional_text"),
    hook: description.split(/\r?\n/, 1)[0],
    features: parseFeatures(description),
    shots: SHOT_LANGS.includes(lang.split("-")[0]) ? lang.split("-")[0] : "en",
  };
  if (locales[lang].features.length === 0) {
    console.warn(`sync-content: no features parsed for ${asc} — check description format`);
  }
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify({ locales }, null, 2) + "\n");
console.log(
  `sync-content: wrote ${Object.keys(locales).length} locales → src/generated/content.json`,
);
