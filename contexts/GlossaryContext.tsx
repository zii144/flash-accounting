import { useLanguage } from "@/contexts/LanguageContext";
import type { Consumption } from "@/types/consumption";
import type {
  BuiltinGlossaryKey,
  BuiltinGlossaryOverride,
  CustomGlossaryEntry,
  GlossaryEntryView,
  GlossaryPreferences,
} from "@/types/glossary";
import { DEFAULT_GLOSSARY_PREFERENCES } from "@/utils/glossary-defaults";
import {
  buildGlossaryEntryViews,
  buildSemanticPatterns,
  glossaryLabelKey,
} from "@/utils/glossary-merge";
import {
  clearBuiltinOverride,
  createCustomEntryId,
  loadGlossaryPreferences,
  saveGlossaryPreferences,
} from "@/utils/glossary-storage";
import type { ConsumptionSuggestion } from "@/utils/smart-consumption";
import {
  canonicalizeConsumptionLabel,
  getConsumptionSuggestions,
  type SemanticPattern,
} from "@/utils/smart-consumption";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type GlossaryContextType = {
  isReady: boolean;
  preferences: GlossaryPreferences;
  patterns: SemanticPattern[];
  activeEntryCount: number;
  builtinEntries: GlossaryEntryView[];
  customEntries: GlossaryEntryView[];
  resolveBuiltinLabel: (key: BuiltinGlossaryKey) => string;
  canonicalizeLabel: (description: string) => string;
  getSuggestions: (
    input: string,
    history?: Consumption[],
    now?: Date,
  ) => ConsumptionSuggestion[];
  updateBuiltinOverride: (
    key: BuiltinGlossaryKey,
    patch: BuiltinGlossaryOverride,
  ) => Promise<void>;
  resetBuiltinOverride: (key: BuiltinGlossaryKey) => Promise<void>;
  upsertCustomEntry: (entry: CustomGlossaryEntry) => Promise<void>;
  deleteCustomEntry: (id: string) => Promise<void>;
  resetAllPreferences: () => Promise<void>;
};

const GlossaryContext = createContext<GlossaryContextType | undefined>(undefined);

function mergeBuiltinOverride(
  preferences: GlossaryPreferences,
  key: BuiltinGlossaryKey,
  patch: BuiltinGlossaryOverride,
): GlossaryPreferences {
  const current = preferences.builtinOverrides[key] ?? {};
  const merged: BuiltinGlossaryOverride = { ...current, ...patch };

  if (merged.label === "") {
    delete merged.label;
  }
  if (merged.extraTerms?.length === 0) {
    delete merged.extraTerms;
  }
  if (!merged.disabled) {
    delete merged.disabled;
  }

  const hasValues =
    merged.label || merged.extraTerms?.length || merged.disabled || merged.type;

  const nextOverrides = { ...preferences.builtinOverrides };
  if (hasValues) {
    nextOverrides[key] = merged;
  } else {
    delete nextOverrides[key];
  }

  return {
    ...preferences,
    builtinOverrides: nextOverrides,
  };
}

