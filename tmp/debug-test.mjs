import { analyzeJobForAts } from "../api/_lib/ats.mjs";

const job = {
  slug: "test-1",
  title: "React Developer",
  tags: ["react", "nodejs", "typescript"],
};
const profile = { skills: "React, TypeScript" };
const result = analyzeJobForAts(job, profile);

console.log("Requirements:", JSON.stringify(result.requirements, null, 2));
console.log("Matches:", JSON.stringify(result.matches, null, 2));
console.log("Summary:", JSON.stringify(result.summary, null, 2));
console.log("Recommendations:", JSON.stringify(result.recommendations, null, 2));
