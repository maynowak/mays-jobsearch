# Report: JOBMATCHER-CV-CONTEXT-EVIDENCE-INTEGRITY-01

## 1. Root Cause Analysis
The previous implementation of `inferSkillsFromContext` applied regular expressions to the entire CV text as a single string. This led to "contextual leakage" where a technology mentioned in one paragraph (e.g., "Java") and an activity mentioned in another (e.g., "Entwicklung") were combined to infer a skill (e.g., "Backend-Entwicklung"), even if there was no actual connection between them.

**Verified False Positive:**
- Input: `"Kenntnisse in Java.\n\nEntwicklung einer Website."`
- Result: `Backend-Entwicklung` (False Positive).

## 2. Implementation Strategy

### Segmented Inference
The text is now split by paragraphs (`\n+`). Each paragraph is treated as an independent unit of evidence. An inference can only be triggered if both the technology and the activity proof are found within the same paragraph.

### Activity Proof (Tätigkeitsnachweis)
A new helper `hasActivityProof` ensures that a skill is only inferred if the segment contains an active verb or noun (e.g., *entwickelt*, *implementiert*, *konzeption*).

### Exclusion Rules (Negationen & Absichten)
A conservative filter `isInvalidContext` identifies and excludes segments containing:
- Negations ("keine Erfahrung mit")
- Intentions/Learning wishes ("möchte lernen", "plane zu lernen", "interessiert an")
- Future plans ("künftig einsetzen")

### Evidence Integrity
- The `evidence` field now contains the exact trimmed paragraph that triggered the inference.
- This prevents the creation of artificial "composite" quotes.

### Deduplication
A `Map` is used to ensure only one suggestion per skill. If multiple paragraphs provide evidence for the same skill, the one with the highest `importance` (and then the shortest length for conciseness) is selected.

## 3. Test Results

### Targeted Integrity Tests (`tests/inference_integrity.ts`)
| Case | Input | Result | Status |
| :--- | :--- | :--- | :--- |
| Split Paragraphs | "Java" $\text{NL}$ "Entwicklung" | No Inference | ✅ PASS |
| Interests | "Interesse an Kubernetes" | No Inference | ✅ PASS |
| Future Plans | "Plane Terraform einzusetzen" | No Inference | ✅ PASS |
| Negation | "Keine Erfahrung mit Docker" | No Inference | ✅ PASS |
| Positive Case | "Entwicklung von REST-APIs mit Java" | API-Entwicklung | ✅ PASS |
| Deduplication | Multiple API evidences | 1 Proposal | ✅ PASS |
| Evidence Integrity | Multi-para text | Exact Paragraph | ✅ PASS |

### System Validation
- `npm test`: All existing tests passed.
- `npm run build`: Success (TypeScript check passed).

## 4. Known Constraints
- **Segment Granularity:** The system currently segments by paragraph. If a user writes a very long paragraph containing multiple unrelated sentences, it is still treated as one context. Further sentence-level splitting was avoided to keep evidence readable.
- **Rule-Based:** The system remains deterministic and does not use an LLM for this local step, ensuring zero additional data transfer.

## 5. Git
- **Commit:** `feat(CV): implement evidence integrity for context inference`
