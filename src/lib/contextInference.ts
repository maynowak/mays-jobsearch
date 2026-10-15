// ATS-RECENT-02: Context-aware skill inference with evidence integrity.
// Diese Methode analysiert den bearbeiteten CV-Text segmentweise,
// um sicherzustellen, dass Kompetenzen durch fachlich zusammenhängende
// Textstellen gestützt werden und keine falschen Schlüsse aus
// getrennten Absätzen oder Absichtserklärungen gezogen werden.

export interface SkillInference {
  key: string;
  skill: string;
  evidence: string;
  importance: 1 | 2 | 3;
}

/**
 * Prüft, ob ein Textsegment eine Negation, einen Lernwunsch oder eine
 * Zukunftsaussage enthält, die den Tätigkeitsnachweis entwertet.
 */
function isInvalidContext(text: string): boolean {
  const exclusions = [
    /keine erfahrung mit/i,
    /bisher nicht verwendet/i,
    /möchte lernen/i,
    /plane zu lernen/i,
    /interessiert an/i,
    /künftig einsetzen/i,
    /zertifizierung geplant/i,
    /weiterbildung vorgesehen/i,
    /lernen möchte/i,
    /will lernen/i,
  ];
  return exclusions.some(regex => regex.test(text));
}

/**
 * Prüft, ob ein Textsegment einen konkreten Tätigkeitsnachweis enthält.
 */
function hasActivityProof(text: string): boolean {
  const activityKeywords = [
    /entwickelt/i, /implementiert/i, /konzipiert/i, /administriert/i,
    /betrieben/i, /automatisiert/i, /bereitgestellt/i, /integriert/i,
    /entwicklung/i, /implementierung/i, /konzeption/i, /administration/i,
    /betrieb/i, /automatisierung/i, /bereitstellung/i, /integration/i,
    /erstellt/i, /gebaut/i, /optimiert/i, /gestaltet/i
  ];
  return activityKeywords.some(regex => regex.test(text));
}

/**
 * Extrahiert implizite Skills aus dem CV-Text basierend auf segmentierten Mustern.
 */
export function inferSkillsFromContext(contextText: string): SkillInference[] {
  if (!contextText?.trim()) return [];

  const results: SkillInference[] = [];
  
  // 1. Segmentierung: Text in Absätze und dann in Sätze/Aufzählungspunkte unterteilen.
  // Wir behandeln jeden Absatz als isolierte Einheit für die Inferenz.
  const paragraphs = contextText.split(/\n+/);

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    // Kontext-Check: Negationen oder Absichten schließen den gesamten Absatz aus
    if (isInvalidContext(trimmedPara)) continue;

    const t = trimmedPara.toLowerCase();

    // Backend Development
    const backendKeywords = ["java", "spring", "spring boot", "servlet", "jpa", "hibernate"];
    const hasJavaStack = backendKeywords.some(k => t.includes(k));
    if (hasJavaStack && /backend|backendentwicklung|neben.*java|java.*server/i.test(t) && hasActivityProof(trimmedPara)) {
      results.push({ 
        key: "backend-dev", 
        skill: "Backend-Entwicklung", 
        evidence: trimmedPara, 
        importance: 3 
      });
    }

    // API Development
    if (/rest.*api|api.*entwicklung|web.*api|api.*service/i.test(t) && hasActivityProof(trimmedPara)) {
      results.push({ 
        key: "api-dev", 
        skill: "API-Entwicklung", 
        evidence: trimmedPara, 
        importance: 2 
      });
    }

    // Frontend Development
    if (/frontend|frontendentwicklung|react|angular|vue/i.test(t) && /entwicklung/i.test(t) && hasActivityProof(trimmedPara)) {
      results.push({ 
        key: "frontend-dev", 
        skill: "Frontend-Entwicklung", 
        evidence: trimmedPara, 
        importance: 2 
      });
    }

    // Infrastructure as Code
    if ((/terraform/i.test(t) || /cloudformation/i.test(t)) && /aws|infrastruktur/i.test(t) && hasActivityProof(trimmedPara)) {
      results.push({ 
        key: "iac", 
        skill: "Infrastructure as Code", 
        evidence: trimmedPara, 
        importance: 3 
      });
    }

    // Containerisierung
    if (/docker/i.test(t) && /deploy|container|bereitstell|orchestration/i.test(t) && hasActivityProof(trimmedPara)) {
      results.push({ 
        key: "container", 
        skill: "Containerisierung", 
        evidence: trimmedPara, 
        importance: 2 
      });
    }

    // CI/CD
    if (/ci\/cd|continuous.*integration|continuous.*deployment/i.test(t) && hasActivityProof(trimmedPara)) {
      results.push({ 
        key: "cicd", 
        skill: "CI/CD", 
        evidence: trimmedPara, 
        importance: 3 
      });
    }

    // Datenbank-Entwicklung
    if (/(sql|postgresql|mysql|oracle|database|datenbank).*entwickl/i.test(t) || /db.*entwicklung/i.test(t)) {
      if (hasActivityProof(trimmedPara)) {
        results.push({ 
          key: "db-dev", 
          skill: "Datenbank-Entwicklung", 
          evidence: trimmedPara, 
          importance: 2 
        });
      }
    }
  }

  // Deduplizierung: Pro Skill nur den qualitativ hochwertigsten/kürzesten Beleg behalten.
  const uniqueResults = new Map<string, SkillInference>();
  for (const res of results) {
    const existing = uniqueResults.get(res.skill);
    if (!existing || res.importance > existing.importance || (res.importance === existing.importance && res.evidence.length < existing.evidence.length)) {
      uniqueResults.set(res.skill, res);
    }
  }

  return Array.from(uniqueResults.values());
}

/**
 * Kombiniert explizite Skills mit impliziten Inferenzen.
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
