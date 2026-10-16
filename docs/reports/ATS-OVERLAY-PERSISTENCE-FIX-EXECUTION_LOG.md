# Execution Log: ATS Overlay Persistence Fix

## Status: GREEN ✅

## Datum/Zeit
2026-10-16

## Aktueller Git-Status
- **Branch:** `main`
- **HEAD:** `6025309`
- **Remote:** Synchronisiert mit `origin/main`

## Audit-Umfang
- Fix für das Problem: "ATS-Vergleich schließt sich nach Skill-Hinzufügung"
- Betroffene Komponenten: `src/App.tsx`, `src/components/AtsOverlay.tsx`, `src/lib/cvProfileStore.ts`

## Durchgeführte Änderungen

### 1. Root-Cause-Bestimmung
- `updateCvAtsProfileSkills` mutierte das Array direkt: `entry.skills = newSkills`
- `setStatus` in `onSkillAdded` löste unnötigen Re-render aus
- `AtsOverlay` hatte `skillsForAts` als useEffect-Dependency

### 2. Implementierte Fixes

#### Datei: `src/lib/cvProfileStore.ts` (Zeile 238)
```
BEFORE: entry.skills = newSkills; // direkte Mutation
AFTER:  entry.skills = [...newSkills]; // Kopie
```

#### Datei: `src/components/AtsOverlay.tsx` (Zeile 66)
```
BEFORE: }, [job, skillsForAts, t, onAtsAnalyzed]);
AFTER:  }, [job, t, onAtsAnalyzed]);
```

#### Datei: `src/App.tsx` (Zeile 2605)
```
BEFORE: setStatus({ type: "info", message: t("ats.skill.added") });
AFTER:  // Entfernt - AtsOverlay behandelt Status intern via runReevaluation
```

### 3. Testergebnisse
```
Test Files  68 passed | 3 skipped (71)
Tests  791 passed | 5 skipped (796)
Build:    ✓ erfolgreich
```

### 4. Git-Status
```
git status: clean
git log --oneline -2:
6025309 fix(ATS): remove setStatus from onSkillAdded to prevent modal remount
8ac72b4 feat(ATS): live update for skill addition in comparison view
```

### 5. Verifizierte Anforderungen

| Anforderung | Status |
|------------|--------|
| ATS-Vergleich bleibt offen nach Skill-Hinzufügung | ✅ |
| Score wird live aktualisiert | ✅ |
| Keine doppelten Skills entstehen | ✅ |
| Keine neue KI-Engine | ✅ |
| Keine zusätzlichen API-Aufrufe | ✅ |

## Dateien geändert
- `src/App.tsx` (1 Zeile geändert)
- `src/components/AtsOverlay.tsx` (1 Zeile geändert)
- `src/lib/cvProfileStore.ts` (1 Zeile geändert)
- `src/components/MatchCard.tsx` (neue Prop `analyzing` hinzugefügt)
- `src/components/Results.tsx` (neue Prop `analyzingJobSlug` hinzugefügt)
- `src/components/RemainingCard.tsx` (neue Prop `analyzing` hinzugefügt)

## Commit
- SHA: `6025309`
- Nachricht: "fix(ATS): remove setStatus from onSkillAdded to prevent modal remount"
- PUSH: Nach `origin/main` verifiziert

---
AI-AUDITLOG-Ende