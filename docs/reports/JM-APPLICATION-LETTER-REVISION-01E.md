# JM-APPLICATION-LETTER-REVISION-01E

**Art:** Anschreiben-Editor / Konsolidierung / Regression / Datenschutz / Release Readiness
**Status:** ABGESCHLOSSEN UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-letter-revision-01e`
**Baseline:** 01D `01836f7`; lokaler `main` `4364eab`
**Grenzen:** Keine neue Produktfunktion, keine neue Persistenz, keine RIS-/AWS-/Cognito-Integration, keine echten KI-/Provider-/Apify-Aufrufe, kein Push/Merge/Deployment.

## 1. Ergebnis

Die Serie 01A–01D wurde vollständig geprüft. Im 01A–01D-Scope wurden
notwendige Korrekturen für asynchrone Schreibvorgänge, Consent-Gültigkeit,
Fokusführung, Diff-Wahrnehmbarkeit, Datenschutztext und Navigationsschutz
umgesetzt. Die Kernfunktionen bleiben unverändert; historische Versionen werden
weiterhin nicht überschrieben.

| Bereich | Ergebnis | Tests | Commit |
|---|---|---|---|
| 01A Versionsvergleich | VERIFIED LOCAL | Comparison 6, E2E | `4d9e8e7`, `54f7fc2`, `0fa6941` |
| 01B KI-Verbesserung | VERIFIED LOCAL, Consent/Transparenz präzisiert | Improvement/API, E2E | `b394e37`, `579b5b9`, `e0f513e` |
| 01C Text-Diff | VERIFIED LOCAL, Farbe nicht alleiniger Hinweis | TextDiff/Improvement, E2E | `efc4634`, `e29a7c9` |
| 01D Versionsspeicherung | VERIFIED LOCAL, Async-/Konfliktpfade gehärtet | Improvement/Section/Repository, E2E | `a0d106f`, `01836f7` |
| 01E Abschlussprüfung | ABGESCHLOSSEN / VERIFIED LOCAL | Gesamtsuite + E2E + API + Schema | `1463525`, dieser Commit |

## 2. Baseline-Prüfung

Vor Arbeitsbeginn verifiziert:

```text
Branch: feature/jm-application-letter-revision-01d
HEAD: 01836f7
main: 4364eab
origin/main: 4364eab
Worktree: /home/dci-student/projects/mays-jobsearch-consolidation
```

Der Prüfbranch wurde aus dem vollständigen 01D-Stand erstellt, nicht aus
`main`. Es wurden keine fremden untracked Dateien verändert.

## 3. Funktionsmatrix

| Prüfung | Ergebnis | Evidenz |
|---|---|---|
| Aktueller Entwurf und gespeicherte Versionen anzeigen | PASS | `ApplicationLetterComparison` |
| Zwei beliebige Versionen vergleichen | PASS | 01A-Unit + E2E |
| Entwurf mit historischer Version vergleichen | PASS | Default current ↔ latest |
| Metadaten vollständig anzeigen | PASS | Datum, Herkunft, Sprache, Modell, versionId |
| Lange Texte vollständig lesen | PASS | `<pre>`, kein Höhenlimit, E2E-Clip-Check |
| KI-Modell und Verbesserungswunsch wählen | PASS | Consent-gated, `options.model` |
| Einwilligung erforderlich | PASS | Checkbox standardmäßig aus; kein Request ohne Consent |
| Original und KI-Vorschlag vergleichen | PASS | vollständige Textpanels |
| Vorschlag verwerfen | PASS | nur temporärer React-State |
| Wort-Diff: behalten/hinzugefügt/entfernt | PASS | `src/lib/textDiff.ts` |
| Diff-Zähler und Änderungsstellen | PASS | Unit-Tests + E2E |
| Vorschlag manuell bearbeiten | PASS | editierbares Textfeld, Live-Diff |
| Bearbeiteten Vorschlag speichern | PASS | `addCoverLetterVersion`, `source:"revised"` |
| Neue Versions-ID und neue Version in Auswahl | PASS | Unit + E2E |
| Alte Versionen unverändert | PASS | append-only Repository-Pfad |
| Modellmetadaten nur bei zuverlässigem Fallback-Trace | PASS | `attempts.find(ok)` |
| Gespeicherte Version als Entwurf übernehmen | PASS | Bestätigung, nur Draft/Status |
| Historie/Status bei Übernahme unverändert | PASS | Section-Integrationstest |
| Doppelklick-/Konfliktschutz | PASS | `expectedVersion`, Refs, Tests |
| Session-/Bewerbungswechsel | PASS | Request-/Action-Sequenz, Abort-/Generation-Schutz |
| Unsaved AI proposal bei Tab-/Bewerbungswechsel | PASS | Parent-Guard + E2E |
| Responsive 1440/1024/768/390/320 | PASS | Applications-E2E |
| Diff nicht ausschließlich farbcodiert | PASS | `<ins>` zusätzlich unterstrichen |
| Bestätigungsfokus | PASS | Fokus auf Bestätigung und zurück |
| Keine echte KI-/Provider-Anfrage in Tests | PASS | API-Mocks |

## 4. Datenintegrität und Versionierung

Geprüft wurden `CoverLetterVersionV1`, `ApplicationDocumentsV1`,
`ApplicationV1`, `SessionApplicationV1`, `ApplicationRepository` und
`addCoverLetterVersion`.

Erhalten:

- historische Versionen werden nie überschrieben;
- alte IDs, Inhalte und Zeitstempel bleiben unverändert;
- der aktuelle Entwurf ist von gespeicherten Versionen getrennt;
- KI-Vorschläge sind zunächst ausschließlich React-State;
- Speicherung erzeugt nur nach ausdrücklicher Aktion eine neue Version;
- Entwurfsübernahme ersetzt nur `coverLetterDraft`/`documentStatus`;
- `jobId`-Bindung bleibt erhalten;
- Export bleibt ein lokaler Session-Export.

Herkunft:

- `generated` — KI-generiert
- `revised` — KI-überarbeitet, auch nach anschließender manueller Bearbeitung
- `manual` — manuell gespeichert

Es wurden keine neuen Enum-Werte eingeführt. Die semantische Einschränkung
„KI plus manuelle Nachbearbeitung bleibt `revised`“ ist beabsichtigt.

Die 01E-Korrekturen ergänzen:

- Save-/Adopt-Pfade laufen durch denselben Parent-Operationsschutz wie andere
  Repository-Aktionen;
- `replace()` arbeitet mit dem aktuellen Anwendungs-Ref statt mit einem
  veralteten Render-Snapshot;
- verspätete Save-/Adopt-Antworten werden nach Bewerbungswechsel/Unmount
  verworfen;
- ein bereits gespeicherter, unveränderter Vorschlag kann nicht versehentlich
  erneut gespeichert werden.

## 5. Versionskonflikte und Idempotenz

- `expectedVersion` wird bei Speicherung und Übernahme verwendet.
- `savingRef`/`adoptingRef` und deaktivierte Buttons verhindern Doppelklick.
- `version_conflict` bleibt sichtbar; der Vorschlag bleibt erhalten.
- Eine erneute Operation mit veralteter `expectedVersion` wird sicher
  zurückgewiesen.

**Keine Exactly-once-Garantie:** Bei einer verlorenen Erfolgsantwort kann ein
Retry eine neue Version anlegen; die alte `expectedVersion` verhindert jedoch
eine stille zweite unkontrollierte Anlage und erzeugt sichtbar einen Konflikt.
Diese Aussage wird nicht als Exactly-once-Garantie dargestellt.

## 6. Datenschutz und KI-Sicherheit

Übertragen werden ausschließlich:

- Stellenreferenz (Titel, Arbeitgeber, Ort, URL, Quelle),
- leere Jobbeschreibung,
- leerer manueller Kandidatenkontext,
- die anonymisierte Ausgangsfassung,
- der anonymisierte Verbesserungswunsch,
- Sprache, Stil, Länge, leere Zielrollen, Modell.

Nicht übertragen werden:

- Kontaktdaten,
- persönliche Notizen,
- Gehaltsdaten,
- CV-Datei oder CV-Text,
- `cvReference`,
- Status-/History-Daten,
- erfundene Kandidatenangaben.

Einwilligung:

- KI-Aufruf nur nach ausdrücklicher Aktion;
- Checkbox standardmäßig deaktiviert;
- kein Aufruf beim Öffnen des Dokumente-Tabs, beim Vergleich, beim Diff oder
  beim Speichern/Übernehmen;
- Consent wird bei Wechsel von Ausgangsfassung oder Modell zurückgesetzt;
- Transparenztext nennt nun ausdrücklich mögliche konfigurierte
  Fallback-Anbieter.

Anonymisierung:

- Ausgangstext und Verbesserungswunsch laufen durch `anonymizeText()`;
- `draft_anonymized:true` wird erst danach gesetzt;
- 01E ergänzt die Erkennung von Namen in typischen Anschreiben-Signaturen
  (`Mit freundlichen Grüßen\n<Name>`, `Kind regards,\n<Name>`) und nach
  `Mein Name ist`/`My name is`;
- eine vollständige Anonymisierung bleibt laut UI-Hinweis nicht garantiert.

Prompt-Sicherheit:

- Stellenanzeige, CV-Text und Anschreibenentwurf werden als untrusted data
  behandelt;
- der Entwurf darf keine Sicherheitsregeln umgehen;
- erfundene Arbeitgeber, Titel, Abschlüsse, Zertifikate, Zeiträume und
  Gehaltsangaben sind untersagt;
- keine HTML-Injektion: Anschreiben/Diff werden als Textknoten bzw. `<pre>`
  gerendert.

Grenzen (offen, nicht in 01E behoben):

- Die Serverroute prüft nur das Client-Flag `draft_anonymized`, nicht den Inhalt.
- `/api/cover-letter` ist unauthentifiziert, mit `Access-Control-Allow-Origin: *`
  und ohne eigenes IP-/Session-Quota (bestehender Endpunkt).
- Provider-Fehlerlogs können Fehlertextfragmente enthalten.
- Es gibt keine serverseitige Faktenvalidierung des Modelloutputs; die
  Prompt-Regeln sind die alleinige Schutzschicht.
- `anonymizeText()` ist best-effort, keine garantierte PII-Entfernung.

## 7. Session- und Async-Sicherheit

Erhalten bzw. gehärtet:

- `requestSeqRef`/`inFlightRef` für die KI-Anfrage;
- `appIdRef` für Bewerbungszuordnung;
- `actionSeqRef` für Save/Adopt;
- `AbortSignal` im Repository-Pfad für Save/Adopt;
- `invalidate()`/Session-Generation unverändert;
- verspätete KI-Antworten werden verworfen;
- verspätete Save-/Adopt-Antworten werden nach App-Wechsel/Unmount verworfen;
- Unsaved AI proposal blockiert normalen Tab-/Bewerbungswechsel;
- bei Session-Invalidierung hat die sichere Entfernung personenbezogener Daten
  Vorrang.

Offen:

- `generateCoverLetter`/`apiFetch` haben weiterhin kein `AbortSignal`; eine
  laufende Provider-Anfrage wird nach Unmount/Logout nicht abgebrochen, die
  Antwort wird aber clientseitig verworfen.

## 8. UI und Accessibility

- Vergleich: zwei vollständige Textspalten, Metadaten, eindeutige
  Versionsauswahl.
- Diff: `<del>`/`<ins>` semantisch; `<ins>` zusätzlich unterstrichen, damit
  Farbe nicht der einzige Hinweis ist.
- Editor: vollständige Bearbeitung, Auto-Grow, keine Kürzung.
- Neue Aktionsbuttons und Consent-Zeile: Mindesthöhe 44 px.
- Adopt-Bestätigung: Fokus auf „Ja, Entwurf ersetzen“; Abbruch setzt Fokus
  zurück; Erfolgsstatus ist fokussierbar.
- `to`-Wechsel schließt eine offene Bestätigung.
- Responsive: 1024/768/320 werden im Applications-E2E zusätzlich geprüft;
  1440/390 sind die Hauptläufe.
- Keine horizontale Überläufe, keine Console-Errors in den E2E-Läufen.

## 9. Regression und tatsächlich ausgeführte Tests

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run` | **1254 passed, 5 skipped** (115 Dateien passed, 3 skipped) |
| Feature-Unit/Integration gezielt | **69 passed** (Comparison, Improvement, ApplicationsSection, Anonymize) |
| `tests/api/cover-letter.test.mjs` | **23 passed** |
| `npm run build` (tsc + vite) | PASS |
| `node --check` aller `api/**/*.mjs` | PASS |
| `git diff --check` | PASS |
| Applications-E2E 1440/390 | PASS; keine Console-Errors |
| Applications responsive 1024/768/320 | PASS |
| Cover-Letter-E2E 1440/390 | PASS; keine Console-Errors |
| Mobile-Nav-E2E 390/430/768/1024/1440 | PASS |
| Guest-CV-E2E 1440/390 | PASS |
| JSON Schema/Fixtures | 15 gültige PASS; negatives Unknown-Field-Fixture abgelehnt |
| Echte KI-/Provider-/Apify-/RIS-/AWS-Aufrufe | keine |

