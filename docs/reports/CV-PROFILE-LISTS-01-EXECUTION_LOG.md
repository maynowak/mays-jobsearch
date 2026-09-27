# CV-PROFILE-LISTS-01 — EXECUTION LOG

## Current status
FINALIZED — Implementierung abgeschlossen, alle Validierungen gruen.
Commit steht aus (erfolgt auf Nutzerfreigabe).

## Final state (2026-09-26)
- CV-PROFILE-LISTS-01 vollstaendig umgesetzt (siehe AI_AUDITLOG-Eintrag).
- Checks: 499/499 Tests PASS (6 Store-Unit-Tests + 3 Flow-Tests neu),
  TSC PASS, Build PASS, git diff --check CLEAN.
- Files changed: src/lib/cvProfileStore.ts (neu), src/lib/cvProfileStore.test.ts
  (neu), src/components/CvProfilesOverlay.tsx (neu),
  src/components/CvProfileResult.tsx, src/components/CvDocumentList.tsx,
  src/App.tsx, src/types.ts, src/i18n.tsx, src/styles.css, src/App.test.tsx,
  src/components/CvDocumentList.test.tsx, docs/AI_AUDITLOG.md, diese Datei.
- Testfaelle neu: Store (save/read/Hash-Trennung/Defaults/leer/korrupt),
  Suchprofil-Speicherfluss mit Overlay, ATS-Profil-Speicherfluss mit Overlay,
  Overlay-Leerzustand.
- Zusaetzlicher Fix im Verlauf: Test-Isolation — beforeEach leert jetzt auch
  mj-cv-lists:* (Hash ist content-stabil ueber Tests).
- Resume point: abgeschlossen; bei Abbruch git status zeigen lassen.

## Audit date/time
2026-09-26 (Start nach User-Feature-Request)

## Git state (Start)
- Branch: main
- HEAD: ba0b09b (CV-UPLOAD-UX-05, gepusht, synchron mit origin/main)
- Working tree: clean

## Task / Purpose (User-Request)
1. Das Suchprofil (Schritt "Profil" im CV-Workflow) soll einem CV ZUGEORDNET
   und benennbar in einer Liste gespeichert werden: CV A -> Suchprofile.
2. Die bei der Skills-Auswahl bestaetigten (erkannten) Skills sollen
   ebenfalls benennbar als Liste an das CV gehaengt werden:
   CV A -> ATS-Matching-Profile.
3. Eintraege in beiden Listen brauchen eine Namensmoeglichkeit.
4. Pro ausgewaehltem CV soll ein Overlay aufrufbar sein: Titel = CV-Name,
   Button "Profil anzeigen", darunter zwei Tabellen nebeneinander
   (Suchprofile | ATS-Profile) mit Auswahl-Moeglichkeit; darunter werden die
   Details des gewaehlten Eintrags themenabhaengig angezeigt.

## Design-Entscheidungen (im Log verankert)
- Speicherort: localStorage (clientseitig, privacy-konform — nur
  anonymisierte/normalisierte Profildaten; keine Server-Aenderung,
  kein Consent-/Contract-Unterschied).
- Zuordnung: Inhalts-Hash (SHA-256 des anonymisierten Textes, wird in
  createProfileFromPdf bereits berechnet) als stabiler Schluessel je
  CV-Inhalt — ueberlebt Sessions (Dokument-IDs sind fluechtig).
  Neues Feld CvDocument.hash; Api: src/lib/cvProfileStore.ts.
- Speicherpunkte:
  a) Suchprofil: profile-ready -> "Profil übernehmen und Jobs finden"
     speichert benannten Eintrag (Namensfeld im Profil-Step; Default:
     Zielrolle bzw. "Suchprofil <Datum>").
  b) ATS-Profil: skill-selection-Confirm bei Ziel ATS speichert benannten
     Eintrag mit den bestaetigten Skills (Namensfeld im Skills-Step;
     Default: erster Skill bzw. "ATS-Profil <Datum>").
- Overlay: CvProfilesOverlay (Muster .modal/.modal-box wie LetterModal):
  Titel = Dateiname; Button "Profil anzeigen" (neustes Suchprofil);
  zwei Tabellen nebeneinander (mobil gestapelt); Auswahl per Zeile;
  Detailbereich unten wechselt je nach gewaehlter Liste/Thema.
- Einstieg in die Liste: CvDocumentList bekommt pro Zeile "Profile anzeigen".

