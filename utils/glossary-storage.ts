import type {
  BuiltinGlossaryKey,
  CustomGlossaryEntry,
  GlossaryPreferences,
} from "@/types/glossary";
import { BUILTIN_GLOSSARY_KEYS } from "@/types/glossary";
import { DEFAULT_GLOSSARY_PREFERENCES } from "@/utils/glossary-defaults";
import { STORAGE_KEYS } from "@/utils/constants";
import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeTerms(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const terms: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.slice(0, 64);
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    terms.push(normalized);
  }

  return terms.slice(0, 24);
}

function sanitizeCustomEntry(value: unknown): CustomGlossaryEntry | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string") {
    return null;
  }

  const label = value.label.trim().slice(0, 48);
  if (!label) {
    return null;
  }

  const type = value.type === "income" ? "income" : "expense";
  const terms = sanitizeTerms(value.terms);
  if (terms.length === 0) {
    return null;
  }

  let activeHours: [number, number] | undefined;
  if (Array.isArray(value.activeHours) && value.activeHours.length === 2) {
    const start = Number(value.activeHours[0]);
    const end = Number(value.activeHours[1]);
    if (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      start <= 23 &&
      end >= 0 &&
      end <= 23
    ) {
      activeHours = [start, end];
    }
  }

  return {
    id: value.id,
    label,
    type,
    terms,
    activeHours,
  };
}

function sanitizeBuiltinOverrides(
  value: unknown,
): GlossaryPreferences["builtinOverrides"] {
  if (!isRecord(value)) {
    return {};
  }

  const overrides: GlossaryPreferences["builtinOverrides"] = {};

  for (const key of BUILTIN_GLOSSARY_KEYS) {
    const raw = value[key];
    if (!isRecord(raw)) {
      continue;
    }

    const label =
      typeof raw.label === "string" ? raw.label.trim().slice(0, 48) : undefined;
    const extraTerms = sanitizeTerms(raw.extraTerms);
    const disabled = raw.disabled === true;
    const type = raw.type === "income" ? "income" : raw.type === "expense" ? "expense" : undefined;

    if (!label && extraTerms.length === 0 && !disabled && !type) {
      continue;
    }

    overrides[key] = {
      ...(label ? { label } : {}),
      ...(extraTerms.length > 0 ? { extraTerms } : {}),
      ...(disabled ? { disabled: true } : {}),
      ...(type ? { type } : {}),
    };
  }

  return overrides;
}

export function sanitizeGlossaryPreferences(value: unknown): GlossaryPreferences {
  if (!isRecord(value)) {
    return DEFAULT_GLOSSARY_PREFERENCES;
  }

  const customEntries = Array.isArray(value.customEntries)
    ? value.customEntries
        .map(sanitizeCustomEntry)
        .filter((entry): entry is CustomGlossaryEntry => Boolean(entry))
        .slice(0, 40)
    : [];

  return {
    version: 1,
    builtinOverrides: sanitizeBuiltinOverrides(value.builtinOverrides),
    customEntries,
  };
}

export async function loadGlossaryPreferences(): Promise<GlossaryPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.GLOSSARY);
    if (!raw) {
      return DEFAULT_GLOSSARY_PREFERENCES;
    }
    return sanitizeGlossaryPreferences(JSON.parse(raw));
  } catch (error) {
    logger.error("Failed to load glossary preferences", error);
    return DEFAULT_GLOSSARY_PREFERENCES;
  }
}

export async function saveGlossaryPreferences(
  preferences: GlossaryPreferences,
): Promise<GlossaryPreferences> {
  const sanitized = sanitizeGlossaryPreferences(preferences);
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.GLOSSARY, JSON.stringify(sanitized));
  } catch (error) {
    logger.error("Failed to save glossary preferences", error);
    throw error;
  }
  return sanitized;
}

export function clearBuiltinOverride(
  preferences: GlossaryPreferences,
  key: BuiltinGlossaryKey,
): GlossaryPreferences {
  const nextOverrides = { ...preferences.builtinOverrides };
  delete nextOverrides[key];
  return {
    ...preferences,
    builtinOverrides: nextOverrides,
  };
}

export function createCustomEntryId() {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