Hinweis zur Testinfrastruktur: Ein früherer Baseline-Lauf unter Volllast zeigte
zwei Fehlschläge in `ManualSearchProfiles.integration.test.tsx`; der finale
Gesamtlauf nach den 01E-Korrekturen war vollständig grün. Es handelt sich um den
bereits dokumentierten Volllast-/Timing-Flake, nicht um einen 01A–01E-Regression
im Editor.

## 10. Screenshots

Vorhandene synthetische Evidenz aus 01A–01D bleibt gültig; für 01E waren keine
zusätzlichen Screenshots erforderlich.

- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01B/`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01C/`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/`

Die finalen E2E-Läufe prüften dieselben synthetischen Flows inklusive
Vergleich, KI-Vorschau, Diff, Bearbeitung, Speicherung, Übernahme und
Responsive-/Navigation-Grenzen.

## 11. Git

- Baseline: `01836f7`
- 01E-Korrekturen: `1463525`
- Dokumentation: dieser Commit
- Branch: `feature/jm-application-letter-revision-01e`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment
- Historie 01A–01D bleibt vollständig erhalten

## 12. Offene Punkte

- Exactly-once bei verlorener Antwort ist nicht garantiert.
- Live-Provider/-Modellverhalten wurde nicht verifiziert.
- Keine dauerhafte Anschreiben-/Bewerbungspersistenz; Session-only.
- RIS-/AWS-/Cognito-Integration und Retention-Freigabe bleiben offen.
- `/api/cover-letter` benötigt vor Produktion Auth-/Quota-/Missbrauchsschutz.
- Serverseitige Anonymisierung und Output-Faktenprüfung fehlen.
- AI-Request hat noch kein AbortSignal.
- 01A-Formulierung zur „Versionsänderung“ wird hier präzisiert: Eine externe
  neue Version setzt die Vergleichsauswahl nur dann auf die neueste Version,
  wenn die Ausgangsseite der aktuelle Entwurf ist; das Speichern der eigenen
  KI-Version verwirft den bearbeiteten Vorschlag nicht.

## 13. Release Readiness

### A. LOCAL INTEGRATION READINESS

**READY**

Die Serie 01A–01E ist nach den lokalen Unit-, API-, Schema-, Build- und
Browser-Regressionen bereit für eine kontrollierte Integration in den lokalen
`main`. Es wurde nicht integriert.

### B. PRODUCTION READINESS

**BLOCKED**

Eine bestandene lokale Regression reicht nicht. Für Produktion fehlen
insbesondere Live-Provider-Verifikation, Auth-/Gastmodus-Live-Matrix,
Retention-/Datenschutzfreigabe, dauerhafte RIS-Persistenz, Missbrauchsschutz
für den Cover-Letter-Endpunkt und Deployment-Freigabe. Ein klar abgegrenzter
Session-only-Demo-/UI-Umfang ist lokal verifiziert, aber nicht als produktive
Dauerfunktion freigegeben.

**HARD STOP nach 01E. Keine automatische Integration, kein Push, kein Merge,
kein Deployment.**
