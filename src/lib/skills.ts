export function parseSkills(input: string): string[] {
  if (!input?.trim()) return [];
  
  // Split by space, comma, or semicolon
  const parts = input.split(/[\s,;]+/);
  
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
  return skills.join(" ");
}