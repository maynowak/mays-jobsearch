import { tokenize } from "./api/_lib/filter.mjs";

// Test array input (new format from API)
const skillsArray = [
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

console.log("=== ARRAY INPUT (new format) ===");
const result = tokenize(skillsArray);
console.log("Tokenized:", result);
console.log("Count:", result.length);

// Test legacy string input (backward compatibility)
const legacyString = "Java, Spring Boot, AWS, Terraform";
console.log("\n=== STRING INPUT (legacy format) ===");
const legacyResult = tokenize(legacyString);
console.log("Tokenized:", legacyResult);

// Test keywordHits with multi-word skills
const { keywordHits } = await import("./api/_lib/filter.mjs");

const job = {
  title: "Cloud Engineer",
  tags: ["aws", "terraform", "docker", "kubernetes", "linux", "spring boot"],
  description: "Cloud Engineer with AWS, Terraform, Docker, Kubernetes, Linux, Spring Boot"
};

const skills = ["AWS", "Terraform", "Spring Boot", "Docker", "Kubernetes", "Linux", "Java", "Spring Boot", "Microservices"];
const keywordTokens = skills.map(s => s.toLowerCase().trim());

console.log("\n=== KEYWORD HITS TEST ===");
const hits = keywordHits(job, keywordTokens);
console.log("Keyword tokens:", keywordTokens);
console.log("Hits:", hits);
console.log("Expected: 7 (aws, terraform, spring boot, docker, kubernetes, linux, microservices)");