export function GlossaryProvider({ children }: { children: React.ReactNode }) {
  const { resolvedLanguage, t } = useLanguage();
  const [preferences, setPreferences] = useState(DEFAULT_GLOSSARY_PREFERENCES);
  const [isHydrated, setIsHydrated] = useState(false);
  const preferencesRef = useRef(preferences);

  const isReady = isHydrated;
  const unlabeledLabel = t("unlabeled");

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let mounted = true;

    loadGlossaryPreferences()
      .then((loaded) => {
        if (!mounted) {
          return;
        }
        preferencesRef.current = loaded;
        setPreferences(loaded);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        preferencesRef.current = DEFAULT_GLOSSARY_PREFERENCES;
        setPreferences(DEFAULT_GLOSSARY_PREFERENCES);
      })
      .finally(() => {
        if (mounted) {
          setIsHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const resolveBuiltinLabel = useCallback(
    (key: BuiltinGlossaryKey) => t(glossaryLabelKey(key)),
    [t],
  );

  const patterns = useMemo(
    () => buildSemanticPatterns(preferences, resolveBuiltinLabel, resolvedLanguage),
    [preferences, resolveBuiltinLabel, resolvedLanguage],
  );

  const { builtinEntries, customEntries } = useMemo(
    () => buildGlossaryEntryViews(preferences, resolveBuiltinLabel, resolvedLanguage),
    [preferences, resolveBuiltinLabel, resolvedLanguage],
  );

  const activeEntryCount = useMemo(
    () =>
      builtinEntries.filter((entry) => !entry.disabled).length + customEntries.length,
    [builtinEntries, customEntries],
  );

  const persist = useCallback(async (updater: (current: GlossaryPreferences) => GlossaryPreferences) => {
    const current = preferencesRef.current;
    if (!current) {
      return;
    }

    const next = updater(current);
    const saved = await saveGlossaryPreferences(next);
    preferencesRef.current = saved;
    setPreferences(saved);
  }, []);

  const updateBuiltinOverride = useCallback(
    async (key: BuiltinGlossaryKey, patch: BuiltinGlossaryOverride) => {
      await persist((current) => mergeBuiltinOverride(current, key, patch));
    },
    [persist],
  );

  const resetBuiltinOverride = useCallback(
    async (key: BuiltinGlossaryKey) => {
      await persist((current) => clearBuiltinOverride(current, key));
    },
    [persist],
  );

  const upsertCustomEntry = useCallback(
    async (entry: CustomGlossaryEntry) => {
      await persist((current) => {
        const existingIndex = current.customEntries.findIndex((item) => item.id === entry.id);
        const customEntries =
          existingIndex >= 0
            ? current.customEntries.map((item, index) =>
                index === existingIndex ? entry : item,
              )
            : [...current.customEntries, entry];

        return {
          ...current,
          customEntries,
        };
      });
    },
    [persist],
  );

  const deleteCustomEntry = useCallback(
    async (id: string) => {
      await persist((current) => ({
        ...current,
        customEntries: current.customEntries.filter((entry) => entry.id !== id),
      }));
    },
    [persist],
  );

  const resetAllPreferences = useCallback(async () => {
    const saved = await saveGlossaryPreferences(DEFAULT_GLOSSARY_PREFERENCES);
    preferencesRef.current = saved;
    setPreferences(saved);
  }, []);

  const canonicalizeLabel = useCallback(
    (description: string) =>
      canonicalizeConsumptionLabel(description, patterns, unlabeledLabel),
    [patterns, unlabeledLabel],
  );

  const getSuggestions = useCallback(
    (input: string, history: Consumption[] = [], now: Date = new Date()) =>
      getConsumptionSuggestions(input, history, now, patterns),
    [patterns],
  );

  const value = useMemo(
    () => ({
      isReady,
      preferences,
      patterns,
      activeEntryCount,
      builtinEntries,
      customEntries,
      resolveBuiltinLabel,
      canonicalizeLabel,
      getSuggestions,
      updateBuiltinOverride,
      resetBuiltinOverride,
      upsertCustomEntry,
      deleteCustomEntry,
      resetAllPreferences,
    }),
    [
      isReady,
      preferences,
      patterns,
      activeEntryCount,
      builtinEntries,
      customEntries,
      resolveBuiltinLabel,
      canonicalizeLabel,
      getSuggestions,
      updateBuiltinOverride,
      resetBuiltinOverride,
      upsertCustomEntry,
      deleteCustomEntry,
      resetAllPreferences,
    ],
  );

  return (
    <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>
  );
}

export function useGlossary() {
  const context = useContext(GlossaryContext);
  if (!context) {
    throw new Error("useGlossary must be used within GlossaryProvider");
  }
  return context;
}

export { createCustomEntryId };
