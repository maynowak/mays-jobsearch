# JM-APPLICATION-EDIT-TAB-NAVIGATION-01

**Status: READY FOR VISUAL REVIEW**

- Branch: `feature/jm-application-edit-tab-navigation-01`
- Base: `origin/main` `c058555`
- Step 1 (tab/application switch with unsaved edit decision): `0d1c15b`
- Step 2 (own cover letter in the document tab): `87475e1`
- Branch pushed. No main merge, no production deployment, no force-push, no branch deletion.
- No RIS, AWS, Terraform, Cognito, consent-contract or storage-contract change.

## Goal

Two UX defects in the application management area:

1. Switching tabs or applications while the edit mask was open showed a
   warning even when nothing had been changed. Leaving the edit mask now
   compares the actual form values with the loaded application.
2. The Dokumente tab only offered AI letter assistance. A second, equal,
   non-AI path now allows writing and editing an own cover letter.

## Step 1 — Unsaved edit decision on tab/application switch

### Behaviour

- `ApplicationEditForm` compares the raw `EditDraft` fields with
  `draftFromApplication(application)`. Dirty means a real value difference,
  not focus, click or an unchanged field.
- Unchanged form: tab and application selection switch immediately, the edit
  mask closes without a warning and without a repository write.
- Dirty form: the selection is captured as pending navigation and an
  `alertdialog` offers:
  - `Speichern und wechseln` / `Save and switch`
  - `Änderungen verwerfen` / `Discard changes`
  - `Weiter bearbeiten` / `Continue editing`
- Save action: the dialog triggers the form save through an imperative
  `ApplicationEditFormHandle.save()`. The parent does not duplicate form
  state. Navigation happens only after the repository confirms the update.
- Save failure: dialog, form and every entered value stay in place. A retry
  is possible; no success is claimed.
- Discard action: the edit mask closes and the stored application is shown;
  no repository write happens.
- Continue editing: the dialog closes and focus returns to the form.
- Escape closes the dialog and keeps editing, including the form values.
- `ApplicationEditFormHandle.focus()` returns focus to the form; the form
  itself is now a focus target (`tabIndex={-1}`).
- Pending navigation is cleared when the repository, selected application,
  refresh token or session changes, so stale intents cannot navigate later.

The existing `letterDirty` protection for the AI proposal remains unchanged
and still wins before a tab/application switch.

## Step 2 — Own cover letter in the Dokumente tab

### Behaviour

- New `ApplicationOwnLetterEditor` region “Eigenes Anschreiben” above the
  existing version list. The AI assistant and the own letter are two equal,
  explicit options.
- Write/edit is an explicit action. There is no automatic AI request, no
  automatic save and no automatic version creation.
- The editor shows the storage mode: “Nur für diese Sitzung gespeichert.”
  or “Über RIS in deinem Konto gespeichert.”
- Save uses the existing repository contract:

  ```ts
  repository.update(applicationId, {
    expectedVersion: selected.version,
    changes: {
      coverLetterDraft: text,
      documentStatus: text.trim() ? "draft" : "missing",
    },
  })
  ```

- Session mode writes the session application; remote mode uses the existing
  RIS application BFF through the active repository. No extra API route, no
  new client and no new consent purpose are introduced.
- No cover-letter version is created. `coverLetterVersions` is preserved
  byte-for-byte; the existing “Aktuellen Entwurf als Version speichern”
  action stays the only way to add a version.
- Success text appears only after the repository confirmed the update. On
  failure the text stays in the textarea, no success is shown, and the editor
  remains open.
- Preview updates live while typing.
- Unsaved own-letter text participates in the same switch decision with its
  own texts (`Ungespeichertes Anschreiben`,
  `Anschreiben speichern und wechseln`). The dialog save/discard/continue
  actions dispatch to the editor; a confirmed save continues the pending
  navigation, discard drops only the local text.
- “Eigenes Anschreiben hinterlegen” / “bearbeiten” opens and focuses the
  editor. The existing draft shortcut opens the same editor.
- `letterDirty` for an open AI proposal still blocks a switch first; own
  letter and AI proposal cannot silently overwrite each other through this
  path.

### Accessibility and responsiveness

- Decision dialog uses `role="alertdialog"` with heading/description and
  focus on the save action; Escape and focus return are handled.
- Form, editor, heading and preview are focusable/group-labelled as needed;
  focus outlines are visible.
- Buttons and textarea stack full-width at ≤600 px.
- Screenshots at 1440 and 390 show no horizontal overflow.

## Tests

| Check | Result |
| --- | --- |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| Focused Applications/form/letter suites | **69 PASS** |
| Full serial suite `npx vitest run --maxWorkers=1` | **2105 PASS / 5 skipped** (202 files) |
| Browser E2E `npm run test:e2e:application-edit-tab-navigation-01` | PASS |
| `node --check` E2E | PASS |

New/extended tests in `ApplicationsSection.test.tsx`:

- unchanged edit switches tab without dialog or repository write;
- dirty edit switches application only after save;
- dirty edit keeps form values and dialog on save failure, then saves on retry;
- discard closes the edit without writing;
- Escape/continue editing keeps values and returns focus;
- own letter creates a session draft without AI calls and without a new
  version, and only one update call;
- own letter edit preserves existing versions and storage-mode text;
- own-letter repository failure keeps text and shows no success;
- own-letter dirty tab switch save path persists before navigating;
- own-letter discard switches without update;
- own-letter dirty application switch asks first and continues editing with
  the text intact.

Browser E2E (`tests/e2e/jm-application-edit-tab-navigation-01.mjs`, synthetic
identity, mocked BFF):

- unchanged edit → Dokumente without warning;
- dirty edit → save fails with synthetic 409 → dialog and value remain →
  retry succeeds → Kommunikation tab opens;
- own letter save in remote mode → list reload shows the text → edit again;
- version count stays 1 and the existing version content is unchanged;
- discard of own text leaves the saved text untouched;
- capability probe denied (503) → session-only mode, creating a session
  application performs no remote application write;
- 0 AI requests (`/api/profile`, `/api/match`, `/api/cover-letter`,
  `/api/ats-analysis` never called), 0 console/page errors, no overflow at
  1440 and 390.

## Screenshots

`docs/reports/assets/JM-APPLICATION-EDIT-TAB-NAVIGATION-01/`

- `edit-unsaved-dialog-1440.png`
- `own-letter-saved-1440.png`
- `session-mode-390.png`

## AI / privacy / data-flow audit

- No AI call, prompt, model or provider change. The E2E explicitly asserts
  zero AI requests.
- No new data category: the own letter reuses `coverLetterDraft`, already
  part of the application record and its existing session/RIS storage.
- No new consent purpose, no notice change, no retention change.
- No new persistence, cache or logging. Session mode remains memory-only;
  remote mode uses the existing application BFF and the existing
  capability/consent gate.
- No secret, token or personal data added to code, tests, reports or
  screenshots. E2E data is synthetic (`example.invalid`).
- No RIS repository, AWS account, Cognito, DynamoDB or Terraform access.

## Limits / next step

- No main merge and no production deployment in this task.
- No authenticated real-RIS write was executed; remote behaviour is verified
  against the existing repository contract and a mocked BFF in the browser.
- Visual review of the three screenshots is the remaining gate.
