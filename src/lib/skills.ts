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

export function parseSkills(input: string): string[] {
  if (!input?.trim()) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  // Split by comma/semicolon first; within each segment a "..." quoted
  // phrase counts as ONE token, the rest splits on whitespace.
  for (const segment of input.split(/[,;]+/)) {
    const seg = segment.trim();
    if (!seg) continue;
    const re = /"([^"]*)"|[^\s"]+/g;
    let m: RegExpExecArray | null;
    let matched = false;
    while ((m = re.exec(seg)) !== null) {
      matched = true;
      pushToken(result, seen, m[1] !== undefined ? m[1] : m[0]);
    }
    if (!matched) pushToken(result, seen, seg);
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

export function parseTargetRoles(input: string): string[] {
  if (!input?.trim()) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatTargetRoles(roles: string[]): string {
  return roles.join(", ");
}
