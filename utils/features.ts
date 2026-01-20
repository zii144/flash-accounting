/**
 * Feature announcements configuration
 * 
 * This file centralizes all feature announcements shown in the carousel.
 * This makes it easy to add, remove, or reorder features without touching
 * multiple files.
 * 
 * HOW TO ADD A NEW FEATURE:
 * 1. Add a new entry to FEATURES array below with:
 *    - id: unique identifier (kebab-case, e.g., "dark-mode-support")
 *    - icon: Ionicons icon name
 * 
 * 2. Add translation keys to LanguageContext.tsx for ALL languages:
 *    - "features.{id}.title": "Your Title"
 *    - "features.{id}.message": "Your message"
 * 
 *    Example:
 *    "features.dark-mode-support.title": "Dark Mode Support"
 *    "features.dark-mode-support.message": "We've added dark mode..."
 * 
 * 3. The feature will automatically appear in the carousel!
 * 
 * HOW TO REMOVE A FEATURE:
 * 1. Remove the entry from FEATURES array
 * 2. Optionally remove translation keys from LanguageContext.tsx
 *    (keeping them won't hurt, but cleaning up is recommended)
 * 
 * HOW TO REORDER FEATURES:
 * Simply reorder the items in the FEATURES array - order matters!
 */

import { Ionicons } from "@expo/vector-icons";

export interface FeatureConfig {
  /** Unique identifier for the feature (used for translation keys) */
  id: string;
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * List of feature announcements to display in the carousel
 * Order matters - features are displayed in this order
 */
export const FEATURES: FeatureConfig[] = [
  {
    id: "new-features",
    icon: "sparkles-outline",
  },
  {
    id: "enhanced-analytics",
    icon: "analytics-outline",
  },
  {
    id: "export-improvements",
    icon: "download-outline",
  },
];

/**
 * Get translation keys for a feature
 */
export function getFeatureTranslationKeys(id: string) {
  return {
    titleKey: `features.${id}.title`,
    messageKey: `features.${id}.message`,
  };
}
