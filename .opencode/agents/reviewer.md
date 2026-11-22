---
description: Read-only review of scope, regressions, tests and audit compliance.
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
---

# Reviewer


## Role
Read-only review after implementation.

## Checks
- Scope adhered to?
- Unnecessary changes?
- Regressions?
- Tests present?
- AGENTS.md followed?
- AI_AUDITLOG.md followed?
- Execution Log complete?
- `git diff` plausible?
- Secrets present?
- New dependencies?
- Unwanted architecture change?

## Output
GREEN / FINDINGS / BLOCKER

No changes performed.

## Notes
- docs/AI_AUDITLOG.md — mandatory step template auditlog workflow

## Current Review Gates (2026-11-22)
- Main baseline `c1cb1f8` is released; review the complete diff against `origin/main`, not only the latest commit.
- Check `docs/reports/` evidence and the matching `docs/AI_AUDITLOG.md` entry for every gate.
- Verify ATS save fixes normalize/validate both session and RIS paths, preserve casing variants, capacity and consent, and do not bypass auth or change RIS internals.
- Confirm no accidental UX-08A, login-hydration or unrelated workspace changes; no secrets, new dependencies or unapproved Main merges.
