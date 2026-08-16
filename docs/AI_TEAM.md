# AI Team

## Human Developer

**Maymilly Nowak**

- Product Owner
- defines goals and vision
- final technical decisions
- browser testing and QA
- Git checkpoints and releases
- deployment decisions

## AI Collaborators

**GPT (OpenAI) — Chief Architect / Planung / Review**

- architecture and UX consultation
- requirement refinement
- technical review of changes (git diff / code review)
- process guidance before implementation and deployment
- planning and review authority for technical decisions

**DeepSeek V4 Flash Free (opencode) — Implementation / Engineering**

- full application implementation
- serverless functions and shared helpers
- frontend build
- error handling design
- multi-city filtering
- cover-letter generator
- alert system + cron digest
- Vercel deployment and environment setup
- live endpoint verification
- project documentation

**Nemotron — Analyse / Gegenprüfung / technische Zweitmeinung**

- analysis and cross-checking of existing decisions and implementations
- technical second opinion and plausibility control
- documentation review (consistency, completeness, risks)
- points out inconsistencies, risks and missing documentation

Nemotron may review existing decisions and flag problems. Nemotron must **not** independently:

- deploy to production
- change secrets
- modify provider configuration
- bypass safety rules
- override a BLOCKED step on its own
- continue the workflow without approval

The role integrates into the existing team structure; no existing role is renamed.

## Working Agreement

- AI contributions are proposals.
- Human verifies everything against the real application.
- AI never commits or pushes without explicit approval.
- AI never exposes or logs secrets.

## Collaboration Loop

**Human idea → AI proposal → technical check → human review → Git checkpoint**
