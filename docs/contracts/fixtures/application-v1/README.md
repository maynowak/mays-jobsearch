# Application Management V1 Fixtures

Synthetic fixtures for `docs/contracts/schemas/JOBMATCHER-APPLICATION-V1.schema.json`.
They contain no real applicant data, no CV files and no credentials.

- `application.draft.json` — initial draft
- `application.submitted.json` — explicit submit
- `application.feedback.json` — feedback event/status
- `application.interview.json` — interview event/status
- `application.offer.json` — offer and salary context
- `application.rejected.json` — rejected terminal state
- `application.withdrawn.json` — withdrawn terminal state
- `application.with-revisions.json` — cover-letter versions, CV reference, salary
- `application.follow-up.json` — optional open follow-up
- `application.update-follow-up.json` — versioned follow-up update input
- `application.create-draft.json` — create input
- `application.update-draft.json` — versioned update input
- `application.transition.json` — explicit submit transition input
- `application.export.json` — owner-scoped export envelope
- `application.deletion-receipt.json` — deletion receipt
- `application.invalid-unknown-field.json` — negative shape fixture

The schema validates shape/field rules. Cross-field rules (owner, job/version
linkage, status continuity, version conflicts) are enforced by
`src/lib/applications/applicationDomain.ts` and its tests.
