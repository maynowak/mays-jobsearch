# ATS-DEEP-INVESTIGATION-01 — EXECUTION LOG (ATS-Tiefenanalyse: Datenfluss, Matching, Privacy)

## Current status
FINALIZED — Untersuchung abgeschlossen, alle 10 Fragen beantwortet.

## Audit date/time
2026-09-28 (nach API-TARGETROLES-01; Start-HEAD feb3a49, gepusht)

## Git state (Start)
- Branch: main, HEAD feb3a49, synchron mit origin/main, working tree clean

## Task / Purpose (User-Request)
Detaillierter Untersuchungsbericht zu folgenden Fragen:
1. Welches ATS-Profil wird tatsächlich verwendet?
2. Welche Daten gehen in die ATS-Analyse?
3. Welche Anforderungen extrahiert ATS aus einer Stelle?
4. Wie werden Skills/Requirements gematcht?
5. Wie entsteht das Ergebnis?
6. Was passiert bei fehlenden Skills?
7. Was passiert bei vorhandenem Skill mit unterschiedlicher Schreibweise?
8. Wie verhält sich ATS bei verschiedenen Zielrollen?
9. Bleibt das Search Profile vom ATS Profile getrennt?
10. Wird weiterhin ausschließlich anonymisiertes Material an externe Modelle gegeben?

## Untersuchungs-Fragen (Detail) & Antworten

### 1. Welches ATS-Profil wird tatsächlich verwendet?
**Antwort:** Es gibt zwei Quellen, priorisiert nach dem CV-Upload-Workflow:
- **Aktiv gewähltes ATS-Profil** (`activeAtsEntryId`): Wenn der Nutzer im CV-Bereich ein ATS-Profil auswählt (Dropdown in der Profil-Übersicht), hat dieses **Vorrang** (App.tsx:2239-2248). Das Profil kommt aus `cvProfileStore` (Session-Speicher, 12h TTL) und enthält `skills[]`, `targetRoles[]`.
- **Fallback: Allgemeines Suchprofil** (`profile` State): Wenn kein ATS-Profil gewählt ist, wird das manuelle/aktive Suchprofil verwendet (Skills + Zielrollen aus der Suchmaske).
- **Wichtig:** Das ATS-Profil ist **rein skill-basiert** — es enthält KEINE Stadt, KEINEN Radius, KEINE Arbeitsmodi. Nur `skills` (String, kommagetrennt) und `targetRoles[]` gehen in die Analyse.

### 2. Welche Daten gehen in die ATS-Analyse?
**Request an `/api/ats-analysis` (App.tsx:901, AtsOverlay.tsx:35-38):**
```json
{
  "job": { "title": "...", "tags": [...], "slug": "..." },
  "profile": { "skills": "Java, AWS, React, ..." },
  "ai": { "enabled": false, "consent": false }
}
```
**Details:**
- **Job-Daten:** Titel, Tags (Skill-Keywords aus Quelle), Slug — **KEINE Firmenname, KEINE Beschreibung, KEIN Ort** im initialen Request.
- **Profil-Daten:** Ausschließlich `skills` String (kommagetrennt). `targetRoles` wird aktuell NICHT an die ATS-Analyse übergeben (nur für AI-Formulierung potenziell relevant).
- **AI-Optionen:** `enabled: false` für deterministische Basis-Analyse; `enabled: true + consent: true` nur nach expliziter Einwilligung im Overlay (ConsentGate).
- **Anonymisierung:** Die Job-Daten stammen aus öffentlichen Stellenanzeigen (API-Quellen). Das Profil enthält nur Skills — **keine PII** (Name, E-Mail, Telefon, Adresse, Arbeitgeber, Daten). Die Anonymisierung in `anonymize.ts` greift bei CV-Text-Upload, aber beim ATS-Request sind bereits nur Skills enthalten.

### 3. Welche Anforderungen extrahiert ATS aus einer Stelle? (`api/_lib/ats.mjs:extractRequirementsFromJob`)
**Quellen & Kategorien:**
| Quelle | Kategorie | Beispiel |
|--------|-----------|----------|
| Job-Titel (tokenisiert) | `keyword` | "Senior", "Frontend", "Developer" |
| Job-Tags | `skill` | "React", "TypeScript", "AWS" |
| Beschreibung (Plaintext) | `skill` | Extrahierte Tokens > 2 Zeichen |
| Beschreibung | `experience` | "3+ years", "5 years experience" |
| Beschreibung | `education` | "Bachelor in Computer Science" |
| Beschreibung | `certification` | "AWS Certified Solutions Architect" |
| Job-Sprache | `language` | "Deutsch", "English" |
| Beschreibung (wenn required/preferred) | `location` | Städte aus Beschreibung |
| `job.remote` | `workmode` | "remote" / "onsite" |
| `job.jobTypes` | `employment` | "full_time", "part_time" |
| `job.contractType` | `employment` | "Vollzeit", "Unbefristet" |

