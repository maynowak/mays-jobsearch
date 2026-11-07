# JM-RIS-PRIVACY-RG09-PREVIEW-QA-02

## Result

`PRIVACY V1.1 CONTENT VERIFIED / PREVIEW ROUTE FIX READY — RE-PUSH APPROVAL REQUIRED`

The existing preview at `8d991a7` does **not** yet serve the corrected `/datenschutz`
route. The root cause is a stale static `public/datenschutz/index.html` that
shadows the SPA and contains the old 1.0 text plus the internal editorial note.
A local correction is committed; it must be re-pushed to a preview for final
route verification.

## 1. Checked preview URLs

| Project | Deployment | Preview URL |
| --- | --- | --- |
| mays-jobsearch | `dpl_GNQyuXc4cWrg1UFxVEsoot55Svmo` | https://mays-jobsearch-mmvfeuane-maymilly.vercel.app |
| mays-job-matcher | `dpl_7QKubsTizb7fgU45a6YZZT2NDWEb` | https://mays-job-matcher-ejbfphmoz-maymilly.vercel.app |

Both deployments are `READY` at commit `8d991a781f05a43535c6ae715bf05ae6cf638016`.

## 2. Preview results

| Check | `/datenschutz` (preview) | `/legal/datenschutz.html` (preview) |
| --- | --- | --- |
| HTTP | 200 | 200 |
| Version 1.1 · 7 Nov 2026 | **NO** — old `Stand: 10. Oktober 2026` | **YES** |
| Internal editorial note | **YES** | **NO** |
| Semantic headings | **NO** — `<pre>` text | **NO** — `<pre>` text |
| Footer navigation | **NO** | **NO** |
| Desktop overflow | **YES** | NO |
| Mobile overflow | Not separately needed; old pre page | NO |
| Public without login | YES | YES |

The preview `/datenschutz` is served by `public/datenschutz/index.html`, not by
the SPA route. That static page contains the old 17-section text and the note
`REDAKTIONELLE FREIGABEPRÜFUNG – NICHT ALS WEBSITE-TEXT VERÖFFENTLICHEN`.

The preview `/legal/datenschutz.html` already contains the v1.1 content and no
internal note, but it still uses a plain `<pre>` layout.

## 3. Local corrected results

Local preview: `http://127.0.0.1:4173` after a production build.

| Check | Desktop 1440×900 | Mobile 390×844 |
| --- | --- | --- |
| Version 1.1 · 7 Nov 2026 | PASS | PASS |
| Internal note absent | PASS | PASS |
| Semantic structure | H1 1 / H2 1 / H3 19 / P 38 | same |
| Horizontal overflow | PASS (none) | PASS (none) |
| Footer present | PASS (5 links) | PASS |
| Public without login | PASS | PASS |
| Footer link to `/datenschutzprinzipien` | PASS | — |

Screenshots and raw results:
- `docs/reports/assets/JM-RIS-PRIVACY-RG09-PREVIEW-QA-02/local-desktop-1440.png`
- `docs/reports/assets/JM-RIS-PRIVACY-RG09-PREVIEW-QA-02/local-mobile-390.png`
- `docs/reports/assets/JM-RIS-PRIVACY-RG09-PREVIEW-QA-02/results.json`

## 4. Corrections committed locally

1. Removed the stale static `public/datenschutz/index.html`; `/datenschutz` now
   uses the SPA route.
2. Fixed the early landing-page return in `App.tsx` so `/datenschutz` and
   `/datenschutzprinzipien` reach their legal components.
3. Reworked `Privacy.tsx` to render semantic headings (`h1`/`h3`), paragraphs,
   and clickable URL/e-mail links instead of a single `<pre>`.
4. Regenerated `public/legal/datenschutz.html` as semantic HTML; it remains a
   direct HTML mirror.
5. Updated Privacy/PrivacyDocument tests, including semantic headings, links,
   direct routes, and stale-static-shadow detection.
6. Added responsive/readable document styles.

No policy content was changed in this QA step.

## 5. Tests

- Focused Privacy/Consent/Footer tests: **20/20 PASS**
- `npm run build`: **PASS**
- `git diff --check`: PASS

Known full-suite flake:

- Previous full run: **1535 passed, 5 skipped, 1 failed** in
  `CvBuilderEditorPdf.test.tsx` (unrelated to privacy).
- Isolated rerun: **4/4 PASS**.

No Consent or ApplicationV1 feature flag was activated. No RIS backend, AWS,
Terraform, Cognito, secret, merge, push, or production deployment was touched.

## 6. Git evidence

- Local correction commit: `4555521` on
  `feature/jm-ris-privacy-rg09-alignment-01`
- Previous pushed preview head: `8d991a7`
- Correction is **not pushed**; preview re-push requires separate approval.

## 7. Recommendation

1. Approve a preview-only re-push of `4555521` (no merge).
2. Re-run the same `/datenschutz` desktop/mobile checks on the new preview.
3. Verify footer navigation and `/legal/datenschutz.html` on that deployment.
4. After preview PASS, proceed to release review. Legal approval of the pending
   consent/retention items remains a separate gate.
