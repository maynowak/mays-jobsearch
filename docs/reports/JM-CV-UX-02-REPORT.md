# JM-CV-UX-02 — CV-Speicheraktionen und UX

**Status:** `COMPLETE — LOCAL/UNIT VERIFIED — LIVE RIS E2E NOT EXECUTED`
**Datum:** 2026-11-16
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-ux-02-save-actions`
**Basis:** `feature/jm-cv-ux-01-save-blocker` @ `ce84ee5`
**Implementierungs-Commit:** `54475ed`

Kein Main-Merge, kein Production-Deployment, keine RIS-/AWS-/Terraform-/Cognito-
Änderung, keine neue Speicher-API, kein Consent-Umbau.

---

## 1. Ausgangslage

JM-CV-UX-01 war zum Start **nicht** in `origin/main` enthalten (`origin/main`
`464783b`, UX-01 `ce84ee5`). Der Branch wurde daher korrekt auf UX-01
aufgebaut. Die vier bekannten untracked Fremddateien blieben unverändert.

---

## 2. Neue Beschriftungen

| Aktion | Deutsch | Englisch |
|---|---|---|
| Sitzungsspeicherung | **Entwurf übernehmen** | **Use draft** |
| PDF-Download | **PDF herunterladen** | **Download PDF** |
| Dauerhafte PDF-Speicherung | **PDF dauerhaft speichern** | **Save PDF permanently** |
| Editor schließen | **Schließen** | **Close** |

Die Sitzungsaktion heißt bewusst nicht mehr „Lebenslauf speichern“, weil sie
nur den editierbaren Entwurf für die aktuelle Sitzung übernimmt. Die dauerhafte
Aktion speichert ausdrücklich nur das **generierte PDF**, nicht den
strukturierten Entwurf.

---

## 3. Primäre Speicheraktion

„PDF dauerhaft speichern“ ist jetzt die visuell primäre Aktion:

- Türkis-/Petrol-Verlauf mit weißem, gut lesbarem Text,
- dezentes Speicher-SVG (keine neue Bibliothek),
- Hover: leichte Anhebung, Cyan-Glow, Brightness,
- Focus: 3-px-Cyan-Ring,
- Active: ruhiger Druckzustand,
- Disabled: reduzierte Opazität, kein Hover, `cursor: not-allowed`,
- Loading: Spinner statt Icon, `aria-busy`, Text „PDF wird dauerhaft
  gespeichert …“,
- Mobile ≤ 430 px: volle Breite.

„Entwurf übernehmen“ und „PDF herunterladen“ sind nun sekundäre
`btn-ghost`-Aktionen; der Download ist damit klar vom dauerhaften Speichern
unterscheidbar.

---

## 4. Speicherzustände

| Zustand | Umsetzung |
|---|---|
| Noch nicht dauerhaft gespeichert | „Noch nicht dauerhaft gespeichert.“ |
| PDF wird gespeichert | Button-Text + Spinner + `aria-busy` |
| PDF erfolgreich gespeichert | Erfolgsmeldung nur nach `onSavePdfToRis === true` |
| Speicherung fehlgeschlagen | sichere Meldung „Das PDF konnte nicht dauerhaft gespeichert werden. Bitte versuche es erneut.“ |
| Validierung blockiert | sichtbarer Blockhinweis + Button-Title; UX-01-Fehlernavigation bleibt |
| Anmeldung/Einwilligung erforderlich | bestehende Statusmeldungen bleiben |
| Kapazität erreicht | bestehende Meldung bleibt |

Der „Noch nicht dauerhaft gespeichert“-Hinweis verschwindet während des
Speicherns und nach Erfolg. Bei einer Änderung des Entwurfs wird die alte
PDF-Erfolgsmeldung zurückgesetzt, damit sie nicht für einen veralteten Stand
steht.

---

## 5. Informationsbanner

Der lange Banner wurde auf drei unmittelbare Aussagen reduziert:

**Deutsch:**

- „Dein editierbarer Entwurf bleibt nur in dieser Sitzung und wird beim
  Neuladen verworfen.“
- „‚PDF herunterladen‘ erstellt die Datei lokal.“
- „‚PDF dauerhaft speichern‘ legt das PDF in deinem Benutzerkonto ab.“

**Englisch:**

- „Your editable draft stays only in this session and is cleared on reload.“
- „‘Download PDF’ creates the file locally.“
- „‘Save PDF permanently’ stores the PDF in your account.“

Der Begriff „RIS“ wurde aus den sichtbaren CV-Builder-Speicher- und
Importtexten entfernt und durch „Benutzerkonto“/„gespeicherter Lebenslauf“
ersetzt. Interne API-/Vertragsnamen bleiben unverändert.

---

## 6. Konsistenz

- Modal und Vollansicht nutzen dieselbe Komponente und dieselben Labels.
- DE/EN-Texte wurden gemeinsam aktualisiert; ein englischer Regressionstest
  prüft die Hauptlabels und den Banner.
- Tastatur/Screenreader: echte Buttons, `type="button"`, `aria-busy`,
  Focus-Ring, Status-/Alert-Rollen.
- Mobile: primärer Button volle Breite; Footer-Aktionen bleiben mindestens
  44 px hoch.
- UX-01-Fehlernavigation („Zum ersten Fehler“, Abschnitt öffnen, Feld
  fokussieren) bleibt erhalten.
- Sitzungsstatus im Footer spricht jetzt von „Entwurf übernommen“ statt
  „gespeichert“.

---

## 7. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/CvBuilderEditor.tsx` | Labels/Status, primärer Speicherbutton, Icon/Spinner, Banner, Reset nach Entwurfsänderung |
| `src/i18n.tsx` | DE/EN-Texte, RIS-Begriff in sichtbaren CV-Builder-Texten ersetzt |
| `src/styles.css` | Primärbutton, Hover/Focus/Disabled/Loading, Mobile |
| `src/components/CvBuilderEditorRisStorage.test.tsx` | Labels, Primärbutton, Zustände, Loading, EN |
| `src/components/CvBuilderEditor.test.tsx` | Sitzungslabels/Status |
| `src/components/CvBuilderEditorPdf.test.tsx` | Download-Label |
| `src/components/CvBuilderEditor.profile.test.tsx` | Sitzungslabel |
| `src/components/CvBuilderWorkspacePage.test.tsx` | Speicherlabel |
| `src/App.test.tsx` | Sitzungslabel |
| `docs/reports/JM-CV-UX-02-REPORT.md` | Dieser Bericht |
| `docs/AI_AUDITLOG.md` | Audit-Eintrag |

