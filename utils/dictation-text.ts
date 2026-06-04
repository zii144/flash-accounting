const DICTATION_PLACEHOLDER = /\uFFFC/g;

/**
 * iOS dictation can insert object replacement placeholders into controlled
 * TextInput values. Remove only that sentinel while preserving typed text;
 * CJK IMEs can briefly produce repeated composition text that must not be
 * collapsed during live typing.
 */
export function normalizeIosDictationText(next: string, previous: string) {
  void previous;
  return next.replace(DICTATION_PLACEHOLDER, "");
}
