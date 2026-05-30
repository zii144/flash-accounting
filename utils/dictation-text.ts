const DICTATION_PLACEHOLDER = /\uFFFC/g;

function isIosPlatform() {
  return process.env.EXPO_OS === "ios";
}

/**
 * iOS 16+ can deliver duplicated dictated text in controlled TextInput onChangeText
 * (e.g. "apple" becomes "appleapple"). Strip dictation placeholders and collapse
 * exact duplicate suffixes. See facebook/react-native#36045.
 */
export function normalizeIosDictationText(next: string, previous: string) {
  const cleaned = next.replace(DICTATION_PLACEHOLDER, "");

  if (!isIosPlatform() || !cleaned) {
    return cleaned;
  }

  if (previous.length > 0 && cleaned === `${previous}${previous}`) {
    return previous;
  }

  const half = Math.floor(cleaned.length / 2);
  if (half > 0 && cleaned.slice(0, half) === cleaned.slice(half)) {
    return cleaned.slice(0, half);
  }

  return cleaned;
}
