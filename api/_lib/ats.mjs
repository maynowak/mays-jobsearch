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
  const cvSkills = profile?.skills?.split(",")?.map((s) => s.trim()) || [];

  const requirements = extractRequirementsFromJob(job);

  const evidence = [];
  const matches = [];

  for (const req of requirements) {
    const matchResult = matchRequirement(req, cvSkills, profile);

    matches.push({
      requirementId: req.id,
      status: matchResult.status,
      confidence: matchResult.confidence,
    });

    const hasEvidence = cvSkills.some((s) =>
      s.toLowerCase().includes(req.normalized)
    );

    evidence.push({
      requirementId: req.id,
      source: "skills",
      text: hasEvidence ? req.normalized : "",
      normalized: req.normalized,
      evidenceType: hasEvidence ? "direct" : "indirect",
      confidence: matchResult.confidence,
    });
  }

  const matched = matches.filter((m) => m.status === "MATCHED").length;
  const partial = matches.filter((m) => m.status === "PARTIAL").length;
  const gap = matches.filter((m) => m.status === "GAP").length;
  const unknown = matches.filter((m) => m.status === "UNKNOWN").length;

  const total = matches.length;
  const keywordMatch = matched / Math.max(total, 1);
  const matchScore = matched / Math.max(total, 1);

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
      keywordMatch: Math.round(keywordMatch * 100),
      skillMatch: Math.round(matchScore * 100),
      locationMatch: job.location && job.location.length > 0 ? 100 : 0,
      workmodeMatch: job.remote !== undefined ? 100 : 0,
      employmentMatch: (job.jobTypes || job.contractType) ? 100 : 0,
      overall: Math.round(matchScore * 100),
    },
    summary: {
      matched,
      partial,
      gap,
      unknown,
    },
    recommendations: [],
  };
}
