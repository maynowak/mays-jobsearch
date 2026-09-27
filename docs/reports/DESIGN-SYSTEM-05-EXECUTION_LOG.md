# DESIGN-SYSTEM-05 — WHY/PREPARE BOXES TOKENIZATION

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-18
- Task: DESIGN-SYSTEM-05
- Purpose: Tokenize Why/Prepare boxes (.why, .prepare, .prepare strong)
- Selectors affected: .why, .prepare, .prepare strong
- Tokens created:
  - --why-bg: #faf6ec
  - --why-border: #ede3cf
  - --why-radius: 10px
  - --prepare-bg: #f6eddb
  - --prepare-border: #c9a86b
  - --prepare-radius: 10px
  - --prepare-text: #8a6f43
- Files changed: src/styles.css (7 token defs + 3 selectors), docs/AI_AUDITLOG.md
- Visual preservation: Original values preserved exactly; token values match hardcoded values
- Tests: 348 passed
- TypeScript: Passed
- Build: Passed (323ms)
- git diff --check: Clean
- Git state: Committed, pushed, synchronized
- Scope: Only Why/Prepare boxes. Badges, score, forms, buttons, workspace, ConsentGate, PrivacyNotice, tag, HTML content, city suggestions, typography, spacing, shadows, z-index, transitions, border-radius scale, dark mode, ATS, job matching, search, API untouched.
- Note: Values #faf6ec, #ede3cf, #f6eddb, #c9a86b, #8a6f43 also appear in OUT-OF-SCOPE areas (city-plz, html-content blockquote) which were NOT modified.
