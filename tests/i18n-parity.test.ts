import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  GLOSSARY_TRANSLATION_DE,
  GLOSSARY_TRANSLATION_EN,
  GLOSSARY_TRANSLATION_ES,
  GLOSSARY_TRANSLATION_FR,
  GLOSSARY_TRANSLATION_HI,
  GLOSSARY_TRANSLATION_ID,
  GLOSSARY_TRANSLATION_IT,
  GLOSSARY_TRANSLATION_JA,
  GLOSSARY_TRANSLATION_KO,
  GLOSSARY_TRANSLATION_PL,
  GLOSSARY_TRANSLATION_PT,
  GLOSSARY_TRANSLATION_RU,
  GLOSSARY_TRANSLATION_TH,
  GLOSSARY_TRANSLATION_TR,
  GLOSSARY_TRANSLATION_VI,
  GLOSSARY_TRANSLATION_ZH,
} from "../utils/glossary-i18n";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Every language the app claims to support. Adding a language means adding it
// here and giving it a full translation set; this test enforces that.
const EXPECTED_LANGUAGES = [
  "en",
  "zh",
  "es",
  "fr",
  "de",
  "ja",
  "hi",
  "pt",
  "ru",
  "id",
  "ko",
  "it",
  "tr",
  "vi",
  "th",
  "pl",
] as const;

/**
 * The `translations` object lives inside LanguageContext.tsx, which cannot be
 * imported under node (it pulls in React Native modules). Parse its per-language
 * key sets straight from the source instead.
 */
function extractTranslationKeySets(): Record<string, Set<string>> {
  const src = fs
    .readFileSync(path.join(ROOT, "contexts/LanguageContext.tsx"), "utf8")
    .split("\n");
  const start = src.findIndex((line) => /^const translations:/.test(line));
  assert.ok(start >= 0, "Could not locate the translations object");

  let end = -1;
  for (let i = start + 1; i < src.length; i++) {
    if (/^};/.test(src[i])) {
      end = i;
      break;
    }
  }
  assert.ok(end > start, "Could not locate the end of the translations object");

  const sets: Record<string, Set<string>> = {};
  let current: string | null = null;
  for (let i = start; i <= end; i++) {
    const line = src[i];
    const langMatch = line.match(/^ {2}([a-z]{2}): \{/);
    if (langMatch) {
      current = langMatch[1];
      sets[current] = new Set();
      continue;
    }
    if (/^ {2}\},?$/.test(line)) {
      current = null;
      continue;
    }
    if (current) {
      const keyMatch = line.match(/^ {4}([A-Za-z0-9_]+):/);
      if (keyMatch) {
        sets[current].add(keyMatch[1]);
      }
    }
  }
  return sets;
}

function assertParity(label: string, sets: Record<string, Set<string>>) {
  for (const lang of EXPECTED_LANGUAGES) {
    assert.ok(sets[lang], `${label}: missing language block "${lang}"`);
  }
  assert.deepEqual(
    Object.keys(sets).sort(),
    [...EXPECTED_LANGUAGES].sort(),
    `${label}: language set does not match EXPECTED_LANGUAGES`,
  );

  const reference = sets.en;
  assert.ok(reference.size > 0, `${label}: English reference set is empty`);

  for (const lang of EXPECTED_LANGUAGES) {
    if (lang === "en") continue;
    const keys = sets[lang];
    const missing = [...reference].filter((key) => !keys.has(key)).sort();
    const extra = [...keys].filter((key) => !reference.has(key)).sort();
    assert.deepEqual(missing, [], `${label}: "${lang}" is missing keys: ${missing.join(", ")}`);
    assert.deepEqual(extra, [], `${label}: "${lang}" has unknown keys: ${extra.join(", ")}`);
  }
}

test("UI translations have full key parity across every supported language", () => {
  const sets = extractTranslationKeySets();
  assertParity("translations", sets);
});

test("glossary translations have full key parity across every supported language", () => {
  const byLang: Record<string, Record<string, string>> = {
    en: GLOSSARY_TRANSLATION_EN,
    zh: GLOSSARY_TRANSLATION_ZH,
    es: GLOSSARY_TRANSLATION_ES,
    fr: GLOSSARY_TRANSLATION_FR,
    de: GLOSSARY_TRANSLATION_DE,
    ja: GLOSSARY_TRANSLATION_JA,
    hi: GLOSSARY_TRANSLATION_HI,
    pt: GLOSSARY_TRANSLATION_PT,
    ru: GLOSSARY_TRANSLATION_RU,
    id: GLOSSARY_TRANSLATION_ID,
    ko: GLOSSARY_TRANSLATION_KO,
    it: GLOSSARY_TRANSLATION_IT,
    tr: GLOSSARY_TRANSLATION_TR,
    vi: GLOSSARY_TRANSLATION_VI,
    th: GLOSSARY_TRANSLATION_TH,
    pl: GLOSSARY_TRANSLATION_PL,
  };
  const sets: Record<string, Set<string>> = {};
  for (const [lang, dict] of Object.entries(byLang)) {
    sets[lang] = new Set(Object.keys(dict));
  }
  assertParity("glossary", sets);
});
