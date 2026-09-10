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
  const lower = text.toLowerCase().trim();
  return SKILL_ALIASES.get(lower) || lower;
}

function extractSkillsFromText(text, source = "description") {
  const skills = [];
  const tokens = tokenize(text);

  for (const token of tokens) {
    if (token.length > 2) {
      const normalized = normalizeSkill(token);
      if (normalized !== token || REQUIRED_KEYWORDS.includes(token)) {
        skills.push({
          text: token,
          normalized,
          source,
        });
      }
    }
  }

  return [...new Set(skills.map((s) => s.normalized))];
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

export function extractRequirementsFromJob(job) {
  const requirements = [];

  if (job.title) {
    const tokens = tokenize(job.title);
    for (const token of tokens) {
      if (token.length > 2) {
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

  return requirements;
}

export function matchRequirement(req, cvSkills, cvData) {
  const normalizedReq = req.normalized.toLowerCase();
  const cvSkillsLower = (cvSkills || []).map((s) => s.toLowerCase());

  if (cvSkillsLower.includes(normalizedReq)) {
    return {
      status: "MATCHED",
      confidence: "HIGH",
    };
  }

  const isPartial = cvSkillsLower.some((s) =>
    s.includes(normalizedReq) || normalizedReq.includes(s)
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

  const cvSkills = profile?.skills?.split(",")?.map((s) => s.trim()) || [];
  const cvSkillsLower = cvSkills.map((s) => s.toLowerCase());

  const requirements = extractRequirementsFromJob(job);

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
      // GAP: contradictory evidence exists
      if (importanceWeight[req.importance] >= importanceWeight.high) {
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

  const matched = matches.filter((m) => m.status === "MATCHED").length;
  const partial = matches.filter((m) => m.status === "PARTIAL").length;
  const gap = criticalGaps.length;
  const unknown = unmatchedRequirements.length;

  const total = matches.length;

  // RESULT: Importance-weighted scoring
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const req of requirements) {
    const weight = importanceWeight[req.importance] || 2;
    totalWeight += weight;
    if (matchedRequirements.some((r) => r.id === req.id)) {
      matchedWeight += weight;
    } else if (partialRequirements.some((r) => r.id === req.id)) {
      matchedWeight += weight * 0.5; // Partial credit
    }
  }

  // RESULT: Keyword coverage based on matched + partially matched
  const coveredCount = matched + partial;
  const keywordCoverage = total > 0 ? Math.round((coveredCount / total) * 100) : 0;

  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

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
      skillMatch: score,
      locationMatch: job.location && job.location.length > 0 ? 100 : 0,
      workmodeMatch: job.remote !== undefined ? 100 : 0,
      employmentMatch: (job.jobTypes || job.contractType) ? 100 : 0,
      overall: score,
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
