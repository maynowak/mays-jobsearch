const TRANSLATION_WRAPPER = /^(?:```(?:json)?\s*)?["']?\s*\{\s*\\?["']?translation\b/i;

/**
 * Defensive client guard only. The server owns bounded translation parsing;
 * this function prevents an obviously unprocessed wrapper from being rendered
 * if a provider or an older deployment returns one.
 */
export function isUnprocessedTranslationWrapper(value: string): boolean {
  const text = String(value ?? "").trim();
  return Boolean(text) && TRANSLATION_WRAPPER.test(text);
}

export function normalizeTranslationForDisplay(value: string): string | null {
  const text = String(value ?? "").trim();
  if (!text || isUnprocessedTranslationWrapper(text)) return null;
  return text;
}
