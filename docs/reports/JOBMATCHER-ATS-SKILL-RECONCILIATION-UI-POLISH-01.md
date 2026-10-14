# JOBMATCHER-ATS-SKILL-RECONCILIATION-01 — IMPLEMENTATION REPORT

Status: **GREEN** ✅
Datum: 2026-10-14
Branch: main

## 1. Ausgangszustand
Die ATS-Analyse im `AtsOverlay` war rein lesend. Benutzer konnten zwar sehen, welche Skills fehlten (Gaps/Unknown), aber diese konnten nicht direkt im Kontext des Jobvergleichs ergänzt und wieder analysiert werden.

Beobachtete Probleme:
- Keine interaktive Skill-Bestätigung.
- Keine Differenzanzeige nach Skill-Ergänzung.
- Keine Trennung zwischen relevanten Skills und Metadaten (z.B. `(m/w/d)`, `Senior`, `Vollzeit`).
- Wortfragmente wie `architect-` wurden nicht normalisiert.

## 2. Implementierte Änderungen

### Store-Layer (`src/lib/cvProfileStore.ts`)
- **Neu: `updateCvAtsProfileSkills`** — Zielgerichtete Aktualisierung der Skill-Liste für ein spezifisches ATS-Profil.
    - Integritätschecks: Profil gehört zum übergebenen Suchprofil im richtigen CV-Kontext.
    - Idempotenz: Duplikate werden nicht gespeichert.

### UI-Layer (`src/components/AtsOverlay.tsx`)
- **Neu konfigurierte State-Machines**:
    - `addedSkillKeys: Set` — verfolgt bereits bestätigte Skills.
    - `recError`, `recNotice` — globale Reconciliation-Status-Meldungen.
    - `effectiveSkillsRef` — Ref für aktuelle Skills, unabhängig vom Parent-Render.
- **Neue Handler**:
    - `handleSkillConfirm(req, key)` — prüft Duplikate, ruft Store-Update + Re-Analyse auf.
    - `runReevaluation(addedSkill)` — lokale Skill-Erweiterung + API-Refresh.
- **Neues Rendering**:
    - `renderGapAction(req, key)` — zeigt Button (44px Touch Target) oder Badge auf Erfolg.
    - `renderReconcileStatus()` — aria-live Statuszeile für Screenreader.
- **Wirkung der Profilhierarchie**: Nur Requirements mit `category === "skill" || "keyword"` erhalten den Add-Button.

### Backend (`api/_lib/ats.mjs`)
- **Semantic Normalization**: `normalizeSkill`, `areSkillsEquivalent` für korrekte Matching.
- **Metadata Filtering**: `isTechnicalSkill`, `METADATA_PATTERNS` entfernen `(m/w/d)`, `Senior`, `Vollzeit`, `Kollektive Rollen`.
- **Export**: `extractRequirementsFromJob` jetzt exportiert für Tests.
- **Dialog-Status**: `skill-selection` → `cv.statusSkillSelect` („Skills auswählen“ statt „Wird verarbeitet...“).

### App.tsx
- **Titel dynamisch**: `cv.statusTitleSkillSelection` für den ATS-Skill-Step.
- **onSkillAdded**: `throw` statt `setStatus` -> Overlay zeigt Error / Recovery.

### Styles (`src/styles.css`)
- `.ats-skill-add` — 44px Mindesthöhe, Glass-Optik, Hover-/Focus-States.
- `.ats-skill-badge` — Erfolg-Anzeige mit grünem Glas.
- `.ats-gap-row` — responsive Layout.
- `.ats-spinner--sm` — kleiner Spinner für inline-Status.

## 3. Test-Ergebnisse
```
Test Files  68 passed | 3 skipped
Tests       791 passed | 5 skipped
```
Alle bestehenden Tests bestanden. Neue i18n-Keys und UI-Elemente wurden nicht in bestehende Tests integriert (da neu).

## 4. Bekannte Einschränkungen
- Die Reconciliation erfolgt nur in der GAP/UNKNOWN-Region, nicht in MATCHED-Requirements.
- Der Score-Delta wird nur angezeigt, wenn die Re-Analyse erfolgreich war.
- Backend-Tests nutzen den Flywheel-Cache nicht (`api/_lib/ats.mjs` läuft serverseitig, nicht in Tests).

## 5. Git-Historie
Commit: (siehe ausgeführte Commits)

---

## Technical Details (Zusammenfassung)

| Änderung | Datei |
|----------|-------|
| i18n-Keys (EN+DE) | `src/i18n.tsx` |
| Reconciliation State + Handler | `src/components/AtsOverlay.tsx` |
| Skill-Steps-Status | `src/components/CvProcessingStatus.tsx` |
| Dialog-Titel-Konditionalisierung | `src/App.tsx` |
| Metadata-Filter | `api/_lib/ats.mjs` |
| CSS-Struktur | `src/styles.css` |