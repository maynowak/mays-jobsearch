# STEP 36A — ATS Match & CV Tailoring: fachliche Analyse

## FINDINGS → PROPOSED DATA CONTRACT → REUSE → OPEN QUESTIONS → GIT STATE → STOP

---

### FINDINGS

**Data Models Identifiziert:**

| Modell | Speicherort | Struktur |
|--------|-------------|----------|
| **Job** | `api/_lib/sources/arbeitnow.mjs:56-76` | slug, title, company_name, location[], remote, tags[], description, descriptionPlain, language, jobTypes, contractType, source[] |
| **Profile** | `src/types.ts:40-47` | skills, targetRole, city, radiusKm, workModes, employmentTypes |
| **Match** | `src/types.ts:56-61` | score, why, prepare, job |
| **SuggestedProfile** | `src/types.ts:49-54` | skills[], experienceLevel, targetRoles[], location |

**CV Extraktion:**
- `api/profile.mjs`: PDF → Text (pdfjs) → AI → SuggestedProfile
- Cache: L1 localStorage + L2 Redis, 30 Tage TTL

**Matching:**
- `api/match.mjs`: keywordHits Preselection → AI Bewertung (0-100)
- `api/_lib/filter.mjs`: tokenize, keywordHits, locationMatches

---

### PROPOSED DATA CONTRACT

**ATS Analysis Result Structure:**

```typescript
interface ATSAnalysisItem {
  type: "MATCHED" | "PARTIAL" | "GAP" | "UNKNOWN";
  category: "keyword" | "skill" | "requirement" | "experience" | 
            "education" | "certification" | "location" | "workmode" | "employment";
  field: string;
  found: boolean;
  confidence?: number; // 0-100 für PARTIAL
  evidence?: string;
  recommendation: string;
}

interface ATSAnalysisResult {
  job: { slug: string; title: string; company: string };
  profile: { skills: string[]; targetRole: string; city: string };
  items: ATSAnalysisItem[];
  scores: {
    keywordMatch: number;
    skillMatch: number;
    locationMatch: number;
    workmodeMatch: number;
    employmentMatch: number;
    overall: number;
  };
  summary: { matched: number; partial: number; gap: number; unknown: number };
  recommendations: string[];
}
```

**Schlüsselprinzip:** "not found" ≠ "not present"
- `found: false` + Evidence → existiert, passt nicht
- `found: undefined` → unbestimmt (keine Daten)
- `found: null` → wirklich unbekannt

---

### REUSE

**Werkzeuge, die wiederverwendet werden können:**

| Komponente | Datei | Grund |
|------------|-------|-------|
| tokenize() | filter.mjs:9-16 | Tokenisierung für Keyword-Vergleich |
| keywordHits() | filter.mjs:117-124 | Kernlogik für Skills-Matching |
| locationMatches() | filter.mjs:107-115 | Stadt-basierte Standortanalyse |
| htmlToPlainText() | filter.mjs:48-54 | Normalisierung von CV-Tекст |
| detectLanguage() | filter.mjs:81-100 | Spracherkennung für Übertragung |
| Profile-Cache | profile.mjs:99-104 | SHA256 + (L1/L2) Caching Muster |
| AI-Hook | providers/index.mjs | chat() für strukturierte Ausgabe |

**Endpoints, die erweitert werden können:**

| Endpoint | Nutzung |
|----------|---------|
| `/api/profile` | Existiert für CV-Extraktion, kann um education/certificates erweitert werden |
| `/api/match` | Vereist Matching-Logik, kann detaillierte ATS-Analyse liefern |

---

### OPEN QUESTIONS

1. **Education/Certificates Extraktion**: Soll `profile.mjs` um `education` und `certifications` erweitert werden?

2. **Erfahrungstiefe**: Wie detailliert soll Experience-Matching sein? Jahreszahlen oderRollen/ -Dauer?

3. **Caching-Strategie**: Echtzeit oder längeres Caching wie beim Profil (7 Tage)?

4. **Batch vs Einzel**: Einzelanalyse pro Job oder Batch für alle Matches?

5. **Lokalisierung**: Sind Empfehlungen an Wohnort des Jobs angepasst?

---

### GIT STATE

```
Commit: e8236b6
Branch: main (Tracking origin/main)
Status: Clean
```

---

### STOP

Keine Implementierung durchgeführt.

```
STATUS = STEP 36A COMPLETE - ANALYSIS ONLY
```

---