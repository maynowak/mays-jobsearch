const skills = ["Java", "AWS", "Spring Boot", "Machine Learning", "Amazon Web Services"];
const json = JSON.stringify(skills);
console.log("JSON:", json);

// Simulate backend parsing
try {
  const parsed = JSON.parse(json);
  console.log("Parsed:", parsed);
} catch (e) {
  console.log("Parse failed:", e.message);
}

// Test normalizeSkills from searchStrategy
function normalizeSkills(skillsInput) {
  if (!skillsInput) return [];
  
  let skills = [];
  if (typeof skillsInput === "string") {
    skills = skillsInput.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
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

  return normalized.slice(0, 20);
}

const jsonInput = JSON.stringify(["Java", "AWS", "Spring Boot", "Machine Learning", "Amazon Web Services"]);
const parsed = JSON.parse(jsonInput);
const normalized = normalizeSkills(parsed);
console.log("Normalized:", normalized);
