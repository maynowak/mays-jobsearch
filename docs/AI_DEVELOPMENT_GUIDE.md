# AI Development Guide

This guide describes how AI-assisted development is performed in **My Job Matcher**.

It is a companion to `AI_AGENT_PLAYBOOK.md`.

---

## Principle

AI supports the development. It does not replace:

- product decisions
- design decisions
- testing
- deployment decisions

---

## Workflow

1. Human defines the goal.
2. Human formulates the task prompt (see `AI_AGENT_PLAYBOOK.md`).
3. AI reads the relevant context (`AI_CONTEXT.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`).
4. AI analyzes the current implementation.
5. AI implements the smallest correct change.
6. AI validates: `node --check`, live endpoint check, deploy.
7. Human reviews in the browser.
8. Iterate.

---

## Rules

- Preserve the existing architecture.
- Reuse `api/_lib/` helpers.
- No new npm dependencies without approval.
- Keys are server-side only.
- Friendly errors everywhere.
- Update `docs/CHANGELOG.md` after meaningful features.
- Update `docs/ROADMAP.md` when planning work.

---

## Validation commands

```bash
node --check app.js
node --check api/**/*.mjs
```

Live check example:

```bash
curl https://mays-job-matcher.vercel.app/api/jobs?skills=React&city=Berlin
```

---

## Documentation

All permanent documentation lives in `docs/`.

See `docs/PROJECT_RESOURCES.md` for the full index.
