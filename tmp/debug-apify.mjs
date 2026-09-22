import { fetchAllJobs } from "../api/_lib/sources/index.mjs";

const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
console.log("Jobs:", result.jobs.length);
console.log("Jobs:", JSON.stringify(result.jobs, null, 2));
console.log("Meta:", JSON.stringify(result.meta, null, 2));
