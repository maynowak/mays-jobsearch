# JM-COVER-LETTER-UX-01

**Art:** Cover-Letter-Assistant / UX / Model-Auswahl / Guided Revision / API / Privacy
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-01

## 1. Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `c63e557` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Deployment | keines |

Untersucht wurden `LetterModal`, `ModelSelector`, `App`, `api.ts`, `i18n`, `styles.css`, `coverLetterRequest.ts`, `api/cover-letter.mjs` sowie die bestehenden LetterModal-/API-/E2E-Tests.

## 2. Schritt A — Scroll- und Fokusfehler

### Ursache

Beim Öffnen des Dialogs wurde `[data-autofocus]` auf dem Generierungsbutton am Ende des Dialogs fokussiert. Der Fokus auf dieses Element bewegte den internen Scrollcontainer `.modal-box` nach unten. Dadurch war die Dialogüberschrift nicht mehr sichtbar und der Dialog begann nicht oben.

### Änderung

- Die Dialogüberschrift ist jetzt mit `tabIndex={-1}` programmatisch fokussierbar.
- Der Fokus wird mit `heading.focus({ preventScroll: true })` gesetzt.
- Der Scrollcontainer wird sofort und nach dem Layout-Tick (`requestAnimationFrame`) auf `scrollTop = 0` gesetzt.
- Der Generierungsbutton hat keinen `data-autofocus`-Fokus mehr.
- Die Fokusfalle behandelt die Überschrift als Ausgangspunkt für `Shift+Tab`; Escape, Scroll-Lock und Fokus-Rückgabe bleiben erhalten.
- Die Modellauswahl wird über den bestehenden `LetterPreparationContext` auch bei einer Rückkehr aus dem CV-Upload wiederhergestellt. Der Dialog startet dabei erneut oben, ohne den Vorbereitungskontext zu verlieren.
- Es wurde keine globale Modal-Änderung vorgenommen; die Korrektur ist auf `LetterModal` begrenzt.

## 3. Schritt B — Lokale Modellauswahl

- `App` übergibt jetzt `modelsState`, die bereits geladenen `models` und `defaultModel` an `LetterModal`.
- `LetterModal` verwendet den vorhandenen `ModelSelector`; es gibt keine zweite Modellkatalog-Implementierung.
- Der lokale Modellwert startet mit dem aktuell für die Anwendung gültigen Modell und wird aus einem erhaltenen Vorbereitungskontext wiederhergestellt.
- Modellwechsel:
  - startet keine Anfrage,
  - löscht keinen bearbeiteten Entwurf,
  - gilt für die nächste ausdrücklich gestartete Aktion,
  - wird als `options.model` übergeben.
- Nach einem Modellfehler bleibt der Selector sichtbar; ein neuer Versuch startet erst nach explizitem Klick.
- Die bestehende Fallback-Kette und die Free-Model-Prüfungen bleiben aktiv. Die automatische Fallback-Anzahl wurde nicht erhöht.

## 4. Schritt C — Zwei getrennte Aktionen

### Neu generieren

`operation: "generate"` erzeugt ein neues Anschreiben aus Job, geprüfter Beschreibung, gewähltem CV beziehungsweise manuellen Angaben, Sprache, Stil, Länge und Modell. Ein vorhandener Entwurf ist nicht die Prompt-Grundlage.

### Mit Kommentar verbessern

`operation: "revise"` verwendet den sichtbaren, bearbeiteten Entwurf als Grundlage. Das optionale Feedback-Feld ist:

- DE: „Was möchtest du am Anschreiben verbessern?“
- EN: „What would you like to improve?“

Ohne Kommentar fordert der Prompt eine allgemeine sprachliche Verbesserung an. Es gibt keinen automatischen Verbesserungsaufruf; der Benutzer muss „Mit Kommentar verbessern“ beziehungsweise „Verbessern“ ausdrücklich klicken.

### Entwurfsschutz

- Der vorhandene Entwurf wird während einer Anfrage nicht frühzeitig geleert.
- Er wird erst nach erfolgreicher Antwort ersetzt.
- Bei Providerfehlern, leerer oder ungültiger Antwort bleibt der bisherige Entwurf erhalten und sichtbar.
- Bei bearbeitetem Entwurf ist vor dem Ersetzen eine zweite Bestätigung nötig.
- Kopieren und Download beziehen sich weiterhin auf den sichtbaren Text.
- Bestehende Race-Guards verwerfen weiterhin verspätete Antworten bei Job-/CV-/Identitätswechseln.

## 5. API-Vertrag

`POST /api/cover-letter` bleibt der einzige Endpunkt.

| Feld | Semantik |
|---|---|
| `operation` | optional, `"generate"` oder `"revise"`; fehlend = `"generate"` |
| `revision.draft_text` | erforderlich bei `"revise"`, max. 20.000 Zeichen |
| `revision.feedback` | optional, max. 2.000 Zeichen |
| `revision.draft_anonymized` | bei `"revise"` muss `true` sein |
| `options.model` | bestehende Modell-ID, unverändert |
| `candidate.cv_anonymized` | bestehende Raw-CV-Sperre bleibt aktiv |