**Wichtigkeit (importance):**
- `high`: Explizit "required"/"must have"/"mandatory" ODER `contractType` ODER Experience mit "+"
- `medium`: Explizit "preferred"/"nice to have" ODER Standard-Skills/Remote/JobTypes
- `low`: Implizite Anforderungen (nur aus Beschreibung extrahiert ohne Keywords)

**Normalisierung:** Jede Anforderung erhält `normalized` Form via `normalizeSkill()` (Alias-Map: "k8s"→"kubernetes", "aws"→"aws", "nodejs"→"node.js", etc.).

### 4. Wie werden Skills/Requirements gematcht? (`ats.mjs:matchRequirement`)
**Algorithmus (deterministisch, KEIN AI):**
```javascript
// 1. Exakter Match (nach Normalisierung)
if (cvSkillsLower.includes(normalizedReq)) → MATCHED (HIGH)

// 2. Partieller Match (Substring in beide Richtungen)
if (cvSkill.includes(req) || req.includes(cvSkill)) → PARTIAL (MEDIUM)

// 3. Skill-Varianten (Alias-Map)
if (normalizeSkill(cvSkill) === normalizedReq) → PARTIAL (MEDIUM)

// 4. Experience → UNKNOWN (nicht über Skills matchbar)

// 5. Widerspruchs-Prüfung (Contradiction Detection)
if (cv hat "React" UND Job verlangt "Angular") → GAP (wenn high/critical)

// 6. Sonst → UNKNOWN (LOW)
```

**Keyword-Tokenisierung (`filter.mjs:tokenize`):**
- Array-Input (Skills): Jeder Eintrag → lowercase, trim, als **ein Token** erhalten (Multi-Word-Skills wie "Spring Boot" bleiben zusammen)
- String-Input: Split an whitespace, comma, semicolon

### 5. Wie entsteht das Ergebnis? (`ats.mjs:analyzeJobForAts`)
**Scoring (wichtungsbasiert):**
```
importanceWeight: critical=4, high=3, medium=2, low=1

matchedWeight = Σ(weight für MATCHED) + 0.5 * Σ(weight für PARTIAL)
totalWeight   = Σ(weight aller Requirements)
score (0-100) = round(matchedWeight / totalWeight * 100)

keywordCoverage = round((MATCHED + PARTIAL) / totalRequirements * 100)
```

**Output-Struktur (`AtsAnalysisResponse`):**
- `analysis.score` (0-100) = gewichteter Skill-Match-Score
- `analysis.keywordCoverage.overall` (0-100%) = Abdeckungsquote
- `analysis.requirements[]` = alle extrahierten Requirements mit id, text, category, importance
- `analysis.matches[]` = pro Requirement: status (MATCHED/PARTIAL/GAP/UNKNOWN), confidence
- `analysis.criticalGaps[]` = hochwichtige Requirements mit GAP/Contradiction
- `analysis.recommendations[]` = generierte Empfehlungen (s.o.)
- `ai.*` = AI-Formulierungs-Metadaten (nur bei `enabled+consent`)

### 6. Was passiert bei fehlenden Skills?
- Status = **UNKNOWN** (confidence LOW)
- Wenn Requirement `importance >= high` → **Recommendation: `missing_evidence`** ("CV-Evidenz prüfen/ergänzen für X")
- Wenn `importance = medium` UND Kategorie `skill` → ebenfalls `missing_evidence`
- **NIEMALS** wird ein fehlender Skill als vorhanden behauptet (Safety: `validateRecommendationSafety` blockt `GAP_FLAG` und `UNKNOWN_REVIEW` für AI-Generierung)
- Im Score: 0 Gewichtung für UNKNOWN (nur MATCHED=1.0, PARTIAL=0.5 zählen)

### 7. Was passiert bei vorhandenem Skill mit unterschiedlicher Schreibweise?
**Alias-Map (`SKILL_ALIASES` in `ats.mjs:3-11`):**
| Input | Normalisiert zu |
|-------|-----------------|
| "AWS", "Amazon Web Services" | "aws" |
| "Kubernetes", "K8s" | "kubernetes" |
| "Node.js", "Nodejs" | "node.js" |
| "React", "React.js" | "react" |

**Matching-Logik:**
1. Exakter Match nach Normalisierung → **MATCHED**
2. Substring-Match (CV "Amazon Web Services" vs. Job "AWS") → **PARTIAL** (dafter Normalisierung beide "aws")
3. Variant-Check in `analyzeJobForAts:364-374`: `normalizeSkill(cvSkill) === normalizedReq` → **PARTIAL** (MEDIUM)

**Beispiel:** CV hat "K8s", Job verlangt "Kubernetes" → normalisiert beide zu "kubernetes" → MATCHED.

### 8. Wie verhält sich ATS bei verschiedenen Zielrollen?
**Aktueller Stand:** Die `targetRoles` aus dem ATS-Profil (`activeAtsEntry.targetRoles[]`) werden an das ATSModal übergeben (App.tsx:2243), aber **nicht an `/api/ats-analysis` gesendet** (AtsOverlay.tsx:34-38 sendet nur `skills`).

