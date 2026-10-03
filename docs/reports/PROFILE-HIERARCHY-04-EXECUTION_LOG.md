# PROFILE-HIERARCHY-04 — Target Behavior Specification

## 1. Scope

SPEZIFIKATION des gewünschten Zielverhaltens (kein Ist-Bericht, kein Bauauftrag).
KEINE Codeänderung, KEINE Migration, KEINE Implementierung, KEINE Persistence-/API-Änderung.
IST-Basis: PROFILE-HIERARCHY-01 (RED), -02 (RED), -03 (YELLOW) — danach ist die
Zielhierarchie 10×10×10 heute **weder implementiert noch als Vertrag dokumentiert**.
Diese Spec behauptet an keiner Stelle, das Target existiere bereits; jede
Ziel-Aussage ist als TARGET markiert, jede unbelegte als OPEN DECISION.

## 2. Current Functional Baseline (IST, aus 01–03 übernommen)

- CVs: ≤10/Session (State-Slice + UI-Hide), sitzungslokal, kein User, kein Server.
- SearchProfiles: ≤50/CV-Hash (flache Geschwister-Liste, Snapshots, 12h, Session-Map).
- ATS-Profile: ≤50/CV-Hash (Geschwister, Teilmenge skills+targetRoles), Single-Select.
- Suche läuft ausschließlich mit `Profile` (Search-only belegt; ATS-only-Suche existiert
  nicht). ATS-Auswahl = Override nur für per-Job-ATS-Analyse (`/api/ats-analysis`).
- Edit beider Typen vorhanden (namenweises Überschreiben). Kein Delete-Konzept
  (außer Session-Verfall/Reload/manuelle CV-Listen-Bereinigung). Keine IDs mit
  FKs, keine Ownership, keine Persistenz über Reload hinaus.

## 3. Target Hierarchy (TARGET REQUIREMENT, heute nicht enforced)

```
User
└── CV [1..10] pro User
    └── SearchProfile [1..10] pro CV
        └── ATSSearchProfile [1..10] pro SearchProfile
```

Kardinalitäten als verbindliche Zielforderung: CV 1..10/User, SearchProfile 1..10/CV,
ATSSearchProfile 1..10/SearchProfile. Theoretische Maxima pro User: 10 / 100 / 1.000.
Ausdrücklich: Diese Grenzen werden aktuell technisch NICHT enforced (IST: 10/Session,
50/Hash, 50/Hash ohne Parent) — Enforcement ist Implementierungsgegenstand nach
Gate-Öffnung, nicht Teil dieser Spec.

## 4. Object Definitions (TARGET)

- **CV** = gespeicherter CV-Kontext eines Benutzers (Upload-Herkunft + Anker für
  Listen; Datei/Rohtext bleiben transient — nur der Kontext wird Objekt).
- **SearchProfile** = gespeicherte Suchkonfiguration für diesen CV
  (IST-Feldmenge als Ausgang: skills, targetRoles, city, radiusKm, workModes,
  employmentTypes + Name; Kanon Q1/Q3/Q13 aus 02/03 weiterhin OPEN).
- **ATSSearchProfile** = gespeicherte ATS-orientierte Such-/Matching-Konfiguration,
  **immer genau einem SearchProfile untergeordnet** — KEIN globales ATS-Profil.
  Kette: `ATSSearchProfile → searchProfileId → SearchProfile → cvId → CV → userId → User`.
  IST-Teilmenge (skills, targetRoles + Name) als Ausgang; erweiterte Felder OPEN (§14).

## 5. Search Behavior (TARGET)

- Nur SearchProfile ausgewählt (z. B. [✓ Cloud Engineer]) → Jobsuche verwendet
  **ausschließlich** dieses SearchProfile (Semantik: SearchProfile Search).
  Entspricht heutigem CASE A (bereits implementiert; erhalten, nicht umbauen).

## 6. ATS Search Behavior (TARGET — Abweichung vom IST)

- SearchProfile [✓ Cloud Engineer] gewählt → darunter **ausschließlich** dessen
  ATSSearchProfiles (z. B. [ ] AWS Cloud, [ ] Terraform, [ ] DevOps,
  [ ] Cloud Security). Fremde SearchProfiles liefern keine Einträge (IST zeigt heute
  alle des CV-Buckets — Target fordert Parent-Filter).
- SearchProfile + ATSSearchProfile gewählt → Suche verwendet **AUSSCHLIESSLICH**
  das ATS-Profil als Suchprofil; das SearchProfile läuft NICHT zusätzlich.
  Semantik: SearchProfile-only → SearchProfile Search; SearchProfile + ATS →
  ATS SearchProfile Search.
