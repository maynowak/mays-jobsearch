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
