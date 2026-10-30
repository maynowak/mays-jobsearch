function pushToken(result: string[], seen: Set<string>, token: string): void {
  // Strip one pair of surrounding double quotes (formatting artifact),
  // keep interior characters untouched.
  const cleaned = token.trim().replace(/^"(.*)"$/s, "$1").trim();
  if (!cleaned) return;
  const lower = cleaned.toLowerCase();
  if (!seen.has(lower)) {
    seen.add(lower);
    result.push(cleaned);
  }
}

const OPEN_GROUPS = new Set(["(", "[", "{"]);
const CLOSE_GROUPS = new Map([["(", ")"], ["[", "]"], ["{", "}"]]);

function splitListSegments(input: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote = false;
  const groups: string[] = [];

  for (const char of input) {
    if (char === '"') quote = !quote;
    if (!quote && OPEN_GROUPS.has(char)) groups.push(char);
    if (!quote && groups.length > 0) {
      const expected = CLOSE_GROUPS.get(groups.at(-1) ?? "");
      if (expected === char) groups.pop();
    }
    if (!quote && groups.length === 0 && (char === "," || char === ";" || char === "\n")) {
      segments.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  segments.push(current);
  return segments;
}

function tokenizeSegment(segment: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote = false;
  const groups: string[] = [];

  const flush = () => {
    if (current.trim()) tokens.push(current.trim());
    current = "";
  };

  for (const char of segment.trim()) {
    if (char === '"') {
      quote = !quote;
      current += char;
      continue;
    }
    if (!quote && OPEN_GROUPS.has(char)) groups.push(char);
    if (!quote && groups.length > 0) {
      const expected = CLOSE_GROUPS.get(groups.at(-1) ?? "");
      if (expected === char) groups.pop();
    }
    if (!quote && groups.length === 0 && /\s/.test(char)) flush();
    else current += char;
  }
  flush();
  return tokens;
}

export function parseSkills(input: string): string[] {
  if (!input?.trim()) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const segment of splitListSegments(input)) {
    for (const token of tokenizeSegment(segment)) pushToken(result, seen, token);
  }

  return result;
}

export function formatSkills(skills: string[]): string {
  return skills
    .map((s) => {
      const cleaned = String(s ?? "").trim().replace(/"/g, "");
      if (!cleaned) return "";
      // Quote tokens containing whitespace/separators so they round-trip
      // through parseSkills as a single token.
      return /[\s,;]/.test(cleaned) ? `"${cleaned}"` : cleaned;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * MAYS-SEARCH-PROFILE-MANUAL-01: Phrase-preserving list parser.
 *
 * Trennt ausschliesslich an Komma/Semikolon/Zeilenumbruch (ausserhalb von
 * Quotes/Klammern) und behandelt jedes Segment als EINEN Begriff. Damit bleiben
 * manuell erfasste Begriffe wie "Cloud Architecture" oder "ISO 27001" zusammen,
 * ohne dass der bestehende `parseSkills`-Whitespace-Vertrag geaendert wird.
 */
export function parsePhraseList(input: string): string[] {
  if (!input?.trim()) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const segment of splitListSegments(input)) pushToken(result, seen, segment);
  return result;
}

export function parseTargetRoles(input: string): string[] {
  return parsePhraseList(input);
}

export function formatTargetRoles(roles: string[]): string {
  return roles.join(", ");
}