- IST-Abgrenzung: Heute ist ATS-Override = Analyse (`/api/ats-analysis`), Suche kennt
  kein ATS. Target verlegt ATS in die **Suchkonfiguration** (Job Search), ohne die
  bestehende ATS-Analyse automatisch zu entfernen (§13-Entscheidung: Weiternutzung
  für per-Job-Analyse = OPEN, Tendenz: erhalten).

## 7. Selection Behavior (TARGET)

- **Multi-ATS gleichzeitig aktiv: OPEN DECISION** (Single-Default naheliegend aus IST,
  aber nicht entschieden). „Bis zu 10 gespeichert" ≠ „10 gleichzeitig aktiv".
- SearchProfile-Wechsel A→B: ATS-Liste von B; Auswahl von A wird NICHT übertragen
  (keine Cross-Profile-Auswahl), sofern nicht ausdrücklich anders entschieden (OPEN).
- CV-Wechsel A→B: nur SearchProfiles von B, nur deren ATS-Profile; nichts von A
  sichtbar/aktiv (IST-Dokumentwechsel-Reset bleibt als Mindestverhalten erhalten).

## 8. Edit Behavior (TARGET — Bestand erhalten + Parent-Sicherheit)

SearchProfiles: mehrere existent, je einzeln bearbeit-/erstell-/speicherbar
(Update adressiert Instanz, nicht Name-allein — Namens-Overwrite ist IST und im
Target durch ID-Adressierung zu ersetzen). ATS-Profile: mehrere je SearchProfile,
Erstellen/Bearbeiten/Speichern nur innerhalb des Parents. Invarianten: Edit eines
SearchProfils verändert kein anderes; Edit eines ATS-Profils verändert kein Profil
eines anderen SearchProfils (folgt aus Parent-Kette, serverseitig zu enforcen).

## 9. Delete Semantics (TARGET-Richtung, Regeln OPEN)

Fachliche Zielrichtung: CV-Delete → SearchProfiles nicht mehr verfügbar;
SearchProfile-Delete → dessen ATS-Profile nicht mehr verfügbar (Kaskadenrichtung).
Als OPEN DECISION: Delete vs. Archive (pro Ebene), Nachweis/Verifikation,
Fremd-Delete-Schutz, Umgang mit geteilten/duplizierten Inhalten, Verfall vs.
sofortige Entfernung. Keine Implementierung, keine Regel vorweggenommen.

## 10. Identifier Target (konzeptionell, keine Formate)

User → `userId`; CV → `cvId` + `userId`; SearchProfile → `searchProfileId` + `cvId`;
ATSSearchProfile → `atsSearchProfileId` + `searchProfileId`. Keine UUID-/DB-/Hash-Formate
erfunden; Erzeuger (Client/Server), Stabilität, Versionierung = Implementierung nach
Identitäts-Entscheidung (Q1). Hash scheidet als Identity-Ersatz aus (02-Hash-Verbot).

## 11. Ownership Target

User A sieht/bearbeitet/löscht ausschließlich eigene CVs/SearchProfiles/ATS-Profile;
User B hat keinen Zugriff auf A-Objekte. Kette: `userId → cvId → searchProfileId →
atsSearchProfileId` (serverseitige Checks auf jeder Ebene). Tenant-/Auth-Mechanismen:
im Repo nicht als Architekturentscheidung belegt (03-Gate: Q1/Q2 OPEN) → hier nur als
Voraussetzung referenziert, NICHT erfunden.

## 12. Persistence Target

Jede Ebene (CV-Kontext, SearchProfile, ATSSearchProfile) wird user-gebunden persistent
(Überleben von Reload/Session/Browser-Schluss); Transient (Files, Rohtexte, Vorschläge,
Ergebnisse) bleibt transient; Kosten-Caches bleiben Caches (keine Benutzerobjekte).
Konkretes Store-/API-Design = Implementierung, nicht diese Spec. 12h/Session-Semantik
des IST wird durch Target-Persistenz abgelöst (Migrationswerte: 02-§9/§10).

## 13. IST → TARGET Matrix

