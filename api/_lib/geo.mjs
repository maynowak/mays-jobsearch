import { cacheGet, cacheSet } from "./cache.mjs";

// Nominatim (OpenStreetMap) geocoding for the radius (Umkreis) search.
// Free, no registration. Usage policy: valid User-Agent, max ~1 req/sec,
// cache results. All failures are best-effort -> null (callers fall back
// to the existing substring behavior).

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MaysJobMatcher/1.0 (https://github.com/maynowak/mays-jobsearch)";
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_SEC = 30 * 24 * 60 * 60; // city coordinates barely change

function cacheKey(city) {
  return `geo:city:${city.trim().toLowerCase()}`;
}

function isValidCoord(lat, lon) {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

/**
 * Resolves a city name to coordinates via Nominatim (cached).
 * @param {string} city - e.g. "München"
 * @returns {Promise<{lat: number, lon: number}|null>}
 */
export async function geocodeCity(city) {
  const name = String(city || "").trim();
  if (!name) return null;

  try {
    const cached = await cacheGet(cacheKey(name));
    if (cached && isValidCoord(Number(cached.lat), Number(cached.lon))) {
      return { lat: Number(cached.lat), lon: Number(cached.lon) };
    }
  } catch {
    // Cache failures must never break search; fall through to live lookup.
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url =
      `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!first || !isValidCoord(lat, lon)) return null;
    const result = { lat, lon };
    try {
      await cacheSet(cacheKey(name), result, CACHE_TTL_SEC);
    } catch {
      // Best-effort cache only.
    }
    return result;
  } catch (err) {
    console.error("[geo] Geocoding failed for city:", name, err?.message || err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Great-circle distance in kilometers (haversine).
 * Upgrade point: per-job radius filtering once jobs carry coordinates.
 */
export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(h));
}
