import { tokenize } from "./api/_lib/filter.mjs";
import { normalizeSkills, calculateThreshold, progressiveSkillSearch, buildSkillQueries, applySearchStrategyWithTargetRole, buildCandidatePool, scoreJobBySkills } from "./api/_lib/searchStrategy.mjs";

// Test the exact 20 skills from the issue
const skills = [
  "Java",
  "Java EE/J2EE",
  "Spring Boot",
  "Microservices",
  "JPA",
  "Hibernate",
  "JUnit",
  "Software Architecture",
  "Database Systems",
  "AWS",
  "Terraform",
  "Docker",
  "Linux",
  "CI/CD",
  "Infrastructure as Code",
  "DevOps",
  "Automation",
  "SQL",
  "PL/SQL",
  "Oracle"
];

console.log("=== SKILL NORMALIZATION ===");
const normalized = normalizeSkills(skills);
console.log("Original count:", skills.length);
console.log("Normalized:", normalized);
console.log("Normalized count:", normalized.length);

console.log("\n=== THRESHOLD CALCULATION ===");
const threshold = calculateThreshold(normalized.length);
console.log("Threshold for", normalized.length, "skills:", threshold);

console.log("\n=== PROGRESSIVE SKILL SEARCH ===");
const source = { id: "combined", provider: "search-strategy" };
const progResult = progressiveSkillSearch(normalized, source, { candidatePoolTarget: 50 });
console.log("Strategy:", progResult.strategy);
console.log("Threshold:", progResult.threshold);
console.log("Queries count:", progResult.queries.length);

console.log("\n=== QUERY BUILDING ===");
const queries = buildSkillQueries(normalized, threshold);
console.log("Number of queries:", queries.length);
queries.slice(0, 5).forEach((q, i) => console.log(`  Query ${i+1} (size ${q.length}):`, q));

console.log("\n=== SKILL TOKENIZATION (current implementation) ===");
const skillsString = JSON.stringify(skills);
console.log("JSON string:", skillsString);
const tokenized = tokenize(skillsString);
console.log("Tokenized:", tokenized);

console.log("\n=== SEARCH STRATEGY WITH TARGET ROLE ===");
const allJobs = [
  { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform", "docker", "kubernetes", "linux"], description: "Cloud Engineer with AWS, Terraform, Docker, Kubernetes, Linux", source: ["arbeitnow"] },
  { slug: "2", title: "DevOps Engineer", tags: ["aws", "docker", "kubernetes", "ci/cd", "terraform"], description: "DevOps with AWS, Docker, Kubernetes, CI/CD, Terraform", source: ["arbeitnow"] },
  { slug: "3", title: "Java Developer", tags: ["java", "spring boot", "hibernate", "jpa", "junit"], description: "Java Developer with Spring Boot, Hibernate, JPA, JUnit", source: ["arbeitnow"] },
  { slug: "4", title: "DevOps Engineer", tags: ["aws", "docker", "ci/cd", "linux", "terraform"], description: "DevOps Engineer with AWS, Docker, CI/CD, Linux, Terraform", source: ["arbeitnow"] },
];

const result1 = applySearchStrategyWithTargetRole(normalized, "Cloud Engineer", allJobs, { 
  id: "combined", 
  provider: "search-strategy" 
});

console.log("Jobs returned:", result1.jobs.length);
console.log("Meta:", result1.meta);
result1.jobs.forEach(j => console.log("  -", j.title, "tags:", j.tags));

console.log("\n=== CANDIDATE POOL BUILDING ===");
const skills2 = normalized;
const allJobs2 = [
  { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform", "docker", "kubernetes", "linux"], description: "Cloud Engineer with AWS, Terraform, Docker, Kubernetes, Linux", source: ["test"] },
  { slug: "2", title: "DevOps Engineer", tags: ["aws", "docker", "kubernetes", "ci/cd", "terraform"], description: "DevOps with AWS, Docker, Kubernetes, CI/CD, Terraform", source: ["test"] },
  { slug: "3", title: "Java Developer", tags: ["java", "spring boot", "hibernate", "jpa", "junit"], description: "Java Developer with Spring Boot, Hibernate, JPA, JUnit", source: ["test"] },
  { slug: "4", title: "Backend Developer", tags: ["java", "spring", "sql", "oracle", "pl/sql"], description: "Backend Developer with Java, Spring, SQL, Oracle, PL/SQL", source: ["test"] },
  { slug: "5", title: "Frontend Developer", tags: ["react", "typescript", "javascript"], description: "Frontend Developer with React, TypeScript, JavaScript", source: ["test"] },
];

const result2 = buildCandidatePool(normalized, allJobs2, { id: "test" }, { candidatePoolTarget: 50, minCandidatePoolTarget: 10 });
console.log("Strategy:", result2.meta.strategy);
console.log("Threshold:", result2.meta.threshold);
console.log("Stages used:", result2.meta.stagesUsed);
console.log("Jobs returned:", result2.jobs.length);
result2.jobs.forEach(j => console.log("  -", j.title, "tags:", j.tags, "matches:", scoreJobBySkills({...j, description: j.description || ""}, normalized)));
