
import { inferSkillsFromContext } from '../src/lib/contextInference.ts';

const testCases = [
  {
    name: "Split Paragraphs (False Positive Risk)",
    text: "Kenntnisse in Java und Spring Boot.\n\nEntwicklung einer Datenbankanwendung mit SQL.",
    expectedNo: "Backend-Entwicklung",
    description: "Should not infer Backend-Dev if Java and 'Entwicklung' are in separate paragraphs"
  },
  {
    name: "Interests (False Positive Risk)",
    text: "Ich interessiere mich sehr für Kubernetes und möchte es lernen.",
    expectedNo: "Containerisierung",
    description: "Should not infer skill from interests"
  },
  {
    name: "Future Plans (False Positive Risk)",
    text: "Ich plane, Terraform für AWS einzusetzen.",
    expectedNo: "Infrastructure as Code",
    description: "Should not infer skill from future plans"
  },
  {
    name: "Negation (False Positive Risk)",
    text: "Keine Erfahrung mit Docker.",
    expectedNo: "Containerisierung",
    description: "Should not infer skill from negation"
  },
  {
    name: "Positive Case",
    text: "Entwicklung von REST-APIs mit Java und Spring Boot.",
    expectedYes: "API-Entwicklung",
    description: "Should infer API-Dev from direct evidence"
  },
  {
    name: "Multiple Evidence (Deduplication)",
    text: "Entwicklung von REST-APIs mit Java.\n\nImplementierung von API-Services mit Spring Boot.",
    expectedCount: 1,
    skill: "API-Entwicklung",
    description: "Should only suggest one 'API-Entwicklung' even if multiple pieces of evidence exist"
  },
  {
    name: "Evidence Integrity (Paragraph Level)",
    text: "Ich habe eine App entwickelt.\nEntwicklung von REST-APIs mit Java.",
    expectedEvidence: "Entwicklung von REST-APIs mit Java.",
    skill: "API-Entwicklung",
    description: "Evidence should be the specific paragraph containing the trigger"
  }
];

console.log("--- Context Inference Integrity Tests ---");
testCases.forEach(tc => {
  const results = inferSkillsFromContext(tc.text);
  const skills = results.map(r => r.skill);

  let passed = true;
  if (tc.expectedNo && skills.includes(tc.expectedNo)) {
    passed = false;
  }
  if (tc.expectedYes && !skills.includes(tc.expectedYes)) {
    passed = false;
  }
  if (tc.expectedCount !== undefined && skills.filter(s => s === tc.skill).length !== tc.expectedCount) {
    passed = false;
  }
  if (tc.expectedEvidence) {
    const res = results.find(r => r.skill === tc.skill);
    if (!res || res.evidence !== tc.expectedEvidence) {
      passed = false;
    }
  }

  console.log(`${passed ? '✅' : '❌'} ${tc.name}`);
  if (!passed) {
    console.log(`   - Text: ${tc.text.replace(/\n/g, ' [NL] ')}`);
    console.log(`   - Found: ${JSON.stringify(results)}`);
    console.log(`   - Expected: ${tc.expectedNo ? 'NOT ' + tc.expectedNo : tc.expectedYes || (tc.expectedCount !== undefined ? 'Count ' + tc.expectedCount : 'Evidence ' + tc.expectedEvidence)}`);
  }
});
