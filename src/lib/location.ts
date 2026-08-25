export function parseGermanLocation(input: string): {
  street?: string;
  postalCode?: string;
  city?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) return {};

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length === 1) {
    const single = parts[0];
    const plzMatch = single.match(/^(\d{5})\s+(.+)$/);
    if (plzMatch) {
      return { postalCode: plzMatch[1], city: plzMatch[2] };
    }
    if (/^\d{5}$/.test(single)) {
      return { postalCode: single };
    }
    return { city: single };
  }

  if (parts.length === 2) {
    const first = parts[0];
    const second = parts[1];

    // Check if first part is a PLZ (5 digits) -> then it's "PLZ, City" format from array join
    if (/^\d{5}$/.test(first)) {
      return { postalCode: first, city: second };
    }

    const plzMatch = second.match(/^(\d{5})\s+(.+)$/);
    if (plzMatch) {
      return { street: first, postalCode: plzMatch[1], city: plzMatch[2] };
    }
    if (/^\d{5}$/.test(second)) {
      return { street: first, postalCode: second };
    }
    return { street: first, city: second };
  }

  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const plzMatch = last.match(/^(\d{5})\s+(.+)$/);
    if (plzMatch) {
      return {
        street: parts.slice(0, -1).join(", "),
        postalCode: plzMatch[1],
        city: plzMatch[2],
      };
    }
    if (/^\d{5}$/.test(last)) {
      return {
        street: parts.slice(0, -1).join(", "),
        postalCode: last,
      };
    }
    return { street: parts.slice(0, -1).join(", "), city: last };
  }

  return {};
}

export function formatGermanLocation(input: string | string[]): string {
  const joined = Array.isArray(input) ? input.join(", ") : input;
  const { street, postalCode, city } = parseGermanLocation(joined);

  if (street && postalCode && city) {
    return `${street}, ${postalCode} ${city}`;
  }
  if (postalCode && city) {
    return `${postalCode} ${city}`;
  }
  if (street && postalCode) {
    return `${street}, ${postalCode}`;
  }
  if (street && city) {
    return `${street}, ${city}`;
  }
  if (postalCode) {
    return postalCode;
  }
  if (city) {
    return city;
  }
  if (street) {
    return street;
  }
  return joined;
}