/** Trim empty public env values. Pass `process.env.EXPO_PUBLIC_*` directly for production inlining. */
export function normalizePublicEnv(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}
