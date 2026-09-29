export function parseSkills(input: string): string[] {
  if (!input?.trim()) return [];

  // Split by comma or semicolon only — never by whitespace, so multi-word
  // skills ("Spring Boot") survive display/submit round-trips as one skill.
  // Whitespace-separated input still works: the API/backend tokenizes it.
  const parts = input.split(/[,;]+/);
  
  // Trim, lowercase for deduplication, preserve original case for display
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed); // preserve original case
    }
  }
  
  return result;
}

export function formatSkills(skills: string[]): string {
  return skills.join(", ");
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