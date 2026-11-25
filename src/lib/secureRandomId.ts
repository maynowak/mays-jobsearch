/**
 * Session-scoped identifiers (search profiles, CV profile entries) are not
 * authentication tokens, but they are stable references that must not be
 * predictable or collide. Use a cryptographically secure source instead of
 * Math.random so CodeQL js/insecure-randomness stays clean and IDs remain
 * unique across tabs/sessions.
 *
 * The generated suffix keeps the existing `${prefix}-${timestamp}-${suffix}`
 * format, so persisted session data stays compatible.
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function secureRandomIdSuffix(length = 7): string {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("A secure random source is required for session identifiers.");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const byte of bytes) suffix += ALPHABET[byte % ALPHABET.length];
  return suffix;
}
