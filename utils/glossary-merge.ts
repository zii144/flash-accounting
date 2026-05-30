import type {
  BuiltinGlossaryKey,
  GlossaryEntryView,
  GlossaryPreferences,
} from "@/types/glossary";
import {
  BUILTIN_GLOSSARY_DEFINITIONS,
  getLocalizedBuiltinTerms,
  glossaryLabelKey,
} from "@/utils/glossary-defaults";
import type { ResolvedLanguage } from "@/utils/formatting";
import type { SemanticPattern } from "@/utils/smart-consumption";

function buildBuiltinPatterns(
  preferences: GlossaryPreferences,
  resolveBuiltinLabel: (key: BuiltinGlossaryKey) => string,
  language: ResolvedLanguage,
): SemanticPattern[] {
  const patterns: SemanticPattern[] = [];

  for (const definition of BUILTIN_GLOSSARY_DEFINITIONS) {
    const override = preferences.builtinOverrides[definition.key];
    if (override?.disabled) {
      continue;
    }

    const defaultLabel = resolveBuiltinLabel(definition.key);
    const label = override?.label?.trim() || defaultLabel;
    const terms = Array.from(
      new Set([
        ...getLocalizedBuiltinTerms(definition.key, language),
        ...(override?.extraTerms ?? []),
        label,
      ]),
    );

    patterns.push({
      label,
      type: override?.type ?? definition.type,
      terms,
      activeHours: definition.activeHours,
    });
  }

  return patterns;
}

export function buildSemanticPatterns(
  preferences: GlossaryPreferences,
  resolveBuiltinLabel: (key: BuiltinGlossaryKey) => string,
  language: ResolvedLanguage,
): SemanticPattern[] {
  const customPatterns = preferences.customEntries.map((entry) => ({
    label: entry.label,
    type: entry.type,
    terms: Array.from(new Set([...entry.terms, entry.label])),
    activeHours: entry.activeHours,
  }));

  return [
    ...customPatterns,
    ...buildBuiltinPatterns(preferences, resolveBuiltinLabel, language),
  ];
}

export function buildGlossaryEntryViews(
  preferences: GlossaryPreferences,
  resolveBuiltinLabel: (key: BuiltinGlossaryKey) => string,
  language: ResolvedLanguage,
): { builtinEntries: GlossaryEntryView[]; customEntries: GlossaryEntryView[] } {
  const builtinEntries = BUILTIN_GLOSSARY_DEFINITIONS.map((definition) => {
    const override = preferences.builtinOverrides[definition.key];
    const defaultLabel = resolveBuiltinLabel(definition.key);
    const defaultTerms = getLocalizedBuiltinTerms(definition.key, language);
    const extraTerms = override?.extraTerms ?? [];
    const label = override?.label?.trim() || defaultLabel;
    const hasCustomization = Boolean(
      override?.label ||
        override?.extraTerms?.length ||
        override?.disabled ||
        override?.type,
    );

    return {
      id: definition.key,
      source: "builtin" as const,
      builtinKey: definition.key,
      label,
      defaultLabel,
      type: override?.type ?? definition.type,
      terms: Array.from(new Set([...defaultTerms, ...extraTerms, label])),
      defaultTerms,
      extraTerms,
      disabled: Boolean(override?.disabled),
      hasCustomization,
      activeHours: definition.activeHours,
    };
  });

  const customEntries = preferences.customEntries.map((entry) => ({
    id: entry.id,
    source: "custom" as const,
    label: entry.label,
    type: entry.type,
    terms: entry.terms,
    disabled: false,
    hasCustomization: true,
    activeHours: entry.activeHours,
  }));

  return { builtinEntries, customEntries };
}

export { glossaryLabelKey };
