# Documentation Inventory & Matrix

**Stand:** 2026-11-25 · Production `df1fe01`
**Zweck:** Nachvollziehbares Inventar der Projektdokumentation vor und nach der
Konsolidierung. Keine historischen Release-Berichte werden überschrieben.

Legende Handlungsbedarf: **aktualisiert**, **neu**, **geprüft/verlinkt**,
**historisch belassen**, **offen**.

| Dokument | Ist-Zustand vor Konsolidierung | Handlungsbedarf | Quelle |
| --- | --- | --- | --- |
| `README.md` | Enthielt die Cognito-Branding-Aufgabe statt Projektübersicht | **ersetzt**; Branding-Inhalt nach `docs/BRANDING.md` verschoben | Code, Docs, Releases |
| `docs/BRANDING.md` | — | **neu** (verschobener historischer README-Inhalt) | ehemalige README |
| `docs/ROADMAP.md` | Sehr langer historischer Backlog, Stand 2026-10-02 | **aktualisiert**: aktueller Production-Stand, abgeschlossene Pakete, offene Pakete oben; Historie erhalten | PR #66, Auditlog |
| `docs/CHANGELOG.md` | Endete bei 2026-11-19 | **aktualisiert**: PR #66 und die UX-Releases 2026-11-25 | GitHub-/Release-Historie |
| `docs/ARCHITECTURE.md` | Gute Basis, aber UI-/RIS-/CV-Builder-Stand unvollständig; altes CV-Cache-Diagramm | **aktualisiert**: aktuelle Architektur, BFF/RIS, Session, CV-Workspaces, Radar | Code, Verträge |
| `docs/DEVELOPMENT_WORKFLOW.md` | 16-Schritte-Feature-Workflow, Test-Gates veraltet | **aktualisiert**: aktuelle Kommandos, E2E-/Vollsuite-/Docs-Gates | `package.json`, CI, Tests |
| `docs/DEPLOYMENT.md` | Behauptete „kein automatisches Git-Deployment“, alte URL | **aktualisiert**: automatische Main-Deployments, beide Domains, Production-SHA, Gates | `vercel.json`, Vercel, PR #66 |
| `docs/USER_GUIDE.md` | Nicht vorhanden | **neu** | UI, i18n, E2E |
| `docs/wiki/*` | Nicht vorhanden | **neu** als GitHub-Wiki-kompatible Struktur (nicht veröffentlicht) | bestehende Docs |
| `docs/DOCUMENTATION_MATRIX.md` | Nicht vorhanden | **neu** | dieses Inventar |
| `docs/DOCUMENTATION_CONSISTENCY_REPORT.md` | Nicht vorhanden | **neu** | Prüflauf |
| `docs/AI_AUDITLOG.md` | Sehr umfangreich, aktuell | **aktualisiert**: Eintrag für diese Konsolidierung | Audit-Workflow |
| `docs/AGENTS.md` | Aktuelle Projektkonventionen | **geprüft/verlinkt** | Repository |
| `AGENTS.md` (Root) | Verbindliche Agentenregeln | **geprüft**, unverändert | Repository |
| `docs/AI_CONTEXT.md` | Projektkontext, Stand 2026-10-02 | **geprüft**; aktuelle Release-Historie steht in Roadmap/Changelog; keine widersprüchliche Sicherheitszusage ergänzt | Docs |
| `docs/API_CONTRACT.md`, `docs/API_INVENTORY.md` | API-Verträge und Endpoint-Inventar | **geprüft/verlinkt**, nicht dupliziert | `api/**` |
| `docs/API_DOCUMENTATION_STANDARD.md`, `docs/API_VERSIONING_STANDARD.md`, `docs/API_MIGRATION_PLAN.md` | Standards/Planung | **historisch belassen**, verlinkt | Docs |
| `docs/AUTH_COGNITO.md` | OIDC/Cognito-Dokumentation | **geprüft/verlinkt** | Code/Docs |
| `docs/ATS_JOB_SOURCES.md`, `docs/JOB_SOURCES.md` | Jobquellen/ATS-Kontext | **geprüft/verlinkt** | Code/Docs |
| `docs/DESIGN_SYSTEM.md`, `docs/COMPONENT_GUIDE.md` | Design-/Komponentenleitfaden | **geprüft/verlinkt** | Code/Docs |
| `docs/PROJECT_RULES.md`, `docs/CONTRIBUTING.md` | Arbeitsregeln | **geprüft/verlinkt** | Docs |
| `docs/reports/**` | 593 Dateien mit Release-/Task-Nachweisen | **historisch belassen**; neue Screenshots nur verlinkt | Reports |
| `docs/reports/assets/**` | Screenshots aus synthetischen Tests | **geprüft**; für README/User Guide ausgewählt | E2E |
| GitHub Wiki | Kein Wiki-Repository im Checkout | **vorbereitet**, nicht veröffentlicht | `docs/wiki/` |

## Screenshot-Quellen

| Verwendung | Datei | Quelle |
| --- | --- | --- |
| Profilübersicht | `docs/reports/assets/JM-PROFILE-LAYOUT-CONSISTENCY-13/after-1440-overview.webp` | Profil-E2E, synthetisch |
| Bewerbungen | `docs/reports/assets/JM-PROFILE-LAYOUT-CONSISTENCY-13/after-1440-applications.webp` | Profil-E2E, synthetisch |
| CV-Import expanded | `docs/reports/assets/JM-CV-IMPORT-EXPANDED-VIEW-UX-01/expanded-1440.webp` | Import-E2E, synthetisches PDF |
| CV-Import Screenshot | `docs/reports/assets/JM-CV-IMPORT-EXPANDED-VIEW-UX-01/radar-1440-screenshot-mode.webp` | Import-E2E |
| CV-Editor expanded | `docs/reports/assets/JM-CV-EDITOR-EXPANDED-VIEW-UX-01/expanded-1440.webp` | Editor-E2E, leerer CV |
| CV-Editor Screenshot | `docs/reports/assets/JM-CV-EDITOR-EXPANDED-VIEW-UX-01/radar-1440-screenshot-mode.webp` | Editor-E2E |
| Dirty-State-Dialog | `docs/reports/assets/JM-APPLICATION-EDIT-TAB-NAVIGATION-01/edit-unsaved-dialog-1440.png` | Application-E2E |
| Eigenes Anschreiben | `docs/reports/assets/JM-APPLICATION-EDIT-TAB-NAVIGATION-01/own-letter-saved-1440.png` | Application-E2E |
| Production-Smoke | `docs/reports/assets/JM-UX-CONSOLIDATED-RELEASE-01-PRODUCTION/` | Guest-Production, synthetisch |

## Nicht geändert

- Historische Release-Berichte unter `docs/reports/` und ihre Assets.
- Quellcode, API-Verträge, Tests, Konfiguration und Infrastruktur.
- Kein separates Wiki-Repository und kein Wiki-Publish.
