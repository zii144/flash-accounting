import { getFirst, run } from './db';
import { FEATURES } from './features';
import { logger } from './logger';

const FEATURE_CAROUSEL_KEY = 'feature_carousel_dismissed_version';

/**
 * Generates a version hash from the current features list
 * This hash changes when features are added, removed, or reordered
 */
function generateFeaturesVersion(): string {
  // Create a simple hash from feature IDs and order
  const featureIds = FEATURES.map(f => f.id).join(',');
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < featureIds.length; i++) {
    const char = featureIds.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${FEATURES.length}-${Math.abs(hash).toString(36)}`;
}

/**
 * Gets the dismissed features version from database
 */
export async function getDismissedFeaturesVersion(): Promise<string | null> {
  try {
    const result = await getFirst<{ value: string }>(
      'SELECT value FROM db_metadata WHERE key = ?',
      [FEATURE_CAROUSEL_KEY]
    );
    return result?.value || null;
  } catch (error) {
    logger.error('Failed to get dismissed features version', error);
    return null;
  }
}

/**
 * Saves the dismissed features version to database
 */
export async function setDismissedFeaturesVersion(version: string): Promise<void> {
  try {
    await run(
      'INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)',
      [FEATURE_CAROUSEL_KEY, version]
    );
  } catch (error) {
    logger.error('Failed to save dismissed features version', error);
    throw error;
  }
}

/**
 * Checks if the carousel should be shown
 * Returns true if:
 * - Never dismissed before, OR
 * - Current features version differs from dismissed version (new features added)
 */
export async function shouldShowFeatureCarousel(): Promise<boolean> {
  try {
    const currentVersion = generateFeaturesVersion();
    const dismissedVersion = await getDismissedFeaturesVersion();
    
    // Show if never dismissed or if version changed (new features)
    return dismissedVersion === null || dismissedVersion !== currentVersion;
  } catch (error) {
    logger.error('Failed to check carousel visibility', error);
    // On error, show the carousel to be safe
    return true;
  }
}

/**
 * Marks the carousel as dismissed with current features version
 */
export async function dismissFeatureCarousel(): Promise<void> {
  try {
    const currentVersion = generateFeaturesVersion();
    await setDismissedFeaturesVersion(currentVersion);
  } catch (error) {
    logger.error('Failed to dismiss carousel', error);
    throw error;
  }
}

/**
 * Gets the current features version (for debugging/testing)
 */
export function getCurrentFeaturesVersion(): string {
  return generateFeaturesVersion();
}
