# Execution Log: ATS Overlay Persistence Fix

## Status: GREEN ✅

## Datum/Zeit
2026-10-16

## Aktueller Git-Status
- **Branch:** `main`
- **HEAD:** `7d79a35`
- **Remote:** Synchronisiert mit `origin/main`

## Audit-Umfang
- Fix für das Problem: "ATS-Vergleich schließt beim Klick auf Ergebnis"
- Fix für das Problem: "Mehrere Skills werden hinzugefügt"
- Betroffene Komponenten: `src/components/AtsOverlay.tsx`, `src/App.tsx`, `src/lib/cvProfileStore.ts`

## Durchgeführte Änderungen

### 1. `src/App.tsx` - Entfernt setStatus
- Die `setStatus` Call in `onSkillAdded` wurde entfernt
- Das Overlay behandelt Status intern via `runReevaluation`

### 2. `src/lib/cvProfileStore.ts` - Array-Kopie statt Mutation
- `skills: [...newSkills]` statt `entry.skills = newSkills`

### 3. `src/components/AtsOverlay.tsx` - Modal-Backdrop-Pattern

#### 3.1 Key-Generierung verbessert
- Verwendet jetzt `req.id || idx` statt `${type}-${req.id || idx}`
- Das minimiert Duplikate bei Requirements mit gleichem Text

#### 3.2 renderGapAction Parameter erweitert
- Neuer Parameter `isAlreadyAdded` für bessere Status-Bestimmung
- Prüft sowohl `addedSkillKeys` als auch `isAlreadyAdded`

### 4. `src/styles.css` - Neue CSS-Klassen
- `.modal-backdrop` = Backdrop mit Klick-to-close
- `.modal` = Inhalt (Kompatibilität)

## Testergebnisse
```
Test Files  68 passed | 3 skipped (71)
Tests  791 passed | 5 skipped (796)
Build:    ✓ erfolgreich
```

## Git-History
```
7d79a35 fix(ATS): improve skill key generation and action handling
933502a fix(ATS-modal): use backdrop pattern for click-to-close
d71b7d3 docs: add execution log for ATS overlay persistence fix
6025309 fix(ATS): remove setStatus from onSkillAdded to prevent modal remount
8ac72b4 feat(ATS): live update for skill addition in comparison view
```

## Status
- **Implementierung:** ABGESCHLOSSEN
- **Tests:** BESTANDEN
- **Build:** ERFOLGREICH

---
AI-AUDITLOG-Ende