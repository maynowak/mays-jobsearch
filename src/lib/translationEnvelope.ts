/**
 * Defense in depth for translation responses. The API unwraps model JSON, but
 * a malformed upstream response must never surface raw `{"translation":"…"}`
 * syntax in the UI.
 */
export function unwrapTranslationEnvelope(value: string): string {
  const text = String(value ?? "").trim();
  if (!/^\{\s*"translation"\s*:/.test(text)) return text;
  const body = text.replace(/^\{\s*"translation"\s*:\s*/, "").replace(/\}\s*$/, "").trim();
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === "string") return parsed.trim();
  } catch {
    // fall through to quote stripping
  }
  return body.replace(/^"|"$/g, "").trim();
}


const UNPROCESSED_WRAPPER = /^(?:```(?:json)?\s*)?["']?\s*\{\s*\\?["']?translation\b/i;

/**
 * Strict display guard. The server owns parsing; the client only rejects an
 * obviously unprocessed wrapper so it can show the controlled error state and
 * keep the original description.
 */
export function normalizeTranslationForDisplay(value: string): string | null {
  const text = String(value ?? "").trim();
  if (!text || UNPROCESSED_WRAPPER.test(text)) return null;
  return text;
}
