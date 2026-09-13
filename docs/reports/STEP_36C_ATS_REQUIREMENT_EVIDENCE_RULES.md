# STEP 36C — ATS REQUIREMENT & EVIDENCE RULES

**AGENT:** Laguna XS 2.1

---

## CONTEXT REVIEW

Basierend auf STEP-36A und STEP-36B analysiert.

**Bestehende Modelle:**
- Job: slug, title, company_name, location[], remote, tags[], description, descriptionPlain, language, jobTypes, contractType, salary, startDate
- Profile: skills, targetRole, city, radiusKm, workModes, employmentTypes
- SuggestedProfile: skills[], experienceLevel, targetRoles[], location

**Wichtige Bestandteile:**
- `keywordHits()` in filter.mjs für Skills-Matching
- `locationMatches()` für Standort-Matching
- `detectLanguage()` für Spracherkennung
- Profile-Cache mit SHA-256 Hash

---

## REQUIREMENT MODEL

### Anforderungstypen

| Kategorie | Definition | ATS-Relevanz |
|-----------|------------|--------------|
| **keyword** | Positionales Keyword aus Job-Daten | HIGH |
| **skill** | Technische Fähigkeit/Kompetenz | HIGH |
| **requirement** | Explizite berufliche Anforderung | HIGH |
| **experience** | Berufserfahrung/Jahre | HIGH |
| **education** | Akademische Ausbildung | MEDIUM |
| **certification** | Zertifizierung/Abnahme | HIGH |
| **location** | Geografischer Standort | HIGH |
| **workmode** | Remote/Hybrid/Vor Ort | HIGH |
| **employment** | Vollzeit/Teilzeit | MEDIUM |

---

## REQUIREMENT SOURCES

### Quellen für Requirements

| Quelle | Stärke | Schwäche | ATS-Qualität |
|--------|--------|----------|--------------|
| `title` | Mittel | Unspezifisch | LISTEN |
| `tags[]` | Hoch | Kann leer sein | STRUKTURIERT |
| `jobTypes` | Mittel | Fehl bei BA | STRUKTURIERT |
| `contractType` | N/A | Keine Skills | NINJA |
| `description` | SEHR HOH | Unstrukturiert | Fließtext |

---

## IMPORTANCE MODEL

### Prioritätslevels

| Level | Bedingung | Score-Einfluss |
|-------|-----------|----------------|
| **CRITICAL** | explizit "required" / "must have" | 100% |
| **HIGH** | explizit erwähnt, keine Alternative | 75% |
| **MEDIUM** | "preferred" / optional | 50% |
| **LOW** | kontextueller Hinweis | 25% |

---

## CV EVIDENCE MODEL

### Evidenztypen

| Typ | Definition | Verwendung |
|-----|------------|------------|
| **DIRECT** | Explizite Erwähnung im CV | MATCHED |
| **INDIRECT** | Indirekte Unterstützung | PARTIAL |
| **NONE** | Keine Evidenz | UNKNOWN |
| **CONFLICT** | Widersprüchlich | GAP |

---

## MATCH STATUS RULES

### STATUS-Definitionen

**MATCHED:**
- Direkte, unstrittige Evidenz
- Beispiel: Job verlangt "React", CV hat "React"

**PARTIAL:**
- Teilweise Evidenz / Unsicherheit
- Beispiel: Job verlangt "5 Jahre AWS", CV hat "3 Jahre"

**GAP:**
- Belastbare Evidenz, dass Anforderung nicht erfüllt
- Beispiel: Job verlangt "AWS", CV hat kein AWS

**UNKNOWN:**
- Keine belastbare Evidenz
- Beispiel: CV ohne AWS-Angaben

---

## KEYWORDS / SKILLS MATCHING

### Normalisierung

**Synonyme:**
- React = React.js = ReactJS
- AWS = Amazon Web Services = Amazon AWS
- Kubernetes = K8s = K8s

**Entscheidung:**
- Regex-basierte Normalisierung
- Keine AI-Abhängigkeit für Tokens

---

## CONFIDENCE MODEL

### Confidence-Werte

| Wert | Bedeutung | Anforderung |
|------|-----------|-------------|
| **HIGH** | Explizite Evidenz | Regex / Token-Match |
| **MEDIUM** | Indirekte Evidenz | Kontext + Pattern |
| **LOW** | Vermutete Evidenz | AI-Interpretation |

---

## ATS INPUT CONTRACT

### Vorschlagener Vertrag

```typescript
interface ATSInput {
  job: {
    slug: string;
    title: string;
    company: string;
    descriptionPlain: string;
    location: string[];
    remote: boolean;
    tags: string[];
    language?: string;
    contractType?: string;
    salary?: string;
  };
  cv: {
    text: string;
    profile: {
      skills: string[];
      targetRole: string;
      location: string;
      experienceLevel?: string;
    };
  };
}
```

---

## ARCHITECTURE RECOMMENDATION

**LEAN CANONICAL JOB + ATS EXTRACTION LAYER**

- Keine Schema-Änderung
- Zusätzliche Felder nur in ATS extrahieren
- AI-basierte Erfahrung/Certificate Extraktion

---

## TEST MATRIX CASES

| Fall | Erwartetes Ergebnis |
|------|---------------------|
| 1. Exact keyword match | MATCHED + HIGH |
| 2. Synonym match | MATCHED + MEDIUM |
| 3. Partial experience | PARTIAL + HIGH |
| 4. Missing evidence | UNKNOWN |
| 5. Explicit gap | GAP + HIGH |

---

## OPEN QUESTIONS

1. Soll Profile um education/certifications erweitert werden?
2. Regex vs AI für Experience Years?
3. Wie wird PARTIAL confidence berechnet?
4. Confidence vs Score Trennung?

---

## AUDIT / EVIDENCE

**Verifizierte Dateien:**
- `src/types.ts`
- `api/_lib/filter.mjs`
- `api/profile.mjs`
- `api/_lib/sources/arbeitnow.mjs`
- `api/_lib/sources/apify/actors.mjs`

---

## GIT STATE

```
Commit: e8236b6
Branch: main
Status: Clean
No changes made
```

---

## STOP

Keine Code-Änderungen. Keine Apify-Runs. Kein Deployment.

```
STATUS = STEP 36C COMPLETE - ANALYSIS ONLY
```