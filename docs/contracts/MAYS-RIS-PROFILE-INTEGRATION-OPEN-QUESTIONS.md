# Mays-RIS Profile Integration — Open Questions

**Status:** OPEN — no RIS assumptions are verified in this phase
**Date:** 2026-10-31

| # | Question | Job Matcher evidence | Required decision | Owner | Verification |
|---|---|---|---|---|---|
| 1 | Which RIS profile routes are actually reachable? | Job Matcher cannot prove RIS gateway state | handler, Terraform, OpenAPI, deployment and HTTP evidence must agree | RIS | authenticated staging smoke |
| 2 | Is `/me/jobsearches` live or code-only? | OPEN-5 is reported but not rechecked here | classify LIVE, IMPLEMENTED-NOT-DEPLOYED or OPEN | RIS | route matrix + curl |
| 3 | Can RIS represent 2 CV search profiles and 5 ATS children? | frontend target is 2/5; current session store is 50/5 | confirm aggregate or child resources and atomic caps | RIS | repository/API tests |
| 4 | How are ATS variants addressed? | current `CvAtsProfileEntry.searchProfileId` is parent ID | stable child ID and complete parent validation | RIS + JM | CRUD contract test |
| 5 | Can independent manual profiles use JobSearch? | no RIS evidence available | separate resource or explicit discriminator; never fake CV parent | RIS + JM | schema/ownership review |
| 6 | How are CV metadata and secure documents linked? | browser `File` is non-persistent; document ID is separate concept | define `cvId`/`documentId`, completion state and orphan cleanup | RIS | document lifecycle tests |
| 7 | What is the canonical SearchConfiguration mapping? | JM uses phrase skills, arrays, nullable numeric radius and modes | lossless mapping or explicit extension/version | RIS + JM | round-trip fixture |
| 8 | What is the auth/tenant claim contract? | JM has no persistence auth adapter | server-derived identity and tenant, no client authority | RIS | forged-ID negative tests |
| 9 | Are updates/deletes conditional? | required for remote adapter; no current remote code | `version`/ETag and race semantics | RIS | concurrent update/delete tests |
| 10 | Does list use keyed query and cursor pagination? | required to avoid scans | define GSI/access pattern and opaque cursor | RIS | load/cost review |
| 11 | How are error envelopes mapped? | current JM uses `{error, code}`; target docs define envelope | select v1 envelope and compatibility mapping | JM + RIS | contract fixture suite |
| 12 | Which cache data is deletable? | `cv-profile:<hash>` persists 30 days and client delete does not delete it | delete API or documented retention exception | JM + RIS/privacy | deletion test and policy |
| 13 | What does S3 versioned delete mean? | not verifiable from JM | logical marker, physical purge and retention rules | RIS | versioned-bucket test |
| 14 | Is a Job Matcher facade necessary? | no existing persistence backend | prefer direct adapter if RIS serves v1; facade only for mediation/translation | JM + RIS | architecture decision record |
| 15 | How does explicit session migration work? | current stores are session-only | preview, selected objects, idempotency, partial retry, server IDs | JM | migration contract tests |

## Required evidence package

The RIS handoff is ready for implementation only after questions 1–4, 6–10
and 12–13 have evidence. Questions 5 and 14 are architecture decisions;
question 15 belongs to the Job Matcher adapter implementation phase.

No question is silently resolved by historical reports or by the existence of a
handler function.
