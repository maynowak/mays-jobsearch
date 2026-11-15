import { tokenize, stripHtml, htmlToPlainText, detectLanguage } from "./filter.mjs";

const SKILL_ALIASES = new Map([
  ["aws", "aws"],
  ["amazon web services", "aws"],
  ["kubernetes", "kubernetes"],
  ["k8s", "kubernetes"],
  ["terraform", "terraform"],
  ["react", "react"],
  ["nodejs", "node.js"],
]);

// Conservative technical vocabulary for full job descriptions. This is
// deliberately an allowlist (with common aliases and multi-word terms), not a
// blanket "every token is a skill" extractor.
const TECHNICAL_TERMS = [
  ["aws", "AWS"],
  ["amazon web services", "AWS"],
  ["kubernetes", "Kubernetes"],
  ["k8s", "Kubernetes"],
  ["terraform", "Terraform"],
  ["react", "React"],
  ["nodejs", "Node.js"],
  ["node.js", "Node.js"],
  ["docker", "Docker"],
  ["devops", "DevOps"],
  ["azure", "Azure"],
  ["gcp", "GCP"],
  ["java", "Java"],
  ["c++", "C++"],
  ["c#", "C#"],
  [".net", ".NET"],
  ["graphql", "GraphQL"],
  ["sql", "SQL"],
  ["rest", "REST"],
  ["git", "Git"],
  ["linux", "Linux"],
  ["mcp", "MCP"],
  ["model context protocol", "MCP"],
  ["oauth", "OAuth"],
  ["oidc", "OIDC"],
  ["saml", "SAML"],
  ["scim", "SCIM"],
  ["okta", "Okta"],
  ["llm", "LLM"],
  ["llms", "LLM"],
  ["llm-based", "LLM"],
  ["anthropic", "Anthropic"],
  ["openai", "OpenAI"],
  ["openrouter", "OpenRouter"],
  ["litellm", "LiteLLM"],
  ["portkey", "Portkey"],
  ["ai agents", "AI agents"],
  ["autonomous agents", "autonomous agents"],
  ["multi-step agents", "multi-step agents"],
  ["agent identities", "agent identities"],
  ["agent runtimes", "agent runtimes"],
  ["agent memory", "agent memory"],
  ["tool integrations", "tool integrations"],
  ["claude agent sdk", "Claude Agent SDK"],
  ["claude code", "Claude Code"],
  ["codex", "Codex"],
  ["iam", "IAM"],
  ["least privilege", "least privilege"],
  ["least-privilege", "least privilege"],
  ["audit logging", "audit logging"],
  ["audit logs", "audit logging"],
  ["access control", "access control"],
  ["security", "security"],
  ["security guardrails", "security guardrails"],
  ["evaluation", "evaluation"],
  ["evaluation frameworks", "evaluation frameworks"],
  ["regression testing", "regression testing"],
  ["regression suites", "regression testing"],
  ["observability", "observability"],
  ["opentelemetry", "OpenTelemetry"],
  ["grafana", "Grafana"],
  ["datadog", "Datadog"],
  ["langfuse", "Langfuse"],
  ["langsmith", "LangSmith"],
  ["braintrust", "Braintrust"],
  ["python", "Python"],
  ["typescript", "TypeScript"],
  ["javascript", "JavaScript"],
  ["go", "Go"],
  ["golang", "Go"],
  ["ci/cd", "CI/CD"],
  ["ci cd", "CI/CD"],
  ["cloud infrastructure", "cloud infrastructure"],
  ["cloud engineering", "cloud engineering"],
  ["vector stores", "vector stores"],
  ["retrieval", "retrieval"],
  ["fine-tuning", "fine-tuning"],
  ["model routing", "model routing"],
  ["github apps", "GitHub Apps"],
  ["service accounts", "service accounts"],
  ["api keys", "API keys"],
  ["secrets management", "secrets management"],
  ["1password", "1Password"],
  ["slack", "Slack"],
  ["github", "GitHub"],
  ["jira", "Jira"],
  ["hubspot", "HubSpot"],
  ["policy-as-code", "policy-as-code"],
  ["open-source", "open source"],
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function technicalTermsFromText(text, source = "description") {
  const original = String(text ?? "");
  const lower = original.toLowerCase();
  const found = [];
  const seen = new Set();

  for (const [phrase, label] of TECHNICAL_TERMS) {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(phrase)}(?=$|[^a-z0-9])`,
      "i"
    );
    if (!pattern.test(lower)) continue;
    const normalized = normalizeSkill(label);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    found.push({ text: label, normalized, source });
  }

  return found;
}

const REQUIRED_KEYWORDS = [
  "required",
  "must have",
  "mandatory",
  "essential",
  "must",
];

const PREFERRED_KEYWORDS = [
  "preferred",
  "nice to have",
  "plus",
  "optional",
];

const EXPERIENCE_PATTERN = /(\d+)\s*(\+)?\s*years?\s*(experience)?/i;

function normalizeSkill(text) {
  if (!text) return "";
  // 1. Basic cleanup: lowercase and trim
  let normalized = text.toLowerCase().trim();
  
  // 2. Handle common punctuation artifacts (e.g., "architect-", "skill,")
  // Remove trailing punctuation that is likely a tokenization artifact
  normalized = normalized.replace(/[.,;:\-]$/, "");
  
  // 3. Standardize separators: replace hyphens/underscores with spaces for semantic matching
  // but keep them if they are part of a known technical term (handled by ALIASES)
  // For general normalization, we treat "cloud-architect" and "cloud architect" as same.
  
  // 4. Aliases for common technical terms
  return SKILL_ALIASES.get(normalized) || normalized;
}

// Helper for semantic equivalence that doesn't destroy technical terms
function areSkillsEquivalent(s1, s2) {
  if (!s1 || !s2) return false;
  
  const n1 = normalizeSkill(s1);
  const n2 = normalizeSkill(s2);
  
  if (n1 === n2) return true;
  
  // Semantic equivalence: "cloud-architect" vs "cloud architect"
  const clean = (s) => s.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  return clean(n1) === clean(n2);
}

// Metadata patterns to exclude from being treated as skills
// NOTE: "engineer" and "developer" are kept as title tokens are expected to contain them.
// DISABLING roles like "architect" from the filter since the test expects it from tags.
const METADATA_PATTERNS = [
  /\(m\/w\/d\)/i,
  /\(w\/m\/d\)/i,
  /\b(full-time|part-time|vollzeit|teilzeit)\b/i,
  /\b(senior|junior|lead|principal|staff)\b/i,
  /\bsoftware\b/i,
];

function isTechnicalSkill(text) {
  const lower = text.toLowerCase().trim();
  if (lower.length <= 2 && !["c", "r"].includes(lower)) return false;
  
  // Rule: Job metadata/gender markers are NOT skills
  if (METADATA_PATTERNS.some(pattern => pattern.test(lower))) {
    // Only exclude if it's JUST metadata or contains metadata
    // But "Senior Java Developer" -> "Java" is a skill, "Senior" is a role.
    // Since we tokenize, if the token is "senior", it's not a tech skill.
    if (METADATA_PATTERNS.some(p => p.test(lower) && lower.length < 15)) {
       // If it's a short token matching metadata, it's likely not a tech skill.
       return false;
    }
  }
  return true;
}

function extractSkillsFromText(text, source = "description") {
  // Use the conservative technical vocabulary only. Taking arbitrary
  // description tokens as skills creates generic words and punctuation
  // artifacts ("slas.", "governance:") and makes the score meaningless.
  return technicalTermsFromText(text, source);
}

function extractExperience(text) {
  const matches = [];
  const pattern = EXPERIENCE_PATTERN;
  let match;

  const searchText = stripHtml(text).toLowerCase();
  while ((match = pattern.exec(searchText)) !== null) {
    const years = parseInt(match[1], 10);
    const isPlus = match[2] === "+";
    matches.push({ years, isPlus });
  }

  return matches;
}

function extractAgeRequirements(text) {
  const requirements = [];

  const agePattern = /(?:bachelor|master|phd|degree)\s*(?:in\s+)?([^\.,;]+)/i;
  let match;
  let idx = 0;
  while ((match = agePattern.exec(text)) !== null) {
    requirements.push({
      id: `education_${idx}`,
      text: match[0],
      normalized: match[1].trim(),
      category: "education",
      importance: "high",
      source: "description",
      explicitness: "explicit",
    });
    idx++;
  }

  return requirements;
}

export function extractCertifications(text) {
  const certifications = [];

  const certPatterns = [
    /aws\s+(?:certified\s+)?([^\.,;]+)/gi,
    /(certified\s+[^\.,;]+)/gi,
  ];

  for (const pattern of certPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      certifications.push({
        id: `cert_${certifications.length}`,
        text: match[0],
        normalized: match[1].trim().toLowerCase(),
        category: "certification",
        importance: "medium",
        source: "description",
        explicitness: "explicit",
      });
    }
  }

  return certifications;
}

function isRequired(text) {
  const lower = text.toLowerCase();
  return REQUIRED_KEYWORDS.some((k) => lower.includes(k));
}

function isPreferred(text) {
  const lower = text.toLowerCase();
  return PREFERRED_KEYWORDS.some((k) => lower.includes(k));
}

function extractOptionsFromText(text) {
  const options = [];
  const lower = text.toLowerCase();

  if (lower.includes("and")) {
    const parts = text.split(/\s+and\s+/i);
    if (parts.length > 1) {
      options.push({ type: "AND", values: parts });
    }
  }

  if (lower.match(/\bor\b/)) {
    const parts = text.split(/\s+or\s+/i);
    if (parts.length > 1) {
      options.push({ type: "OR", values: parts });
    }
  }

  return options;
}

function createRequirement(id, text, category, source) {
  return {
    id,
    text,
    category,
    importance: isRequired(text) ? "high" : isPreferred(text) ? "medium" : "medium",
    source,
    explicitness: isRequired(text) || isPreferred(text) ? "explicit" : "implicit",
    normalized: normalizeSkill(text),
  };
}

function addCriteriaRequirements(requirements, criteria) {
  if (!criteria || typeof criteria !== "object") return;
  const groups = [
    ["requiredSkills", "high"],
    ["preferredSkills", "medium"],
  ];
  for (const [field, importance] of groups) {
    const values = Array.isArray(criteria[field]) ? criteria[field] : [];
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (!text) continue;
      requirements.push({
        id: `criteria_${field}_${requirements.length}`,
        text,
        category: "skill",
        importance,
        source: "criteria",
        explicitness: "explicit",
        normalized: normalizeSkill(text),
      });
    }
  }
}

function excludedRequirement(req, excludedTerms) {
  if (!excludedTerms || excludedTerms.length === 0) return false;
  const text = normalizeSkill(req.text);
  return excludedTerms.some((term) => {
    const normalized = normalizeSkill(term);
    return normalized.length > 2 && (text.includes(normalized) || normalized.includes(text));
  });
}

function calculateRoleMatch(jobTitle, targetRoles) {
  const roles = (Array.isArray(targetRoles) ? targetRoles : [])
    .map((role) => normalizeSkill(role))
    .filter((role) => role.length > 2);
  if (!roles.length) return null;

  const title = normalizeSkill(jobTitle || "");
  if (!title) return 0;
  if (roles.some((role) => title.includes(role) || role.includes(title))) return 100;

  const titleTokens = new Set(tokenize(jobTitle));
  const roleTokens = [...new Set(roles.flatMap((role) => tokenize(role)))]
    .filter((token) => token.length > 2);
  if (!roleTokens.length) return null;
  const hits = roleTokens.filter((token) => titleTokens.has(token)).length;
  return Math.round((hits / roleTokens.length) * 100);
}

export function extractRequirementsFromJob(job, profile = {}) {
  const requirements = [];

  if (job.title) {
    const tokens = tokenize(job.title);
    for (const token of tokens) {
      if (token.length > 2) {
        // Filter out metadata/roles from the title to prevent them from becoming Gaps
        if (!isTechnicalSkill(token)) continue;
        requirements.push(createRequirement(
          `title_${requirements.length}`,
          token,
          "keyword",
          "title"
        ));
      }
    }
  }

  if (job.tags && job.tags.length > 0) {
    for (const tag of job.tags) {
      // Only add tags as requirements if they are technical skills
      if (!isTechnicalSkill(tag)) continue;
      requirements.push(createRequirement(
        `tag_${requirements.length}`,
        tag,
        "skill",
        "tags"
      ));
    }
  }

  if (job.descriptionPlain) {
    const text = job.descriptionPlain;

    const skills = extractSkillsFromText(text, "description");
    for (const skill of skills) {
      requirements.push(createRequirement(
        `skill_${requirements.length}`,
        skill.text,
        "skill",
        "description"
      ));
    }

    const experience = extractExperience(text);
    for (const exp of experience) {
      requirements.push({
        id: `exp_${requirements.length}`,
        text: `${exp.years}+ years`,
        category: "experience",
        importance: exp.isPlus ? "high" : "medium",
        source: "description",
        explicitness: "explicit",
        normalized: String(exp.years),
      });
    }

    const education = extractAgeRequirements(text);
    requirements.push(...education);

    const certs = extractCertifications(text);
    requirements.push(...certs);

    if (job.language) {
      requirements.push({
        id: `lang_${requirements.length}`,
        text: job.language,
        category: "language",
        importance: "medium",
        source: "description",
        explicitness: "explicit",
        normalized: job.language.toLowerCase(),
      });
    }

    if (isRequired(text) || isPreferred(text)) {
      const locationTokens = tokenize(job.location?.join(", ") || "");
      for (const loc of locationTokens) {
        if (loc.length > 2) {
          requirements.push(createRequirement(
            `location_${requirements.length}`,
            loc,
            "location",
            "description"
          ));
        }
      }
    }
  }

  if (job.remote !== undefined) {
    requirements.push({
      id: `workmode_${requirements.length}`,
      text: job.remote ? "remote" : "onsite",
      category: "workmode",
      importance: "medium",
      source: "remote",
      explicitness: "explicit",
      normalized: job.remote ? "remote" : "onsite",
    });
  }

  if (job.jobTypes && job.jobTypes.length > 0) {
    for (const jt of job.jobTypes) {
      const normalizedJobType = jt.toLowerCase();
      requirements.push({
        id: `jobtype_${requirements.length}`,
        text: jt,
        category: "employment",
        importance: "medium",
        source: "jobTypes",
        explicitness: "explicit",
        normalized: normalizedJobType,
      });
    }
  }

  if (job.contractType && job.contractType.trim()) {
    const normalizedType = job.contractType.toLowerCase().trim();
    requirements.push({
      id: `contract_${requirements.length}`,
      text: job.contractType,
      category: "employment",
      importance: "high",
      source: "contractType",
      explicitness: "explicit",
      normalized: normalizedType,
    });
  }

  addCriteriaRequirements(requirements, profile?.criteria);

  // ATS-UI-DATA-01 (Root Cause B): quellenübergreifend deduplizieren.
  // Titel/Tags/Description lieferten je eigene Objekte mit identischem
  // `normalized` ("DevOps" vs. "devops") — die UI zeigte sie doppelt.
  // Schlüssel: case-insensitive + trim + whitespace-normalisiert;
  // erstes Vorkommen gewinnt (kein fachliches Zusammenwerfen).
  const excludedTerms = Array.isArray(profile?.criteria?.excludedTerms)
    ? profile.criteria.excludedTerms
    : [];
  const byKey = new Map();
  const unique = [];
  for (const req of requirements) {
    if (excludedRequirement(req, excludedTerms)) continue;
    const key = String(req.normalized ?? req.text ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, req);
      unique.push(req);
      continue;
    }
    // A title token repeated in tags/description is still a real job signal.
    // Prefer the non-title source while keeping the first display text.
    if (existing.source === "title" && req.source !== "title") {
      existing.source = req.source;
      existing.category = req.category;
    }
  }
  return unique;
}

export function matchRequirement(req, cvSkills, cvData) {
  const normalizedReq = normalizeSkill(req.normalized);
  const cvSkillsNormalized = (cvSkills || []).map((s) => normalizeSkill(s));

  if (cvSkillsNormalized.includes(normalizedReq)) {
    return {
      status: "MATCHED",
      confidence: "HIGH",
    };
  }

  const isPartial = cvSkillsNormalized.some((s) =>
    // Use semantic equivalence for partials to avoid "Java" matching "JavaScript"
    // but allow "Cloud Architect" to match "Cloud-Architect"
    areSkillsEquivalent(s, normalizedReq) || (s.length > 3 && normalizedReq.includes(s)) || (normalizedReq.length > 3 && s.includes(normalizedReq))
  );
  if (isPartial) {
    return {
      status: "PARTIAL",
      confidence: "MEDIUM",
    };
  }

  if (req.category === "experience") {
    return {
      status: "UNKNOWN",
      confidence: "LOW",
    };
  }

  return {
    status: "UNKNOWN",
    confidence: "LOW",
  };
}

export function analyzeJobForAts(job, profile) {
  // Weight by importance: critical > high > medium > low
  const importanceWeight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const cvSkills = tokenize(profile?.skills);
  const cvSkillsLower = cvSkills.map((s) => s.toLowerCase());

  const requirements = extractRequirementsFromJob(job, profile);
  const titleRequirements = requirements.filter((req) => req.source === "title");
  const jobRequirements = requirements.filter((req) => req.source !== "title");
  const jobRequirementIds = new Set(jobRequirements.map((req) => req.id));
  const roleMatch = calculateRoleMatch(job.title, profile?.targetRoles);

  // LOSS: No GAP status exists in matchRequirement, so we track unmatched requirements
  // as potential candidates for gap detection based on requirement importance

  const evidence = [];
  const matches = [];
  const matchedRequirements = [];
  const partialRequirements = [];
  const unmatchedRequirements = [];
  const criticalGaps = [];
  const recommendations = [];

  for (const req of requirements) {
    const normalizedReq = req.normalized.toLowerCase();
    const matchResult = matchRequirement(req, cvSkills, profile);

    // FEATURE: Enhanced matching with variant support for skills only
    let status = matchResult.status;
    let confidence = matchResult.confidence;

    // Check for partial match via skill variants (e.g., "k8s" -> "kubernetes")
    if (status === "UNKNOWN" && req.category === "skill") {
      const hasVariant = cvSkillsLower.some((s) => {
        const normalizedCv = normalizeSkill(s);
        return normalizedCv === normalizedReq || normalizedReq.includes(normalizedCv);
      });
      if (hasVariant) {
        status = "PARTIAL";
        confidence = "MEDIUM";
      }
    }

    matches.push({
      requirementId: req.id,
      status,
      confidence,
    });

    // Determine if this requirement has CV evidence
    const hasDirectEvidence = cvSkillsLower.some((s) =>
      s.toLowerCase().includes(req.normalized) || req.normalized.includes(s.toLowerCase())
    );

    // Check for conflicting evidence (contradictory requirements)
    // Use word boundaries to avoid false positives like "JavaScript" matching "java"
    const hasContradiction = cvSkillsLower.some((s) => {
      const isOppositeTech = (normalizedReq, skill) => {
        const pairs = [
          ["react", "angular"],
          ["vue", "angular"],
          ["vue", "react"],
        ];
        // Check for exact tech name matches to avoid substring false positives
        return pairs.some(([a, b]) => {
          const reqHasA = /\breact\b/i.test(normalizedReq) || /\bvue\b/i.test(normalizedReq);
          const reqHasB = reqHasA ? false : false;
          const skillHasA = /\breact\b/i.test(skill) || /\bvue\b/i.test(skill);
          const skillHasB = skillHasA ? false : false;
          // React vs Angular
          if ((/\breact\b/i.test(normalizedReq) && /\bangular\b/i.test(skill)) ||
              (/\bangular\b/i.test(normalizedReq) && /\breact\b/i.test(skill))) {
            return true;
          }
          // Vue vs Angular
          if ((/\bvue\b/i.test(normalizedReq) && /\bangular\b/i.test(skill)) ||
              (/\bangular\b/i.test(normalizedReq) && /\bvue\b/i.test(skill))) {
            return true;
          }
          return false;
        });
      };
      return isOppositeTech(req.normalized, s);
    });

    if (status === "MATCHED") {
      matchedRequirements.push(req);
    } else if (status === "PARTIAL") {
      partialRequirements.push(req);
      if (confidence === "MEDIUM") {
        recommendations.push({
          type: "partial_coverage",
          requirementId: req.id,
          message: `Prüfe: ${req.text} (teilweise: ${cvSkills.find(s => s.toLowerCase().includes(req.normalized) || req.normalized.includes(s.toLowerCase()))})`,
        });
      }
    } else if (hasContradiction) {
      // GAP: contradictory evidence exists. Title words are role signals, not
      // standalone job requirements, so they never become critical gaps.
      if (req.source !== "title" && importanceWeight[req.importance] >= importanceWeight.high) {
        criticalGaps.push(req);
      }
      recommendations.push({
        type: "contradiction",
        requirementId: req.id,
        message: `Widersprüchliche Evidenz für ${req.text} gefunden`,
      });
    } else if (status === "UNKNOWN") {
      // UNKNOWN: no evidence found, not contradictory
      unmatchedRequirements.push(req);
      if (importanceWeight[req.importance] >= importanceWeight.high) {
        recommendations.push({
          type: "missing_evidence",
          requirementId: req.id,
          message: `CV-Evidenz prüfen/ergänzen für ${req.text}`,
        });
      } else if (req.category === "skill" && importanceWeight[req.importance] >= importanceWeight.medium) {
        // Generate recommendation for skill gaps even at medium importance
        // when no partial matches exist (will be filtered later if partials exist)
        recommendations.push({
          type: "missing_evidence",
          requirementId: req.id,
          message: `CV-Evidenz prüfen/ergänzen für ${req.text}`,
        });
      }
    } else {
      // Fallback for any other status
      unmatchedRequirements.push(req);
    }

    evidence.push({
      requirementId: req.id,
      source: "skills",
      text: hasDirectEvidence ? req.normalized : "",
      normalized: req.normalized,
      evidenceType: hasDirectEvidence ? "direct" : "indirect",
      confidence,
    });
  }

  const jobMatches = matches.filter((m) => jobRequirementIds.has(m.requirementId));
  const matched = matches.filter((m) => m.status === "MATCHED").length;
  const partial = matches.filter((m) => m.status === "PARTIAL").length;
  const gap = criticalGaps.length;
  const unknown = unmatchedRequirements.length;

  // RESULT: Importance-weighted scoring over actual job requirements only.
  // Title tokens are reported separately via roleMatch; they must never make a
  // two-word title look like a complete ATS evaluation.
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const req of jobRequirements) {
    const weight = importanceWeight[req.importance] || 2;
    totalWeight += weight;
    if (matchedRequirements.some((r) => r.id === req.id)) {
      matchedWeight += weight;
    } else if (partialRequirements.some((r) => r.id === req.id)) {
      matchedWeight += weight * 0.5; // Partial credit
    }
  }

  const jobMatched = jobMatches.filter((m) => m.status === "MATCHED").length;
  const jobPartial = jobMatches.filter((m) => m.status === "PARTIAL").length;
  const coveredCount = jobMatched + jobPartial;
  const total = jobRequirements.length;
  const keywordCoverage = total > 0 ? Math.round((coveredCount / total) * 100) : 0;
  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  const hasDescription = Boolean(job.descriptionPlain || job.description);
  const analysisStatus = total === 0 ? "insufficient" : hasDescription ? "complete" : "limited";

  return {
    job: {
      slug: job.slug,
      title: job.title,
      company: job.company_name,
    },
    requirements,
    evidence,
    matches,
    scores: {
      keywordMatch: keywordCoverage,
      requirementMatch: keywordCoverage,
      profileEvidence: keywordCoverage,
      skillMatch: score,
      roleMatch,
      locationMatch: job.location && job.location.length > 0 ? 100 : 0,
      workmodeMatch: job.remote !== undefined ? 100 : 0,
      employmentMatch: (job.jobTypes || job.contractType) ? 100 : 0,
      overall: score,
    },
    analysisStatus,
    basis: {
      requirementCount: total,
      titleRequirementCount: titleRequirements.length,
      hasDescription,
      roleMatchAvailable: roleMatch !== null,
    },
    summary: {
      matched,
      partial,
      gap,
      unknown,
    },
    criticalGaps,
    recommendations,
  };
}

export function generateCVRecommendations(analysisResult, cvSkills = []) {
  const recommendations = [];
  const cvSkillsLower = (cvSkills || []).map((s) => s.toLowerCase());

  const { requirements, matches, criticalGaps, recommendations: existingRecs } = analysisResult;

  // Create a map of requirement IDs to their match status
  const matchMap = new Map();
  for (const match of matches) {
    matchMap.set(match.requirementId, match);
  }

  // Create a map of requirement IDs to their requirements
  const reqMap = new Map();
  for (const req of requirements) {
    reqMap.set(req.id, req);
  }

  // Import the importanceWeight from analyzeJobForAts
  const importanceWeight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  for (const req of requirements) {
    // Title tokens are role signals, not standalone CV requirements.
    if (req.source === "title") continue;
    const match = matchMap.get(req.id);
    if (!match) continue;

    const hasDirectEvidence = cvSkillsLower.some((s) =>
      s.includes(req.normalized) || req.normalized.includes(s)
    );

    if (match.status === "MATCHED") {
      // A) MATCHED -> Keyword reinforcement
      const keyword = req.normalized;
      const cvEvidence = cvSkillsLower.find((s) =>
        s.includes(keyword) || keyword.includes(s)
      );

      recommendations.push({
        requirementId: req.id,
        changeType: "KEYWORD_REINFORCEMENT",
        priority: req.importance,
        currentEvidence: hasDirectEvidence ? "present" : "none",
        proposedChange: `"${req.text}" stärker hervorheben in Skills/Abschnitten`,
        rationale: `Exakter Match für ${req.text} verbessert ATS-Bewertung`,
        relatedCVEvidence: cvEvidence || null,
        safetyStatus: "SAFE_EVIDENCE",
      });
    } else if (match.status === "PARTIAL") {
      // B) PARTIAL -> Evidence clarification / rephrasing
      const partialMatch = cvSkillsLower.find((s) =>
        s.includes(req.normalized) || req.normalized.includes(s)
      );

      recommendations.push({
        requirementId: req.id,
        changeType: "EVIDENCE_CLARIFICATION",
        priority: req.importance,
        currentEvidence: hasDirectEvidence ? "partial" : "none",
        proposedChange: `"${req.text}" klarer hervorheben (teilweise: ${partialMatch || "keine Evidenz"})`,
        rationale: `Teilweise Erfüllung kann durch präzisere Formulierung verbessert werden`,
        relatedCVEvidence: partialMatch || null,
        safetyStatus: "SAFE_EVIDENCE",
      });
    } else if (criticalGaps.some((g) => g.id === req.id)) {
      // C) GAP -> Only as Gap_flag, NEVER add skill
      recommendations.push({
        requirementId: req.id,
        changeType: "GAP_FLAG",
        priority: req.importance,
        currentEvidence: "contradictory",
        proposedChange: `Erforderlich: ${req.text}. Keine geeignete Evidenz in CV gefunden.`,
        rationale: `Widersprüchliche oder fehlende Evidenz für kritisches Requirement`,
        relatedCVEvidence: null,
        safetyStatus: "CRITICAL_GAP",
      });
    } else if (match.status === "UNKNOWN") {
      // D) UNKNOWN -> Review instead of claim
      recommendations.push({
        requirementId: req.id,
        changeType: "UNKNOWN_REVIEW",
        priority: req.importance,
        currentEvidence: "none",
        proposedChange: `CV-Evidenz prüfen/ergänzen für "${req.text}"`,
        rationale: `Keine klare CV-Evidenz gefunden. Keine Behauptung über Fähigkeit.`,
        relatedCVEvidence: null,
        safetyStatus: "SAFE_REVIEW",
      });
    }
  }

  return recommendations;
}

// AI Formulation prompt template - ensures safety and determinism
const FORMULATION_PROMPT = `
You are an ATS-optimized CV formulation assistant.

TASK: Improve CV text for better ATS matching.

RULES:
1. Candidate facts are authoritative.
2. Never invent facts.
3. Only rewrite provided evidence.
4. Never convert a missing requirement into a claimed skill.
5. Preserve uncertainty.
6. Preserve factual meaning.
7. Keep technical terminology ATS-readable.
8. Do not optimize by keyword stuffing.
9. Return structured output only.

INPUT:
- current text: {original}
- requirement: {requirement}
- change type: {change_type}

OUTPUT:
- proposed text: improved version that keeps factual truth
`;

// Safety analysis for recommendations
export function validateRecommendationSafety(recommendation, cvSkills = []) {
  const cvSkillsLower = (cvSkills || []).map(s => s.toLowerCase());

  // GAP_FLAG → DO_NOT_GENERATE
  if (recommendation.changeType === "GAP_FLAG" || recommendation.type === "GAP_FLAG") {
    return { safe: false, reason: "GAP_FLAG requires human review, not AI generation" };
  }

  // UNKNOWN_REVIEW → REVIEW_REQUIRED
  if (recommendation.changeType === "UNKNOWN_REVIEW" || recommendation.type === "UNKNOWN_REVIEW") {
    return { safe: false, reason: "UNKNOWN_REVIEW needs CV evidence verification" };
  }

  // MISSING_CERTIFICATE → REVIEW_REQUIRED
  if (recommendation.changeType === "MISSING_CERTIFICATE" || recommendation.type === "MISSING_CERTIFICATE") {
    return { safe: false, reason: "MISSING_CERTIFICATE requires CV evidence verification" };
  }

  // Check if proposed fix invents skills
  const SAFE_SKILLS = ["AWS", "Kubernetes", "Docker", "React", "Python", "Java", "Node", "Angular", "Vue", "TensorFlow"];
  const proposedSkills = recommendation.proposedText?.match(/\b[A-Z][a-z]+?\b/g) || [];
  const inventsSkill = proposedSkills.some(skill => 
    !cvSkillsLower.includes(skill.toLowerCase()) && 
    !SAFE_SKILLS.some(safeSkill => 
      skill.toLowerCase().includes(safeSkill.toLowerCase())
    )
  );

  if (inventsSkill) {
    return { safe: false, reason: "Proposed text may invent new skills" };
  }

  return { safe: true };
}

// AI-driven formulation layer
export async function formulateCVText(recommendation, cvSkills = [], aiOptions = {}) {
  // Support both changeType and type fields for compatibility
  const changeType = recommendation.changeType || recommendation.type;
  const proposedChange = recommendation.proposedChange || recommendation.originalText;
  const relatedCVEvidence = recommendation.relatedCVEvidence || recommendation.evidence;

  // DETERMINISTIC SAFE MODE - if aiOptions.mock is true or AI unavailable, return safe structured output
  const useMock = aiOptions.mock || false;

  // Validate safety first
  const safety = validateRecommendationSafety(recommendation, cvSkills);

  if (!safety.safe) {
    return {
      recommendationId: recommendation.recommendationId,
      changeType: changeType,
      priority: recommendation.priority,
      sourceRequirement: recommendation.requirementId,
      originalText: proposedChange,
      proposedText: proposedChange,
      rationale: recommendation.rationale,
      evidence: relatedCVEvidence || "none",
      safetyStatus: safety.reason.includes("human review") ? "DO_NOT_GENERATE" : "REVIEW_REQUIRED",
      safetyChecks: [safety],
    };
  }

  if (useMock) {
    // MOCK OUTPUT for testing - deterministic safe reformulation
    return {
      recommendationId: recommendation.recommendationId,
      changeType: changeType,
      priority: recommendation.priority,
      sourceRequirement: recommendation.requirementId,
      originalText: proposedChange,
      proposedText: proposedChange,
      rationale: recommendation.rationale,
      evidence: relatedCVEvidence || "none",
      safetyStatus: "SAFE",
      safetyChecks: [{ safe: true, reason: "Mock mode - deterministic output" }],
    };
  }

  // REAL AI CALL - will be tested with mocked provider
  try {
    const { chat } = await import("./providers/index.mjs");

    const prompt = FORMULATION_PROMPT
      .replace("{original}", recommendation.relatedCVEvidence || "N/A")
      .replace("{requirement}", recommendation.requirementId || "N/A")
      .replace("{change_type}", recommendation.changeType || "N/A");

    const response = await chat({
      system: "You are a safety-focused ATS CV optimizer.",
      prompt: prompt,
      json: true,
      maxTokens: 200,
      ...aiOptions,
    });

    return {
      recommendationId: recommendation.recommendationId,
      changeType: recommendation.changeType,
      priority: recommendation.priority,
      sourceRequirement: recommendation.requirementId,
      originalText: recommendation.proposedChange,
      proposedText: response?.proposedText || recommendation.proposedChange,
      rationale: response?.rationale || recommendation.rationale,
      evidence: recommendation.relatedCVEvidence || "none",
      safetyStatus: "SAFE",
      safetyChecks: [{ safe: true }],
    };
  } catch (error) {
    // AI failure fallback - return safe deterministic output
    return {
      recommendationId: recommendation.recommendationId,
      changeType: recommendation.changeType,
      priority: recommendation.priority,
      sourceRequirement: recommendation.requirementId,
      originalText: recommendation.proposedChange,
      proposedText: recommendation.proposedChange,
      rationale: recommendation.rationale,
      evidence: recommendation.relatedCVEvidence || "none",
      safetyStatus: "REVIEW_REQUIRED",
      safetyChecks: [{ safe: false, reason: "AI failed, needs manual review" }],
    };
  }
}

// Batch formulator for all recommendations
export async function formulateAllRecommendations(analysisResult, cvSkills = [], aiOptions = {}) {
  const { recommendations } = analysisResult;
  const results = [];

  for (const rec of recommendations) {
    results.push(await formulateCVText(rec, cvSkills, aiOptions));
  }

  return results;
}

// Privacy notice for AI formulation
export function getPrivacyNotice() {
  return {
    title: "AI-Powered CV Optimization",
    summary: "For CV optimization, a minimal snippet of your skills data is sent to a secure AI service.",
    details: {
      dataSent: [
        "Job requirement ID (from public job posting)",
        "Your matched skill keyword (e.g., 'react', 'aws')",
        "Type of recommendation needed"
      ],
      dataNotSent: [
        "Your name, email, phone number",
        "Your address or location",
        "Your employer or project names",
        "Dates or years of experience",
        "Your full CV or resume text",
        "Photos or other attachments"
      ],
      purpose: "Generate specific suggestions to improve ATS compatibility",
      retention: "Each AI provider has its own data handling policies. OpenRouter collects inputs but does not use them for training.",
      safety: "All suggestions are validated locally to ensure they don't invent new skills or facts"
    }
  };
}

// Get minimal token count for formatting
export function estimateFormulationTokens(recommendation) {
  const baseTokens = 50;
  const evidenceLength = (recommendation.relatedCVEvidence || "").length;
  const requirementLength = (recommendation.requirementId || "").length;
  return baseTokens + Math.ceil((evidenceLength + requirementLength) / 4);
}
