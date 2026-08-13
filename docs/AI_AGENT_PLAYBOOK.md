# AI Agent Playbook

This playbook defines the reusable workflow for AI-assisted software engineering in the **My Job Matcher** repository.

Use this document before implementation work, reviews, bug fixing, or documentation updates.

---

## Purpose

The goal of this playbook is to reduce prompt duplication and create a consistent, maintainable way to work with AI agents across the project.

It establishes:

- engineering rules for AI assistants
- a standard task prompt structure
- a minimal-invasive execution workflow
- explicit validation expectations
- a consistent closing summary format

---

## Core Principles

### 1. Preserve the existing product

This project is already architected and styled.

AI assistants must preserve:

- the existing serverless function structure (`api/_lib/`)
- the frontend design language
- the documented design philosophy
- responsiveness
- accessibility
- the friendly error handling pattern

Do not treat the repository as a greenfield project.

### 2. Work minimal-invasively

Only modify the code or documentation required for the current task.

Do not:

- redesign the UI
- refactor unrelated code
- rename files or folders without necessity
- introduce new npm packages unless explicitly approved

### 3. Confirm the real cause first

Before changing code, identify the actual root cause of the problem using the current implementation.

Examples:

- fetch / response handling
- error mapping
- JSON parsing
- CSS `display` vs `hidden` behavior
- event ordering
- environment variable availability

Do not assume that a successful deploy proves correct behavior.

### 4. Reuse before creating

Prefer existing:

- shared helpers (`api/_lib/filter.mjs`, `api/_lib/ai.mjs`)
- design tokens
- error message patterns
- frontend utilities

Create new files only when the existing architecture does not provide a suitable place.

---

## Standard Workflow

### Step 1. Read only what is required

Read only the files necessary for the task.

Typical order:

1. task-relevant rules
2. directly affected endpoint
3. directly affected shared helper
4. one adjacent dependency if required

Avoid broad repo exploration when the task is local.

### Step 2. Analyze before editing

State the likely cause internally from the current code path.

Verify by checking:

- data source
- request / response shape
- state transitions
- relevant CSS rules
- error handling paths

### Step 3. Implement the smallest correct fix

Make the minimum change that addresses the confirmed cause.

Favor:

- local edits
- focused CSS corrections
- small logic adjustments
- existing abstractions

### Step 4. Validate explicitly

After changes, run the narrowest meaningful validation.

Preferred order:

1. `node --check <changed files>`
2. live endpoint verification with `curl` when possible
3. `vercel --prod` for deployment changes

### Step 5. Report consistently

After completion, provide a structured closing summary.

Do not provide a vague recap.

---

## Standard Prompt Structure

When opening a new AI task, use this structure.

```text
Context
- Existing static frontend + Vercel serverless functions
- No redesign
- Preserve architecture and design system

Task
- Describe the exact change

Constraints
- Files or sections that must not change
- No new dependencies
- Minimal-invasive implementation

Validation
- Required check command (node --check)
- Additional live endpoint checks if needed

Output
- Required summary format
```

---

## Validation Policy

### Syntax validation

If source code changes, run:

```bash
node --check app.js
node --check api/jobs.mjs
node --check api/match.mjs
node --check api/cover-letter.mjs
node --check api/alerts.mjs
node --check api/cron/digest.mjs
```

### Endpoint validation

If the task touches a serverless function, verify it live with `curl` against the deployed or local URL.

Explicitly separate:

- what was verified by syntax check
- what was verified by a live endpoint call
- what still requires browser confirmation

Never claim endpoint behavior was confirmed unless it was actually observed.

### Evidence standard

Use only confirmed evidence from:

- current source code
- command results
- live endpoint responses

Do not report assumptions as facts.

---

## Completion Format

Unless a task requests a more specific format, use:

### Summary

- what changed

### Validation Status

- whether `node --check` passed
- which endpoints were verified live

### Modified Files

- only files changed in this task

### Git Checkpoint

- files intentionally not changed when relevant

### Commit Title

- one conventional commit suggestion

### Git Commands

```bash
git add <files>
git commit -m "<commit title>"
git push
```

---

## Notes for Future AI Tasks

- Keep the UI clear and focused on matches.
- Prefer clarity over cleverness.
- For UI bugs, inspect DOM structure and CSS `hidden`/`display` behavior before adding more logic.
- For function bugs, inspect the request/response shape and error mapping first.
- Keep serverless functions dependency-free.

This file is the reusable AI engineering playbook for the repository.