Keine Änderung an `api/**`, RIS, AWS, Terraform, Cognito, Auth, Consent,
Matching oder Speicher-APIs.

---

## 8. Tests

### Fokussiert

```text
npx vitest run --maxWorkers=2 \
  src/components/CvBuilderEditor.test.tsx \
  src/components/CvBuilderEditorPdf.test.tsx \
  src/components/CvBuilderEditorRisStorage.test.tsx \
  src/components/CvBuilderEditor.profile.test.tsx \
  src/components/CvBuilderWorkspacePage.test.tsx \
  src/components/CvBuilderImportDialog.test.tsx \
  src/App.test.tsx
Test Files  7 passed (7)
     Tests  164 passed (164)
```

Abgedeckt: neue Labels, primärer Button/Icon, Download-Abgrenzung,
„Noch nicht dauerhaft gespeichert“, Erfolg nach bestätigtem Upload,
Reset nach Entwurfsänderung, Loading/Doppelklick-Schutz, Englisch,
bestehende Auth-/Consent-/Kapazitätssperren, UX-01-Fehlernavigation.

### Vollsuite

```text
npx vitest run --maxWorkers=2
Test Files  179 passed | 4 skipped (183)
     Tests  1900 passed | 11 skipped (1911)
```

### Build / Diff

```text
npm run build
✓ built in 1.15s

git diff --check
# Exit 0, keine Fehler
```

### Live-RIS

**Nicht ausgeführt.** Keine ausdrückliche Live-Test-Freigabe mit synthetischen
Daten und genehmigter RIS-/Preview-Umgebung. Die Tests sind Komponenten-/Hook-
Tests mit gemocktem Upload-Pfad; sie werden nicht als RIS-Live-E2E ausgegeben.

---

## 9. Verbleibende Einschränkungen

1. **Live-RIS-/S3-E2E nicht verifiziert** — benötigt separate Testfreigabe.
2. **Hover/Focus/Disabled/Loading** wurden per CSS und Komponenten-Tests
   abgesichert, aber nicht in einem echten Browser-Screenshot visuell
   abgenommen.
3. **Production-Deployment** nicht Teil dieses Auftrags.
4. **Sitzungsstatus und dauerhafter PDF-Status** sind bewusst getrennt; der
   strukturierte Entwurf wird weiterhin nicht dauerhaft gespeichert.

---

## 10. Git

| Feld | Wert |
|---|---|
| Branch | `feature/jm-cv-ux-02-save-actions` |
| Basis | `ce84ee5` (UX-01, nicht in main) |
| Implementierungs-Commit | `54475ed` |
| Remote-Branch | `origin/feature/jm-cv-ux-02-save-actions` |
| Push | bestätigt (Remote = `54475ed`) |
| Main-Merge | nein |
| Production-Deployment | nein |

Der Report-/Audit-Commit folgt auf demselben Branch.

---

## 11. Ergebnis

**COMPLETE — im autorisierten lokalen Testumfang.**

Die Speicheraktionen sind fachlich klar getrennt, die dauerhafte PDF-Speicherung
ist visuell primär, und die Zustände sind verständlich. Der bestehende
RIS-/Upload-Pfad und alle Sicherheits-/Consent-Prüfungen bleiben unverändert.