Der Server validiert unerwartete Typen, Operationswerte, Pflichtfelder und Längen. Eine Revision ohne Entwurf, mit unredigiertem Draft-Flag oder mit zu langem Entwurf/Kommentar wird mit `400` abgelehnt. Bestehende Requests ohne `operation` bleiben rückwärtskompatibel.

## 6. Datenschutz

- Der bearbeitete Entwurf wird vor der Übermittlung clientseitig durch die vorhandene `anonymizeText()`-Funktion geführt.
- Der optionale Kommentar wird ebenfalls clientseitig anonymisiert.
- Die UI zeigt vor der Überarbeitung transparent an, dass Entwurf und Kommentar erneut an den externen Anbieter gesendet werden und vollständige Anonymisierung nicht garantiert werden kann.
- `draft_anonymized: true` ist nur ein zusätzliches Gate; es ist kein Beweis für vollständige Anonymisierung.
- Keine Speicherung von Entwürfen oder Kommentaren auf dem Server.
- Keine Prompt-/Entwurfsinhalte in Logs.
- Die bestehende Raw-CV-Sperre (`cv_raw_not_allowed`) bleibt erhalten.
- G05/G09/G10 bleiben unverändert offen. Es wurden keine neuen Datenkategorien stillschweigend freigegeben und kein Live-Provideraufruf durchgeführt.

## 7. Faktentreue und Ausgabeformat

Der Prompt wurde für beide Operationen verschärft:

- Keine erfundenen Berufsjahre, Arbeitgeber, Projekte, Referenzen, Zertifikate, Qualifikationen oder Tool-Erfahrungen.
- Keine erfundene Erfahrung in regulierten/klassifizierten Umgebungen.
- Eine Zielrolle ist kein Beleg für entsprechende Erfahrung.
- Jobanforderungen, inklusive genannter Jahre, dürfen nicht zu Bewerbererfahrung umgedeutet werden.
- Fehlende Informationen führen zu zurückhaltenderen Formulierungen.
- Standardmäßig maximal eine Seite.
- Kein Markdown (`**`, Aufzählungszeichen, Überschriften), keine Interviewvorbereitung, keine Eigenlob-Überschriften.
- Die ausdrücklich gewählte Sprache wird eingehalten.

Der Server entfernt zusätzlich Markdown-Reste, Überschriften und Aufzählungszeichen aus der Antwort. Das garantiert keine allgemeine Halluzinationsfreiheit; die tatsächliche Textqualität bleibt Gegenstand separater Modelltests.

## 8. Tests

| Prüfung | Ergebnis |
|---|---|
| LetterModal | **42 passed** |
| Cover-Letter-API | **23 passed** |
| Gesamtsuite | **1123 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| E2E-Cover-Letter-Aufrufe | 2 (1 generate, 1 revise) |
| E2E-`/api/profile`-Aufrufe | 1 (nur CV-Verarbeitung, kein zusätzlicher Profilaufruf) |
| E2E-Console-Errors | keine |

Abgedeckt sind insbesondere:

- Dialogüberschrift sichtbar, Fokus auf Überschrift, `scrollTop = 0`, kein Fokus auf Generierungsbutton.
- Fokusfalle und Fokus-Rückgabe.
- Rückkehr aus dem CV-Upload inklusive erhaltenem Modell und Scrollposition.
- Modellselector vor Generierung, nach Modellfehler, vor Regenerierung und vor Überarbeitung.
- Kein Request durch Modellwechsel; `options.model` und Fallback-ID korrekt.
- Generate bei vorhandenem/fehlendem Entwurf.
- Revision mit und ohne Kommentar; bearbeiteter Text als Grundlage.
- Kein automatischer Verbesserungsaufruf.
- Entwurf bleibt bei Fehler erhalten.
- Draft und Feedback werden vor der Revision anonymisiert; Raw-Draft-Gate serverseitig.
- Kein zusätzlicher `/api/profile`-Aufruf, kein KI-Aufruf beim Öffnen.
- Markdown-Bereinigung und Faktentreue-Regeln im Prompt.
- Desktop- und Mobil-E2E.

## 9. Verbleibende Risiken

1. **Keine Live-Verifikation:** Es wurden keine echten Provider-Generierungsaufrufe durchgeführt.
2. **Anonymisierungsgrenze:** Die vorhandene Anonymisierung kann nicht jede personenbezogene Angabe in einem manuell bearbeiteten Entwurf oder Kommentar erkennen. Das ist in der UI benannt und bleibt ein offenes Datenschutzgate.
3. **Modellqualität:** Prompt-Regeln und Markdown-Bereinigung reduzieren, garantieren aber keine vollständige Halluzinationsfreiheit.
4. **G05/G09/G10:** Die bestehenden Release-Gates bleiben unverändert; keine Produktionsfreigabe.
5. **Kein Release/Deployment:** Es wurde kein Deployment und keine AWS-/RIS-/Cognito-Änderung vorgenommen.

## 10. Git

- Schritt-A-D-Implementierung: `c0a022a`
- Dokumentations-Commit: nach diesem Bericht.
- Kein Deployment, keine neuen echten Provideraufrufe.