| Bereich | IST (03) | TARGET | Gap |
|---|---|---|---|
| CV ownership | keine (Session) | User-gebunden, Kette §11 | Identität + Persistenz fehlen |
| CV limit | 10/Session (still + UI) | 10/User | Bezugsgröße + Server-Enforcement |
| SearchProfile limit | 50/Hash, kein Parent-Cap | 10/CV | Zahl + Bezug + Parent-Cap |
| ATS SearchProfile limit | 50/Bucket, kein Parent-Cap | 10/SearchProfile | Parent-Beziehung fehlt ganz |
| CV → SearchProfile | Hash-Bucket (schwach) | `cvId`-FK | echte Kante fehlt |
| SearchProfile → ATS | keine (Co-Anzeige) | `searchProfileId`-FK + Filter | Kante + Filter fehlen |
| SearchProfile Search | implementiert (Test) | erhalten | keiner (Referenzverhalten) |
| ATS Search Search | nicht existent | exklusiv ATS-Profil | neues Verhalten (Spec §§6,13) |
| Multiple SearchProfiles | ja (Dropdown, Cap 50) | ja (≤10/CV) | Limit-Anpassung |
| Multiple ATS | nein (Single-Select) | Speicherung ≤10; Aktivierung OPEN | Speicher neu; Aktiv-Modus OPEN |
| Edit | beide Typen, namensbasiert | beide Typen, ID-adressiert | Adressierung + Parent-Sicherheit |
| Delete | nur Verfall/Reload | Kaskadenrichtung + Regeln OPEN | Konzept + Regeln fehlen |
| Identifier | Session-/Inhalts-Schlüssel | `userId/cvId/searchProfileId/atsSearchProfileId` + FKs | alle IDs neu |
| Ownership | keine | Kette + serverseitige Checks | Identität (Q1) + Checks |
| Persistence | Session/12h/Cache | user-gebunden persistent | Store + API neu |

## 14. Open Decisions (echte Produkt-/Architekturentscheidungen)

Mehrere CVs gleichzeitig aktiv verwendbar? SearchProfile mehreren CVs zuordenbar
(Target: NEIN)? ATS-Profil mehreren SearchProfiles zuordenbar (Target: NEIN,
Ausnahmen unentschieden)? Ein vs. mehrere ATS gleichzeitig aktiv? Delete vs. Archive
(je Ebene)? Kaskaden-Details bei CV-/SearchProfile-Delete? SearchConfiguration-Feldkanon
(SearchProfile-exklusiv)? Zusatzfelder ATS-Profil? ATS-Analyse-Weiternutzung (§6)?
Übernahmeumfang aus ProfileStore (nur bestätigte Inhalte vs. alles)? `experienceLevel`?
Suchkontext-Felder (`radiusKm/workModes/employmentTypes`)? Alle unbeantwortet —
keine als Empfehlung getarnt.

## 15. RIS Boundary (TO BE RECONCILED, nichts gleichgesetzt)

Jobsearch-Target (User/CV/SearchProfile/ATSSearchProfile) vs. RIS-Begriffe:
`Saved JobSearch` (≈ SearchProfile-Nähe per Feldvergleich aus 02-§11, aber
ungleichgesetzt → OPEN), `SearchConfiguration` (kein Schema im Repo → OPEN),
`Candidate Profile` (kein Schema → OPEN). `userId = Cognito sub` im Repo unbelegt
(04) → OPEN. Keine Gleichsetzung vorgenommen; Abgleich erst nach Q1–Q3 möglich.

## 16. Implementation Preconditions (Reihenfolge, keine Vorwegnahme)

1. Produktentscheidungen Q1 (Identität) → Q2 (Auth) → Q3/Q4/Q6/Q13 (Kanon/Typisierung)
   — ohne sie bleibt jede Implementierung Raterei (02-§9, 03-Gate BLOCKED).
2. §14-Entscheidungen (Aktiv-Modus, Delete-Regeln, Feldkanon, Analyse-Weiternutzung).
3. Erst danach: IDs/FKs, Parent-Filter, ATS-Suchpfad, Limits-Enforcement, Persistenz,
   Migration nach 02-§10 (keine Strategie vorentschieden).

## 17. Final Status

Zielverhalten vollständig und widerspruchsfrei spezifiziert (alle 16 Auftragsbereiche
adressiert; IST-Anteile als erhalten markiert, Neues als TARGET, Unbelegtes als OPEN) —
jedoch mit echten offenen Produktentscheidungen (§14: Aktiv-Modus, Delete-Regeln,
Feldkanon u. a.) → **YELLOW**. Kein AI-Datenfluss/Modell geändert → keine
AI_AUDITLOG-Änderung (`docs/AI_AUDITLOG.md`-Template als Execution-Log-Pflicht durch
diesen Report erfüllt, Template-Datei unverändert).

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: YELLOW (Spec konsistent; §14-Entscheidungen offen — kein GREEN erfunden)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: `a67d384` (Spec-Stand; Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht gestartet (Doku-only, auftragsgemäß); keine Tests verändert
- Git-Status: vor Spec nur vorbestehende `docs/screenshotsfordev/`-Diffs (2 deleted, 2 untracked)
- Geänderte Dateien: ausschließlich `docs/reports/PROFILE-HIERARCHY-04-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only; nichts als implementiert dargestellt; keine Entscheidung vorweggenommen)
- Nächste Schritte: keine (Report + Commit; Implementierung erst nach §16-Voraussetzungen)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — reine Ziel-Spezifikation ohne Datenfluss-/Modelländerung. Keine AI-Audit-Ergänzung erzeugt.
