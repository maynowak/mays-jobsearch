=================================================
EXECUTION LOG / CRASH RECOVERY — MANDATORY
=================================================

Maintain a current execution log throughout the audit:

docs/reports/[NO. OF TASK ++]-[SUBWORKING NO.]-[TASK]-EXECUTION_LOG.md

This is mandatory even though the audit is READ-ONLY.

The execution log must be created or updated continuously after
meaningful audit milestones, NOT only at the end.

The log must preserve the latest verified state so that work can be
resumed safely after an agent crash, terminal failure, streaming
failure, IDE restart, or interrupted session.

Record only verified facts. Never invent findings or validation results.

The execution log must contain:

- current status
- audit date/time
- current Git branch and HEAD
- audit scope
- completed audit sections
- actual findings
- evidence / file references
- GREEN / YELLOW / ORANGE / RED / GRAY classification
- Terraform checks actually executed and their results
- Git status
- files changed, if any
- explicit confirmation when no files were changed
- open questions
- risks
- recommended next actions
- current resume point

After each major section, update the execution log before continuing.

At the end, finalize the log with the complete audit summary.

IMPORTANT:
The execution log itself is part of the audit workflow and must be
kept accurate even if the audit remains completely read-only.

=================================================
CHANGE RECORD — AUTH / COGNITO (REFERENCE)
=================================================

2026-10-23 · JOBMATCHER-COGNITO-IDP-FIX-01
- Change: App Client `5hb3f6dj5ialg77jf4blur9g6g` (User Pool
  `eu-central-1_ZURSMpD2O`) — `SupportedIdentityProviders` = `["COGNITO"]`.
- Only field changed: `SupportedIdentityProviders` (plus `LastModifiedDate`).
  User Pool, Client-ID, Domains, Branding, Callback-/Logout-URLs,
  OAuth-Flows/-Scopes unchanged (verified by before/after describe).
- AI-/Privacy-/Data-Flow impact: none. No new resources, no new data flows,
  no additional personal data, no secrets recorded.
- Verification: `/oauth2/authorize` 302 -> `/login` HTTP 200 with email and
  password fields; unregistered redirect_uri still rejected.
- Log: docs/reports/04-03-COGNITO-IDP-FIX-01-EXECUTION_LOG.md

=================================================
CHANGE RECORD — PRODUCTION REDIRECT (REFERENCE)
=================================================

2026-10-23 · JOBMATCHER-PRODUCTION-REDIRECT-FIX-01
- Status: Kein Fix erforderlich. Produktion korrekt konfiguriert.
- Vercel Production: VITE_REDIRECT_URI=https://www.mays-job-matcher.app/auth/callback
- Gebautes Bundle: redirect_uri=https://www.mays-job-matcher.app/auth/callback
- Browser-Test (Playwright): authorize sendet korrekten redirect_uri, Cognito zeigt /login
- AI-/Privacy-/Data-Flow impact: none.
- Log: docs/reports/05-01-PRODUCTION-REDIRECT-FIX-01-EXECUTION_LOG.md