## Completed sections (laufend)
- [x] Kontext-Analyse: CvProfileResult, CvDocumentList, LetterModal-Pattern,
      types.ts (CvDocument), bestehende Store-Konvention (mj-cv-*)
- [x] Store-Modul + Typen
- [x] Speicherpunkte + Namensfelder
- [x] Overlay + Listen-Einstieg
- [x] i18n (de/en)
- [x] Tests
- [x] Validierung + Audit-Eintrag

## Open questions / Risks
- Dokumente selbst bleiben Session-State (nur Listen persistieren) —
  dokumentiert, bewusst so (Privacy: keine CV-Datei im Speicher).
- Umbenennen/Loeschen von Eintraegen: v1 ohne (nur Name beim Speichern) —
  als moegliche Folgearbeit notiert.

## Files changed
(werden bei Abschluss final gelistet)

## Classification
PENDING

## Resume point
Implementierung laeuft; naechster Schritt: cvProfileStore.ts + Typen.

---

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

### CV-PROFILE-LISTS-01 — BENANNTE PROFIL-LISTEN PRO CV (SUCHPROFILE + ATS-PROFILE)
- Date: 2026-09-26
- Task: CV-PROFILE-LISTS-01 (User-Feature-Request)
- Purpose: Suchprofile und ATS-Matching-Profile (bestaetigte Skills) sollen
  benennbar an das jeweilige CV gehaengt und in Listen gespeichert werden;
  pro CV aufrufbar als Overlay (Titel = CV-Name, "Profil anzeigen"-Button,
  zwei Tabellen nebeneinander mit Auswahl, Detailansicht darunter).
- Umsetzung:
  - Neuer Store src/lib/cvProfileStore.ts (localStorage, Key mj-cv-lists:<hash>;
    Hash = SHA-256 des anonymisierten/normalisierten CV-Textes — stabile
    Zuordnung je CV-Inhalt ueber Sessions). Typen CvSearchProfileEntry
    (Name, Profil, savedAt) / CvAtsProfileEntry (Name, Skills, Zielrolle,
    savedAt); max. 50 Eintraege je Liste; korrupte Daten -> leere Liste.
  - CvDocument.hash: wird bei der Profil-Erstellung (createProfileFromPdf)
    gesetzt; vorher keine Listen moeglich.
  - Speicherpunkt Suchprofil: profile-ready -> neuer Name-Input
    (Default: Zielrolle) -> "Profil übernehmen und Jobs finden" speichert
    den benannten Eintrag.
  - Speicherpunkt ATS-Profil: skill-selection bei Ziel ATS -> neuer
    Name-Input (Default: erster Skill) -> Confirm speichert Eintrag mit den
    bestaetigten Skills, danach startet die Analyse (CV-UPLOAD-UX-04).
  - Neues Overlay src/components/CvProfilesOverlay.tsx (Muster .modal):
    Titel = Dateiname; Button "Profil anzeigen" (neustes Suchprofil);
    zwei Tabellen (Suchprofile | ATS-Profile, mobil gestapelt) mit
    Auswahl pro Zeile; Detailbereich darunter wechselt je nach Thema.
  - Einstieg: CvDocumentList pro Zeile "Profile anzeigen" (reine
    Lese-Ansicht, bewusst nicht an Workflow-Status gekoppelt).
- Consent-/Privacy-/Contract-Bezug: keine Aenderung — Speicher lokal, nur
  anonymisierte/bestaetigte Profildaten, keine CV-Datei, kein externer Call.
- Files changed: src/lib/cvProfileStore.ts (neu), src/lib/cvProfileStore.test.ts
  (neu), src/components/CvProfilesOverlay.tsx (neu),
  src/components/CvProfileResult.tsx, src/components/CvDocumentList.tsx,
  src/App.tsx, src/types.ts, src/i18n.tsx (16 neue Keys de/en),
  src/styles.css, src/App.test.tsx (3 neue Flow-Tests + Store-Isolation im
  beforeEach), src/components/CvDocumentList.test.tsx (Prop),
  docs/AI_AUDITLOG.md, docs/reports/CV-PROFILE-LISTS-01-EXECUTION_LOG.md
- Tests: 499/499 PASS; TypeScript PASS; Build PASS; git diff --check CLEAN
- Classification: GREEN — Feature vollstaendig umgesetzt und getestet.
- Offene Folgearbeit (notiert): Eintraege umbenennen/loeschen; Listen im
  Overlay verlinken auf Suche/Analyse (Ausfuehrung direkt aus Eintrag).
