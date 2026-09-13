# STEP 36C — ATS Requirement & Evidence Rules

**AGENT:** Laguna XS 2.1

---

## PLAN

Entwickle fachliche Regeln für ATS Matching basierend auf STEP-36A und STEP-36B Ergebnissen.

Bereiche:
1. Job Requirements Modellierung
2. CV Evidence Definition
3. Match Status (MATCHED/PARTIAL/GAP/UNKNOWN)
4. Confidence Model
5. Experience Matching
6. Education / Certification
7. Keyword / Skill Matching
8. Priorisierung
9. ATS Score Foundation

---

## ACTION

### 1. Canonical Job Model analysiert
- `src/types.ts:11-28`
- Felder: slug, title, company_name, location[], remote, tags[], description, descriptionPlain, language, jobTypes, contractType, salary, startDate

### 2. Requirements-Definition geprüft
- Keine strukturierten Requirements-Objekte im Code
- Requirements müssen aus description extrahiert werden

### 3. Keyword-Matching analysiert
- `api/_lib/filter.mjs:117-124`
- `keywordHits()` prüft Title, Tags, Description

### 4. CV-Evidenz analysiert
- `api/profile.mjs` liefert nur: skills[], experienceLevel, targetRoles[], location
- Keine Education/Certification Experience Years

### 5. Match-Pipeline geprüft
- `api/match.mjs` nutzt keywordHits für Preselection
- Keine detaillierte Requirement-Bewertung

---

## RESULT

### REQUIREMENT CATEGORIES DEFINIERT

| Kategorie | Definition | Quelle |
|-----------|------------|--------|
| keyword | Positionales Keyword | job.tags, title |
| skill | Technische Fähigkeit | job.tags, description |
| requirement | Explizite Anforderung | description |
| experience | Berufserfahrung | description, CV |
| education | Akademische Ausbildung | description, CV |
| certification | Zertifizierung | description, CV |
| location | Geografischer Standort | location[] |
| workmode | Remote/Hybrid | remote |
| employment | Vollzeit/Teilzeit | jobTypes, contractType |

### MATCH STATUS RULES

| Status | Bedingung | Evidenz |
|--------|-----------|---------|
| MATCHED | Explizite Übereinstimmung | DIRECT |
| PARTIAL | Teilweise / Unsicher | INDIRECT |
| GAP | Widersprüchlich | CONFLICTING |
| UNKNOWN | Keine Evidenz | NONE |

### KEY PRINCIPLE

**"Nicht gefunden" ≠ "nicht vorhanden"**

Ein fehlendes Keyword darf nicht automatisch GAP bedeuten.

---

### CONFIDENCE MODEL

| Confidence | Beweis | Entscheidung |
|------------|--------|--------------|
| HIGH | Explizites Keyword-Match | Regex/Token |
| MEDIUM | Indirekter Hinweis | Kontext-Analysis |
| LOW | AI-Interpretation | Semantic Matching |

### IMPORTANCE MODEL

| Level | Bedeutung | Score-Faktor |
|-------|-----------|--------------|
| CRITICAL | "required" | 1.0 |
| HIGH | explizit | 0.75 |
| MEDIUM | "preferred" | 0.5 |
| LOW | optional | 0.25 |

---

## GIT STATE

```
HEAD = e8236b6 (tracking origin/main)
Branch: main
Status: Clean
```

---

## OPEN QUESTIONS

1. **Soll Profile um education/certifications erweitert werden?**
   - Aktuell: Nur skills, experienceLevel, targetRoles, location
   - Empfehlung: Nur während ATS-Extraktion

2. **Regex vs AI für Experience Years?**
   - Regex für einfache Fälle
   - AI für komplexe Formulierungen

3. **CONFIDENCE-Schwellwert für PARTIAL?**
   - Keine definierte Schwelle
   - TODO: Konkrete Regel definieren

4. **Confidence vs ATS-Score Trennung?**
   - Confidence = Vertrauenswürdigkeit
   - Score = Gewichtete Bewertung

---

## AUDIT/EVIDENCE

**Quellen:**
- `docs/ARCHITECTURE.md` — Job Sources
- `docs/AI_PROVIDERS.md` — Provider Router
- `src/types.ts` — Model-Definition
- `api/_lib/filter.mjs` — Matching-Logik
- `api/profile.mjs` — CV Extraktion

---

## COST / RISK

| Aktivität | Kosten | Risiko |
|-----------|--------|--------|
| Analyse | FREE | Niedrig |
| Regex/Token | FREE | Niedrig |
| AI-Extraktion | PROXY | Medium |

---

## STOP

Keine Code-Änderungen. Keine Apify-Runs. Kein Deployment.

```
STATUS = STEP 36C COMPLETE - ANALYSIS ONLY
```