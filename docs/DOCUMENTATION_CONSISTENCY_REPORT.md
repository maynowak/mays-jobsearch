# Documentation Consistency Report

**Stand:** 2026-11-25 · **Production-Basis:** `df1fe01983487b6badcc29653a3f8474f10a5938`
**Branch:** `docs/jm-documentation-consolidation-01`
**Status:** READY FOR DOCUMENTATION REVIEW

## 1. Umfang und Methode

Geprüft wurden Repository, Quellcode, README, vorhandene Dokumentation,
Git-/Release-Historie, Tests, E2E-Nachweise, Screenshots, Deployment- und
RIS-Dokumentation. Grundregel: **Repository-Evidenz vor Annahmen**.
Historische Release-Berichte wurden nicht überschrieben.

Das vollständige Inventar steht in
[`docs/DOCUMENTATION_MATRIX.md`](DOCUMENTATION_MATRIX.md).

## 2. Zentrale Befunde und Korrekturen

| Befund | Auswirkung | Korrektur |
| --- | --- | --- |
| Root-`README.md` enthielt die Cognito-Branding-Aufgabe statt Projektübersicht | Falscher Einstieg für Mitwirkende und Nutzer | Inhalt nach `docs/BRANDING.md` verschoben; neues professionelles README |
| `docs/DEPLOYMENT.md` behauptete „kein automatisches Vercel-Git-Deployment“ | Widersprach `vercel.json` (`git.deploymentEnabled.main: true`) und dem PR-#66-Release | Automatische Main-Deployments, beide Projekte/Domains und aktueller SHA dokumentiert |
| Architekturdiagramm zeigte noch einen serverseitigen CV-Profile-Cache | Widersprach dem tatsächlichen `/api/profile`- und Datenschutzverhalten | Diagramm auf „AI extraction; no server-side CV profile cache“ korrigiert |
| `docs/ROADMAP.md` endete inhaltlich bei 2026-10-02 | Aktuelle Releases und offene Pakete fehlten oben | Aktueller Production-Stand, abgeschlossene und offene Pakete ergänzt; Historie erhalten |
| `docs/CHANGELOG.md` endete bei 2026-11-19 | PR #66 und die UX-Releases fehlten | Einträge für PR #66, Application Edit, Application Save UX und CV-Timeout ergänzt |
| Kein Benutzerhandbuch und keine Wiki-Struktur | Nutzer mussten UI-Wissen aus Reports ziehen | `docs/USER_GUIDE.md` und `docs/wiki/` neu erstellt |
| CV-Workspace-/Radar-/RIS-Funktionen in der Architektur unterrepräsentiert | Entwickler mussten Code lesen | Aktueller Architektur-Abschnitt mit Shell, Applications, CV, BFF/RIS, Session/Consent, Radar/Turbo-Händen |
| Test-Gates im Workflow veraltet | Release-Prüfungen nicht eindeutig | Aktuelle Kommandos, E2E-Liste, Vollsuite, CodeQL/Vercel- und Docs-Gates ergänzt |
| Zwei-Repository-Bezug Jobsearch ↔ RIS nur implizit | Unklare Zuständigkeit für API, Daten, Consent, AWS und RIS-Interna | Explizite Grenze in README, Architektur und Wiki; RIS-Repo bleibt unverändert |

## 3. README

Das neue README ist der Projekteinstieg und enthält:

- Projektbeschreibung, Nutzen und Production-Links.
- Funktionsübersicht: Jobsuche/Matching, Profil, Bewerbungen, eigenes und
  KI-Anschreiben, CV-Import, strukturierter Editor, Radar/Turbo-Hände,
  Session/RIS, Datenschutz.
- Technologie- und Architekturüberblick.
- Installation, lokale Full-Stack-Runtime und Kommandos.
- Tests/Qualität, Roadmap und Dokumentationsnavigation.
- Ausgewählte synthetische Screenshots ohne Kontodaten.

Der frühere Branding-Inhalt bleibt als `docs/BRANDING.md` mit
Historienhinweis erhalten.

## 4. Roadmap

Oben stehen jetzt:

- Production-Basis `df1fe01`.
- Abgeschlossen/verifiziert: Application Save UX, Application Edit + eigenes
  Anschreiben, Profile Layout Consistency, CV Import Expanded View, CV Editor
  Expanded View, Consolidated UX Release PR #66.
- Offen: `JM-COVER-LETTER-MODEL-FAILURE-SESSION-UX-01`,
  `JM-JOB-APPLICATION-MATCHING-01`, `JM-APPLICATION-LOADING-STATE-01`,
  CV-Builder Legacy E2E Maintenance.

Der historische Backlog bleibt unverändert darunter erhalten.

## 5. Benutzerhandbuch

`docs/USER_GUIDE.md` deckt die geforderten 14 Themen ab: Anmeldung, Profil,
Jobsuche, Bewerbungen, eigenes Anschreiben, KI-Grenzen, CV-Import,
CV-Prüfung, Editor, Radar, Expand/Collapse, Screenshot-Modus,
Session/RIS-Speicherung sowie Einwilligungen/Löschung.

Die UI-Bezeichnungen stammen aus `src/i18n.tsx` und den E2E-Suiten, u. a.:

