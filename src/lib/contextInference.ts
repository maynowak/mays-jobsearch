// ATS-RECENT-01: Context-aware skill inference for CV processing.
// Diese Methode analysiert den bearbeiteten CV-Text und extrahiert
// Kompetenzen aus klaren Tätigkeitsbeschreibungen.

export interface SkillInference {
  key: string;
  skill: string;
  evidence: string;
  importance: 1 | 2 | 3;
}

/**
 * Extrahiert implizite Skills aus dem CV-Text basierend auf Tätigkeitsmustern.
 * Alle Inferenzen benötigen konkrete Textbelege aus dem CV.
 */
export function inferSkillsFromContext(contextText: string): SkillInference[] {
  if (!contextText?.trim()) return [];

  const results: SkillInference[] = [];
  const seen = new Set<string>();

  const add = (skill: string, evidence: string, importance: 1 | 2 | 3 = 2) => {
    const key = `${skill.toLowerCase()}-${evidence.toLowerCase().slice(0, 30)}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ key, skill, evidence, importance });
    }
  };

  const t = contextText.toLowerCase();

  // Backend Development aus Java-Spring-Tokens
  const backendKeywords = ["java", "spring", "spring boot", "servlet", "jpa", "hibernate"];
  const hasJavaStack = backendKeywords.some(k => t.includes(k));
  if (hasJavaStack && /backend|backendentwicklung|neben.*java|java.*server/i.test(t)) {
    add("Backend-Entwicklung", "Backend-Entwicklung mit Java/Spring", 3);
  }

  // API Development
  if (/rest.*api|api.*entwicklung|web.*api|api.*service/i.test(t)) {
    add("API-Entwicklung", "Entwicklung von REST-APIs", 2);
  }

  // Frontend Development
  if (/frontend|frontendentwicklung|react|angular|vue/i.test(t) && /entwicklung/i.test(t)) {
    add("Frontend-Entwicklung", "Frontend-Entwicklung", 2);
  }

  // Infrastructure as Code
  if ((/terraform/i.test(t) || /cloudformation/i.test(t)) && /aws|infrastruktur/i.test(t)) {
    add("Infrastructure as Code", "Infrastructure as Code mit Terraform/CloudFormation", 3);
  }

  // Containerisierung
  if (/docker/i.test(t) && /deploy|container|bereitstell|orchestration/i.test(t)) {
    add("Containerisierung", "Docker-basierte Bereitstellung", 2);
  }

  // CI/CD
  if (/ci\/cd|continuous.*integration|continuous.*deployment/i.test(t)) {
    add("CI/CD", "CI/CD-Pipeline-Implementierung", 3);
  }

  // Datenbank-Entwicklung
  if (/(sql|postgresql|mysql|oracle|database|datenbank).*entwickl/i.test(t) || /db.*entwicklung/i.test(t)) {
    add("Datenbank-Entwicklung", "Entwicklung mit Datenbanken/SQL", 2);
  }

  return results;
}

/**
 * Kombiniert explizite Skills mit impliziten Inferenzen.
 * Explizite Skills aus SuggestedProfile bleiben unverändert.
 */
export function combineExplicitAndImplicitSkills(
  explicitSkills: string[],
  contextText: string,
  maxImplicit: number = 5
): { explicit: string[]; implicit: SkillInference[] } {
  const normalizedExplicit = new Set(explicitSkills.map(s => s.toLowerCase()));
  const implicit = inferSkillsFromContext(contextText)
    .filter(i => !normalizedExplicit.has(i.skill.toLowerCase()));

  return { explicit: explicitSkills, implicit: implicit.slice(0, maxImplicit) };
}
