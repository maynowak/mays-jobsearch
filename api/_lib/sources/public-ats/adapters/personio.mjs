import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../../../filter.mjs";

const MAX_JOBS_TO_AI = 40;

function parseXml(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("Invalid XML");
  }
  return xmlDoc;
}

function xmlToJson(xmlNode) {
  const obj = {};
  if (xmlNode.nodeType === 3) {
    return xmlNode.textContent.trim();
  }
  if (xmlNode.attributes && xmlNode.attributes.length > 0) {
    for (const attr of xmlNode.attributes) {
      obj[`@${attr.name}`] = attr.value;
    }
  }
  for (const child of xmlNode.childNodes) {
    const key = child.nodeName;
    const value = xmlToJson(child);
    if (value === "" || value === null) continue;
    if (obj[key] === undefined) {
      obj[key] = value;
    } else if (Array.isArray(obj[key])) {
      obj[key].push(value);
    } else {
      obj[key] = [obj[key], value];
    }
  }
  return obj;
}

function extractText(node, tagName) {
  const elements = node.getElementsByTagName(tagName);
  return elements.length > 0 ? elements[0].textContent.trim() : "";
}

function extractAllText(node, tagName) {
  const elements = node.getElementsByTagName(tagName);
  return Array.from(elements).map((el) => el.textContent.trim()).filter(Boolean);
}

export function createPersonioSource({ identifier, enabled, label, options = {} }) {
  const SOURCE_ID = `personio:${identifier}`;
  const baseUrl = options.baseUrl || `https://${identifier}.jobs.personio.de/xml`;
  const language = options.language || "en";

  return {
    id: SOURCE_ID,
    displayName: label || `Personio (${identifier})`,
    provider: "ats",
    enabled: () => enabled,
    fetchJobs: async ({ skills, targetRoles, targetRole, city }) => {
      const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
      const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
      const cityQueries = String(city || "")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

      const url = `${baseUrl}?language=${encodeURIComponent(language)}`;

      let response;
      try {
        response = await fetch(url, { headers: { Accept: "application/xml, text/xml" } });
      } catch {
        throw new HttpError(502, "Couldn't reach Personio API right now. Please try again in a moment.", "network");
      }

      if (response.status === 404) {
        throw new HttpError(404, `Personio career site "${identifier}" not found.`, "not_found");
      }
      if (response.status === 429) {
        throw new HttpError(429, "Personio API is busy right now. Give it a minute and try again.", "rate_limited");
      }
      if (!response.ok) {
        throw new HttpError(502, `Personio API returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
      }

      const xmlText = await response.text();
      let xmlDoc;
      try {
        xmlDoc = parseXml(xmlText);
      } catch {
        throw new HttpError(502, "Personio API sent back invalid XML. Try again shortly.", "upstream");
      }

      const positions = xmlDoc.getElementsByTagName("position");
      if (!positions.length) {
        return {
          jobs: [],
          meta: { enabled: true, reason: null, totalScanned: 0, totalFiltered: 0 },
        };
      }

      const allJobs = Array.from(positions).map((node) => normalizePersonioJob(node, SOURCE_ID));
      const candidates = allJobs.filter((job) => {
        if (!locationMatches(job, cityQueries)) return false;
        if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
        return true;
      });

      const ranked = candidates
        .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
        .sort((a, b) => b.hits - a.hits || (b.job.created_at || 0) - (a.job.created_at || 0))
        .map(({ job }) => job);

      return {
        jobs: ranked.slice(0, MAX_JOBS_TO_AI),
        meta: {
          enabled: true,
          reason: null,
          totalScanned: allJobs.length,
          totalFiltered: ranked.length,
        },
      };
    },
  };
}

function normalizePersonioJob(positionNode, sourceId) {
  const id = extractText(positionNode, "id");
  const company = extractText(positionNode, "subcompany");
  const office = extractText(positionNode, "office");
  const additionalOffices = extractAllText(positionNode, "additionalOffices").flatMap((o) => o.split(",").map((s) => s.trim()));
  const department = extractText(positionNode, "department");
  const recruitingCategory = extractText(positionNode, "recruitingCategory");
  const title = extractText(positionNode, "name");
  const employmentType = extractText(positionNode, "employmentType");
  const schedule = extractText(positionNode, "schedule");
  const seniority = extractText(positionNode, "seniority");
  const yearsOfExperience = extractText(positionNode, "yearsOfExperience");
  const createdAtStr = extractText(positionNode, "createdAt");

  const descriptionBlocks = extractAllText(positionNode, "jobDescriptions");
  const descriptionHtml = descriptionBlocks.join("<br><br>");
  const descriptionPlain = stripHtml(descriptionHtml);

  const location = [office, ...additionalOffices].filter(Boolean);
  const remote = location.some((l) => l.toLowerCase().includes("remote"));

  const createdAt = createdAtStr ? Date.parse(createdAtStr) : NaN;

  const externalId = `po-${id}`;

  const tags = [department, recruitingCategory, seniority, yearsOfExperience].filter(Boolean);

  return {
    slug: externalId,
    title: String(title || "").trim(),
    company_name: String(company || "").trim(),
    location,
    remote,
    tags,
    url: "", // Personio XML doesn't provide direct job URL
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [sourceId, "ats"],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: employmentType ? [employmentType.toLowerCase()] : undefined,
    applyUrl: undefined,
    jobUrl: undefined,
    workplaceType: remote ? "remote" : undefined,
    department: department || recruitingCategory || undefined,
    salary: undefined,
    externalId,
  };
}