# PROFILE-HIERARCHY-05 — Kapazität & Nutzungsmodell (Produktfestlegung)

## 1. Scope

Produktfestlegung der fachlichen Bedeutung und Kapazitätsgrenzen (kein Audit, kein Bauauftrag).
KEINE Codeänderung, KEINE Migration, KEINE Implementierung.
Basis: PROFILE-HIERARCHY-04 (Target Spec, YELLOW) — dieser Report **präzisiert** 04-§3
(Kardinalitäten) und **ersetzt** dort die Werte 10/10 für Search-/ATS-Ebene durch 2/5.
04 selbst bleibt unverändert (kein Überschreiben).

## 2. Festgelegte Zielhierarchie (TARGET, ersetzt 04-§3-Zahlen)

```
User
└── CV [1..10] pro User (unverändert)
    └── SearchProfile [1..2] pro CV (geändert: war 1..10)
        └── ATSSearchProfile [1..5] pro SearchProfile (geändert: war 1..10)
```

Theoretische Maxima pro User: **10 CVs / 20 SearchProfiles / 100 ATS-Profile**
(statt 10 / 100 / 1.000). Alle übrigen 04-Aussagen (Objektdefinitionen, Kette
`atsSearchProfileId → searchProfileId → cvId → userId`, Search-/ATS-Semantik,
Selection-, Edit-, Delete-, Ownership-, Identifier-Ziele) gelten unverändert.

## 3. Nutzungsmodell (verbindliche Lesart)

- Die Zahlen sind **maximale Kapazität, kein Befüllungsgebot**: „bis zu 2
  SearchProfiles je CV und bis zu 5 ATSSearchProfiles je SearchProfile —
  die tatsächliche Anzahl ist nutzerabhängig und kann deutlich darunter liegen."
- **Nicht** formulieren als „2 + 5 müssen vorhanden sein".
- Sinn der 5 ATS-Plätze: **Variation innerhalb eines spezialisierten Suchprofils**
  (Varianten A–D), nicht Pflichtprogramm. Leere Plätze sind Normalzustand.

Beispiele (aus Produktvorgabe übernommen):

```
CV 1
├── SearchProfile "Standard"
│   ├── ATS "Variante A"
│   └── ATS "Variante B"
└── SearchProfile "Spezialprofil"
    ├── ATS "Variante A"
    ├── ATS "Variante B"
    ├── ATS "Variante C"
    └── ATS "Variante D"

CV 2
└── SearchProfile "Standard"
    └── ATS "Standard"
```

## 4. UX-Konsequenz (Implementierungsleitplanke)

- **Keine „Profilverwaltung für 100 Objekte"-UX bauen.** Die Kapazität wird auf
  Datenebene enforced, nicht in der UI ausgereizt oder nahegelegt.
- UI für spärliche Nutzung auslegen (typisch 1 CV → 1 SearchProfile → 0–2 ATS);
  keine leeren Pflicht-Slots, keine Verwaltungs-Oberfläche für Volllast.
- Grenzen erst bei Erreichen sichtbar machen (vgl. IST-Muster: Upload-Button-Hide
  bei 10, `CvDocumentList.tsx:161`) — kein Upfront-Management.

## 5. IST-Abstand (unverändert aus 01–03, zur Einordnung)

IST: 10 CVs/Session, 50 Search + 50 ATS/Hash-Bucket (flach, ohne Parent), Session-only.
Target-Delta schrumpft auf Search-/ATS-Ebene (2/5 statt 10/10); Ownership-,
Identifier-, Persistenz- und Parent-Gaps aus 02 bleiben vollständig bestehen.

## 6. Offene Punkte (unverändert aus 04-§14, ergänzt)

Weiterhin OPEN: Ein-vs-mehrere ATS gleichzeitig aktiv; Delete-vs-Archive;
Kaskaden-Details; Feldkanon; ATS-Analyse-Weiternutzung; Übernahmeumfang;
Level/Suchkontext. Neu durch Kapazitätsentscheidung beantwortet: Such-/ATS-Höchstzahlen
(2/5). 04-Status bleibt YELLOW bis §14-Entscheidungen fallen.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DECIDED (Kapazitätszahlen 10/2/5 + Nutzungsmodell als Produktvorgabe
  festgehalten; Rest-YELLOW aus 04 unverändert)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: `907d446` (Stand; Commit folgt)
- Quelle: Produktvorgabe (User-Anweisung), keine Code-Ableitung — als Vorgabe
  gekennzeichnet, nicht als Ist-Befund
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht gestartet (Doku-only); keine Tests verändert
- Git-Status: vor Spec nur vorbestehende `docs/screenshotsfordev/`-Diffs
  (2 deleted, 2 untracked)
- Geänderte Dateien: ausschließlich `docs/reports/PROFILE-HIERARCHY-05-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only; 04 nicht überschrieben)
- Nächste Schritte: keine (Report + Commit)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — Kapazitäts-/Nutzungsfestlegung ohne Datenfluss-/Modelländerung. Keine AI-Audit-Ergänzung erzeugt.
