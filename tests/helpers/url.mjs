/**
 * Test helper: compare a request URL by its parsed hostname instead of a
 * substring. `url.includes("trusted.example")` would also accept
 * "https://trusted.example.attacker.test/", so test mocks and assertions must
 * use an exact hostname comparison.
 */
export function hostnameOf(url) {
  try {
    const parsed = new URL(String(url));
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isHostname(url, expected) {
  return hostnameOf(url) === String(expected).toLowerCase();
}
