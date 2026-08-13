# Project Rules

Theme

Modern.

Clear.

Trustworthy.

Motivating.

Do not create flashy UI.

Always keep the focus on the matches.

Website Flow

Hero

↓

Search Form

↓

Matches (ranked cards)

↓

Cover Letter Modal

↓

Alert Form

Secrets

API keys only via `process.env`.

Never expose keys in the frontend.

Error Handling

Friendly messages.

No crashes.

No raw stack traces in the UI.

Accessibility

Keyboard navigation.

Visible focus states.

Semantic HTML.

Sufficient contrast.

Performance

Minimal JS.

No unnecessary dependencies.

Responsive first.

Validation

`node --check <file>` after changes.

Verify endpoints live with `curl`.

---

## AI-Assisted Workflow

For reusable AI engineering workflow rules, use:

- `docs/AI_AGENT_PLAYBOOK.md`

This repository follows a minimal-invasive AI development process.

AI assistants must:

- analyze the current implementation before editing
- read only the files required for the task
- preserve the existing architecture and design language
- validate source changes explicitly
- distinguish between build success and endpoint-confirmed behavior

---

## Prompt Baseline

Task prompts should define:

- context
- exact task
- constraints
- validation command
- expected output format

---

## Validation Baseline

When code changes are made:

- run `node --check` on changed files
- verify serverless endpoints with a live call when possible
- do not present unverified endpoint behavior as confirmed

---

## Documentation Goal

These rules exist to improve:

- consistency
- maintainability
- reproducibility
- quality assurance

across future AI-assisted development work.
