import { tokenize, splitQuotedPhrases } from "./filter.mjs";

export const MAX_SKILLS = 20;
export const DEFAULT_CANDIDATE_POOL_TARGET = 50;
export const MIN_CANDIDATE_POOL_TARGET = 10;

export function normalizeSkills(skillsInput) {
  if (!skillsInput) return [];
  
  let skills = [];
  if (typeof skillsInput === "string") {
    skills = splitQuotedPhrases(skillsInput);
  } else if (Array.isArray(skillsInput)) {
    skills = skillsInput.map(s => String(s).trim()).filter(Boolean);
  }

  const seen = new Set();
  const normalized = [];
  
  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      normalized.push(trimmed);
    }
  }

  return normalized.slice(0, MAX_SKILLS);
}

export function calculateThreshold(skillCount) {
  if (skillCount <= 1) return 1;
  if (skillCount <= 3) return skillCount;
  if (skillCount <= 5) return Math.max(3, skillCount - 1);
  if (skillCount <= 10) return Math.max(4, Math.ceil(skillCount * 0.5));
  if (skillCount <= 15) return Math.max(5, Math.ceil(skillCount * 0.4));
  return Math.max(6, Math.ceil(skillCount * 0.3));
}

export function analyzeSourceCapabilities(source) {
  const capabilities = {
    supportsAND: false,
    supportsOR: false,
    supportsGroupedBoolean: false,
    supportsRepeatedQuery: true,
    maxQueryLength: Infinity,
    requiresLocation: false,
    name: source.id || source.displayName || "unknown",
  };

  if (source.id === "arbeitnow") {
    capabilities.supportsRepeatedQuery = true;
    capabilities.maxQueryLength = 1000;
  } else if (source.provider === "apify") {
    capabilities.supportsRepeatedQuery = true;
    capabilities.maxQueryLength = 500;
  }

  return capabilities;
}

export function buildSkillQueries(skills, threshold) {
  if (!skills.length) return [];
  if (skills.length <= threshold) return [skills];
  
  const queries = [];
  for (let k = skills.length; k >= threshold; k--) {
    for (let i = 0; i <= skills.length - k; i++) {
      queries.push(skills.slice(i, i + k));
    }
  }
  return queries;
}

export function progressiveSkillSearch(skills, source, { candidatePoolTarget = DEFAULT_CANDIDATE_POOL_TARGET } = {}) {
  const normalizedSkills = normalizeSkills(skills);
  const threshold = calculateThreshold(normalizedSkills.length);
  const capabilities = analyzeSourceCapabilities(source);
  
  if (!normalizedSkills.length) {
    return { skills: [], threshold: 0, queries: [], strategy: "no-skills" };
  }

  if (capabilities.supportsAND) {
    const query = normalizedSkills.join(" ");
    return { skills: normalizedSkills, threshold, queries: [normalizedSkills], strategy: "and" };
  }

  if (normalizedSkills.length <= threshold) {
    return { skills: normalizedSkills, threshold, queries: [normalizedSkills], strategy: "exact" };
  }

  const queries = buildSkillQueries(normalizedSkills, threshold);
  return { skills: normalizedSkills, threshold, queries, strategy: "progressive" };
}

export function scoreJobBySkills(job, skills) {
  if (!skills.length) return 0;
  const title = (job.title || "").toLowerCase();
  const tags = (job.tags || []).join(" ").toLowerCase();
  const description = (job.description || job.descriptionPlain || "").toLowerCase();
  const haystack = `${title} ${tags} ${description}`;
  
  let matches = 0;
  for (const skill of skills) {
    const skillLower = skill.toLowerCase();
    if (haystack.includes(skillLower)) matches++;
  }
  return matches;
}

export function filterJobsBySkillThreshold(jobs, skills, threshold) {
  if (!skills.length) return jobs;
  if (threshold <= 0) return jobs;
  
  return jobs
    .map(job => ({ job, matches: scoreJobBySkills(job, skills) }))
    .filter(({ matches }) => matches >= threshold)
    .sort((a, b) => b.matches - a.matches)
    .map(({ job }) => job);
}