- **Bewerbungsdaten bearbeiten**
- **Speichern und wechseln / Änderungen verwerfen / Weiter bearbeiten**
- **Eigenes Anschreiben hinterlegen/bearbeiten/speichern**
- **Alle Abschnitte aufklappen/einklappen**
- **📸 Screenshot-Ansicht / Screenshot-Ansicht beenden**
- **Ansicht wechseln / Breite maximieren**
- **Zum ersten Fehler**
- **Importübersicht / Abschnittsübersicht**

Es werden keine nicht implementierten Abläufe behauptet. KI-Ausgaben werden
ausdrücklich als Vorschläge eingeordnet.

## 6. Architektur- und Entwicklerdokumentation

`docs/ARCHITECTURE.md` enthält jetzt einen aktuellen Abschnitt zu:

- Routen und Profil-Shell,
- Applications/Repository/Dirty-State/Own-Letter,
- CV-Import/Editor, Radar/Turbo-Hände, Expand/Collapse/Screenshot,
- BFF/RIS-Router, Credential-Grenze, Session vs. durable Storage,
- Consent-Gates und Account-Erasure-Grenze,
- AI/ATS/i18n und Verifikationspfaden.

Die historischen Tiefenabschnitte zu Jobquellen, Matching, Guards und
API-Verträgen bleiben erhalten; das veraltete CV-Cache-Diagramm wurde
korrigiert.

`docs/DEVELOPMENT_WORKFLOW.md` beschreibt die aktuellen Kommandos, Test-Gates,
E2E-Suiten, CodeQL/Vercel-Prüfungen und den Release-/Docs-Ablauf.
`docs/DEPLOYMENT.md` beschreibt die automatische Main-Deployment-Kette, beide
Projekte/Domains und den aktuellen Production-SHA.

## 7. GitHub-Wiki

`docs/wiki/` ist als GitHub-Wiki-kompatible Struktur vorbereitet:

- `Home`
- `Getting-Started`
- `User-Guide`
- `CV-Builder`
- `Applications`
- `Job-Search`
- `Architecture`
- `Development`
- `API-Integrations`
- `Testing`
- `Deployment`
- `Security-and-Privacy`
- `Roadmap`
- `FAQ`
- `_Sidebar.md` für die Navigation

Die Seiten verlinken auf die kanonischen Repository-Dokumente. Es wurde **kein**
separates Wiki-Repository erstellt oder veröffentlicht.

## 8. Links, Markdown und Bilder

- Relative Links in README, User Guide, Matrix, Wiki und den aktualisierten
  Kerndokumenten wurden geprüft; fehlende Ziele wurden korrigiert.
- Wiki-interne Links verwenden Wiki-Seitennamen; Repository-Dokumente werden
  über absolute GitHub-URLs verlinkt.
- Bildpfade verweisen auf vorhandene, synthetische E2E-Assets.
- Markdown-Struktur: konsistente H1/H2-Hierarchie, Tabellen und Codeblöcke.
- Keine Secrets, Tokens, Cookies oder echten Kontodaten in Text oder Bildern.
- Screenshot-Quellen sind in `docs/DOCUMENTATION_MATRIX.md` aufgeführt.

## 9. Terminologie

Einheitlich verwendet:

- **Profil-Shell** für Header, Sidebar und Mobile-Switcher.
- **Bewerbungsverwaltung** / **Applications** für den Bewerbungsbereich.
- **Eigenes Anschreiben** für den nicht-KI-Text.
- **Session** und **RIS-Konto** für die Speichermodi.
- **Radar** und **Turbo-Hände** für Navigation/Scrollen.
- **Expand/Collapse** und **Screenshot-Modus** als getrennte Ansichtsfunktionen.
- **BFF** für die serverseitige Grenze zu RIS.

## 10. Bekannte Einschränkungen / offene Punkte

- `cv-builder-workflow-02a` bleibt eine vorbestehende Test-Altlast (alter
  Buttontext); keine Produktregression. Minimale separate Testkorrektur
  empfohlen.
- Historische Reports und Auditlog-Einträge werden nicht rückwirkend
  umgeschrieben; sie bleiben Nachweise ihres jeweiligen Stands.
- API-Verträge werden nicht dupliziert; bei Änderungen bleiben
  `docs/API_CONTRACT.md` und `docs/API_INVENTORY.md` die Quelle.
- Das Wiki ist vorbereitet, aber nicht veröffentlicht.
- Das separate RIS-Repository (`maynowak/Mays-Recruiting-Intelligence-System`)
  wurde in diesem Auftrag **nicht inspiziert oder verändert**. Seine Dokumentation
  und RIS-Interna benötigen ein separates Mandat; hier dokumentiert ist die
  Jobsearch-Seite der BFF-Grenze.
- Authentifizierte Production-Screenshots wurden bewusst nicht committet
  (Kontodaten); die Release-Verifikation nutzt strukturelle Assertions und
  synthetische Screenshots.

## 11. Validierung

| Prüfung | Ergebnis |
| --- | --- |
| Relative Linkprüfung (README, User Guide, Matrix, Wiki, Kern-Docs) | PASS |
| Markdown-Struktur / Codeblöcke | geprüft |
| Screenshot-Pfade | vorhanden |
| `git diff --check` | PASS |
| Secret-Muster in geänderten Docs | keine gefunden |
| Quellcodeänderungen | keine |

**Ergebnis:** Die Dokumentation ist konsolidiert, aktuell und als
Release-/Nutzer-/Entwickler-/Wiki-Einstieg nutzbar.

`JM-DOCUMENTATION-CONSOLIDATION-01 — READY FOR DOCUMENTATION REVIEW`