**Einfluss der Zielrolle heute:**
- **Kein direkter Einfluss** auf die deterministische ATS-Analyse (die nur Skills matched).
- **Indirekt:** Die Zielrolle bestimmt welche ATS-Profile der Nutzer anlegt (z.B. "Cloud Architect - ATS1" mit Cloud-Skills vs. "Frontend Dev - ATS2" mit React-Skills).
- **AI-Formulierung (optional):** Könnte Zielrolle als Kontext nutzen, aktuell aber nicht implementiert.

**Multi-TargetRole (UX-12):** Das ATS-Profil kann jetzt mehrere Zielrollen speichern (`targetRoles[]`), aber die Analyse nutzt nur die Skills. Ein Feature-Request wäre: Zielrolle als Filter für Requirements (z.B. nur "Cloud"-relevante Requirements bei Cloud-Rolle).

### 9. Bleibt das Search Profile vom ATS Profile getrennt?
**JA — strikte Trennung:**
| Aspekt | Search Profile | ATS Profile |
|--------|----------------|-------------|
| **Speicher** | `cvProfileStore.searchProfiles[]` | `cvProfileStore.atsProfiles[]` |
| **Felder** | Profile (skills, targetRoles[], city, radiusKm, workModes, employmentTypes) | skills[], targetRoles[], name |
| **Zweck** | Job-Suche (`/api/jobs`) | ATS-Analyse (`/api/ats-analysis`) |
| **Auswahl** | `selectedSavedSearchId` (Dropdown "Suchprofil") | `activeAtsEntryId` (Dropdown "ATS-Profil") |
| **Verwendung** | `runCvSearch`, `runSearch` | `AtsOverlay` (per-Job-Analyse) |

**Keine Vermischung:** 
- Suchprofil wird NIE für ATS-Analyse verwendet (außer Fallback wenn kein ATS-Profil gewählt)
- ATS-Profil wird NIE für Job-Suche verwendet
- Unterschiedliche UI-Bereiche, unterschiedliche Speicher-Keys, unterschiedliche API-Endpunkte

### 10. Wird weiterhin ausschließlich anonymisiertes Material an externe Modelle gegeben?
**JA — Privacy-by-Design:**
- **Deterministische Analyse (Standard):** Läuft **lokal auf Server** (`analyzeJobForAts`), **kein externer Aufruf**. Nur Job-Daten (öffentlich) + Skills (User-Input).
- **AI-Formulierung (Opt-In):** Nur bei `ai.enabled=true` + `consent=true` (ConsentGate im Overlay).
  - **Datenminimierung** (`ats-analysis.mjs:182-186`): `dataMinimized: true`
  - **Gesendete Kategorien:** `["job requirement", "matched keyword", "change type"]`
  - **NICHT gesendet** (`getPrivacyNotice` in `ats.mjs:789-812`):
    - Name, E-Mail, Telefon, Adresse
    - Arbeitgeber, Projekt-Namen
    - Daten, Erfahrungsjahre
    - Vollständiger CV-Text
    - Fotos/Anhänge
  - **Anbieter:** OpenRouter (VERIFIED Privacy) oder EdenAI (UNKNOWN)
  - **Safety-Validation:** `validateRecommendationSafety` prüft jede AI-Antwort — **DO_NOT_GENERATE** bei GAP/UNKNOWN, **REVIEW_REQUIRED** bei potentieller Erfindung.

## Code-Referenzen (Beweispflicht)
| Frage | Datei:Zeile |
|-------|-------------|
| ATS-Profil Auswahl | App.tsx:2239-2248 |
| ATS-Request Payload | AtsOverlay.tsx:34-38, api.ts:338-348 |
| Requirements Extraktion | api/_lib/ats.mjs:167-295 |
| Skill Matching | api/_lib/ats.mjs:297-329 |
| Scoring & Ergebnis | api/_lib/ats.mjs:331-525 |
| Fehlende Skills Handling | api/_lib/ats.mjs:439-456, 606-618 |
| Alias/Normalisierung | api/_lib/ats.mjs:3-11, 30-33, 364-374 |
| Zielrollen im ATS-Profil | App.tsx:2243, cvProfileStore.ts:28,30 |
| Search vs. ATS Trennung | cvProfileStore.ts:17-35, App.tsx:71-73, 2239-2250 |
| Anonymisierung | src/lib/anonymize.ts:1-75 |
| AI Privacy & Minimierung | api/ats-analysis.mjs:170-243, api/_lib/ats.mjs:789-812 |
| Safety Validation | api/_lib/ats.mjs:650-684 |

## Completed sections
- [x] Code-Analyse (App.tsx, ATSModal/AtsOverlay, analyzeATS, anonymize, filter.mjs, ats.mjs)
- [x] Antworten auf alle 10 Fragen dokumentiert
- [x] Audit-Eintrag finalisiert (hier, unten)

## Classification
GREEN — ATS-Architektur vollständig dokumentiert; Privacy-by-Design eingehalten; Search/ATS-Profile sauber getrennt; deterministische Basis-Analyse ohne externe Abhängigkeiten; AI-Opt-In mit Datenminimierung & Safety-Checks.

## Resume point
Abgeschlossen; keine Implementation nötig (reine Analyse/Dokumentation).