export function buildCandidatePool(skills, allJobs, source, options = {}) {
  const { candidatePoolTarget = DEFAULT_CANDIDATE_POOL_TARGET, minCandidatePoolTarget = MIN_CANDIDATE_POOL_TARGET } = options;
  
  if (!skills.length) {
    return { jobs: allJobs.slice(0, candidatePoolTarget), meta: { threshold: 0, strategy: "no-skills" } };
  }

  const { skills: normalizedSkills, threshold, queries, strategy } = progressiveSkillSearch(skills, source);
  
  if (strategy === "and" || strategy === "exact") {
    let usedThreshold = threshold;
    let filtered = filterJobsBySkillThreshold(allJobs, normalizedSkills, usedThreshold);
    // Fallback: never return an empty pool while lower-threshold matches exist.
    // Without this, e.g. 3 skills with no job matching all 3 yield zero results
    // even though partial matches are available.
    while (filtered.length === 0 && usedThreshold > 1) {
      usedThreshold -= 1;
      filtered = filterJobsBySkillThreshold(allJobs, normalizedSkills, usedThreshold);
    }
    return {
      jobs: filtered.slice(0, candidatePoolTarget),
      meta: { threshold: usedThreshold, strategy, skillsUsed: normalizedSkills.length }
    };
  }

  let candidates = [];
  let usedThreshold = threshold;
  let stagesUsed = 0;

  for (const query of queries) {
    const filtered = filterJobsBySkillThreshold(allJobs, query, query.length);
    const newJobs = filtered.filter(j => !candidates.some(c => c.slug === j.slug));
    candidates.push(...newJobs);
    stagesUsed++;
    
    if (candidates.length >= candidatePoolTarget) break;
  }

  if (candidates.length < minCandidatePoolTarget && stagesUsed < queries.length) {
    for (const query of queries.slice(stagesUsed)) {
      const filtered = filterJobsBySkillThreshold(allJobs, query, Math.max(1, query.length - 1));
      const newJobs = filtered.filter(j => !candidates.some(c => c.slug === j.slug));
      candidates.push(...newJobs);
      stagesUsed++;
      if (candidates.length >= minCandidatePoolTarget) break;
    }
  }

  // Final fallback: if still not enough candidates, include remaining jobs (threshold 0)
  if (candidates.length < minCandidatePoolTarget) {
    const remainingJobs = allJobs.filter(j => !candidates.some(c => c.slug === j.slug));
    candidates.push(...remainingJobs);
    usedThreshold = 0;
  }

  return {
    jobs: candidates.slice(0, candidatePoolTarget),
    meta: { 
      threshold: usedThreshold, 
      strategy, 
      stagesUsed,
      skillsUsed: normalizedSkills.length,
      candidateCount: candidates.length
    }
  };
}

export function applySearchStrategy(skills, allJobs, source, options = {}) {
  return buildCandidatePool(skills, allJobs, source, options);
}

export function applySearchStrategyWithTargetRole(skills, targetRoles, allJobs, source, options = {}) {
  const { targetRoleWeight = 1 } = options;
  const roles = Array.isArray(targetRoles) ? targetRoles : (targetRoles ? [targetRoles] : []);
  
  if (!skills.length && !roles.length) {
    return buildCandidatePool([], allJobs, source, options);
  }

  // First, get jobs matching ANY targetRole (hard filter, OR across roles)
  const targetRoleJobs = roles.length ? allJobs.filter(job => {
    const title = (job.title || "").toLowerCase();
    const tags = (job.tags || []).join(" ").toLowerCase();
    const haystack = `${title} ${tags}`;
    return roles.some(role => haystack.includes(role.toLowerCase()));
  }) : [];

  // Then apply skill strategy to remaining jobs
  const nonTargetRoleJobs = roles.length ? allJobs.filter(job => {
    const title = (job.title || "").toLowerCase();
    const tags = (job.tags || []).join(" ").toLowerCase();
    const haystack = `${title} ${tags}`;
    return !roles.some(role => haystack.includes(role.toLowerCase()));
  }) : allJobs;

  const skillResult = buildCandidatePool(skills, nonTargetRoleJobs, source, options);
  
  // Combine: targetRole matches + skill matches
  const combinedJobs = [...targetRoleJobs];
  for (const job of skillResult.jobs) {
    if (!combinedJobs.some(j => j.slug === job.slug)) {
      combinedJobs.push(job);
    }
  }

  return {
    jobs: combinedJobs.slice(0, options.candidatePoolTarget || 50),
    meta: {
      ...skillResult.meta,
      targetRoleMatches: targetRoleJobs.length,
      combinedCount: combinedJobs.length
    }
  };
}