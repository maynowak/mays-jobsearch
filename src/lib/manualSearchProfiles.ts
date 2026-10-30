import type { Job, Profile } from "../types";

// MAYS-SEARCH-PROFILE-MANUAL-01:
// Unabhaengige, manuell definierbare Suchprofile.
//
// Fachliche Abgrenzung zur bestehenden CV-Hierarchie:
//   CV -> SearchProfile -> ATSSearchProfile   (bestehend, unveraendert)
//   SESSION -> ManualSearchProfiles           (neu, ohne CV-Bezug)
//
// Ein manuelles Suchprofil ...
//  - braucht keinen CV und keinen CV-Hash (es entsteht kein kuenstlicher CV),
//  - wird ausschliesslich fuer die laufende Sitzung gehalten (kein
//    localStorage, keine Kontopersistenz),
//  - loest durch Erstellen/Bearbeiten/Speichern/Auswaehlen/Duplizieren/Loeschen
//    keinerlei Modellaufruf aus,
//  - verwendet den bestehenden Suchvertrag (`Profile`) weiter, statt eine
//    zweite, inkompatible Parameterstruktur einzufuehren.
//
// Die Suchparameter kommen aus `searchConfig`. `matchingPreferences` beschreibt
// Muss-/Wunsch-/Ausschlusskriterien und ist fachlich getrennt von den
// ATS-Kompetenznachweisen (kein gemeinsamer Score, keine Vermischung).

export const MANUAL_SEARCH_PROFILE_SCHEMA_VERSION = 1 as const;

export type ManualSearchProfileSchemaVersion = typeof MANUAL_SEARCH_PROFILE_SCHEMA_VERSION;

export interface ManualSearchProfilePreferences {
  /** Muss-Kriterien: fehlt eines, passt die Stelle fachlich nicht. */
  requiredSkills: string[];
  /** Wunsch-Kriterien: beeinflussen nur die Information, keine Muss-Pruefung. */
  preferredSkills: string[];
  /** Ausschluesse: ein Treffer spricht gegen die Stelle. */
  excludedTerms: string[];
}

export interface ManualSearchProfile {
  /** Innerhalb der Sitzung eindeutig und stabil. */
  id: string;
  schemaVersion: ManualSearchProfileSchemaVersion;
  name: string;
  description?: string;
  origin: "manual";
  /** Bestehender Suchvertrag — wird unveraendert an die Suche uebergeben. */
  searchConfig: Profile;
  matchingPreferences: ManualSearchProfilePreferences;
  /** ISO-Zeitstempel; bleibt bei Aenderungen unveraendert. */
  createdAt: string;
  /** ISO-Zeitstempel; wird bei fachlichen Aenderungen aktualisiert. */
  updatedAt: string;
}

/** Formulareingabe (ohne technische Felder wie id/Timestamps). */
export interface ManualSearchProfileDraft {
  name: string;
  description: string;
  searchConfig: Profile;
  matchingPreferences: ManualSearchProfilePreferences;
}

export interface ManualSearchProfileRepository {
  list(): ManualSearchProfile[];
  get(id: string): ManualSearchProfile | null;
  save(profile: ManualSearchProfile): ManualSearchProfile;
  delete(id: string): boolean;
}

export interface ManualSearchProfileRepositoryOptions {
  /** Injizierbar fuer deterministische Tests. */
  now?: () => number;
  createId?: () => string;
}

function cloneProfile(profile: Profile): Profile {
  return {
    skills: profile.skills ?? "",
    targetRoles: [...(profile.targetRoles ?? [])],
    city: profile.city ?? "",
    radiusKm: profile.radiusKm ?? null,
    workModes: [...(profile.workModes ?? [])],
    employmentTypes: [...(profile.employmentTypes ?? [])],
  };
}

function clonePreferences(
  preferences: ManualSearchProfilePreferences | undefined
): ManualSearchProfilePreferences {
  return {
    requiredSkills: [...(preferences?.requiredSkills ?? [])],
    preferredSkills: [...(preferences?.preferredSkills ?? [])],
    excludedTerms: [...(preferences?.excludedTerms ?? [])],
  };
}

/** Defensive Kopie — kein Aufrufer kann den gespeicherten Datensatz mutieren. */
export function cloneManualSearchProfile(profile: ManualSearchProfile): ManualSearchProfile {
  return {
    id: profile.id,
    schemaVersion: MANUAL_SEARCH_PROFILE_SCHEMA_VERSION,
    name: profile.name,
    ...(profile.description === undefined ? {} : { description: profile.description }),
    origin: "manual",
    searchConfig: cloneProfile(profile.searchConfig),
    matchingPreferences: clonePreferences(profile.matchingPreferences),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Normalisiert eine Liste von Begriffen, ohne zusammenhaengende Begriffe zu
 * zerlegen ("Cloud Architecture" bleibt ein Begriff). Dedupe case-insensitiv.
 */
export function normalizeManualProfileTerms(terms: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of terms ?? []) {
    const cleaned = String(raw ?? "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

/**
 * Ein Begriff pro Zeile (mehrzeilige Eingabe). Zeilenumbrueche sind die
 * eindeutige Trennregel; Kommas und Leerzeichen bleiben Teil des Begriffs.
 */
export function parseManualProfileTermList(value: string): string[] {
  if (!value) return [];
  return normalizeManualProfileTerms(value.split(/\r?\n/));
}

export function formatManualProfileTermList(terms: readonly string[] | undefined): string {
  return normalizeManualProfileTerms(terms).join("\n");
}

export type ManualSearchProfileDraftError = "name" | "search";

/**
 * Formularvalidierung. Ein Suchprofil ohne Profilname sowie ohne Zielrolle
 * UND ohne Skills kann die bestehende Suche nicht bedienen
 * (`/api/jobs` braucht mindestens einen Suchbegriff).
 */
export function validateManualSearchProfileDraft(
  draft: ManualSearchProfileDraft
): ManualSearchProfileDraftError | null {
  if (!draft.name.trim()) return "name";
  const hasKeywords = (draft.searchConfig.skills ?? "").trim().length > 0;
  const hasRoles = (draft.searchConfig.targetRoles ?? []).length > 0;
  if (!hasKeywords && !hasRoles) return "search";
  return null;
}

function defaultCreateId(): string {
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Legt ein neues manuelles Suchprofil aus einer Formulareingabe an. */
export function createManualSearchProfile(
  draft: ManualSearchProfileDraft,
  options: ManualSearchProfileRepositoryOptions = {}
): ManualSearchProfile {
  const nowIso = new Date(options.now?.() ?? Date.now()).toISOString();
  const id = (options.createId ?? defaultCreateId)();
  return {
    id,
    schemaVersion: MANUAL_SEARCH_PROFILE_SCHEMA_VERSION,
    name: draft.name.trim(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    origin: "manual",
    searchConfig: cloneProfile(draft.searchConfig),
    matchingPreferences: clonePreferences(draft.matchingPreferences),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Wendet eine Formulareingabe auf ein bestehendes Profil an.
 * `id` und `createdAt` bleiben stabil, `updatedAt` wird erneuert.
 */
export function applyManualSearchProfileDraft(
  existing: ManualSearchProfile,
  draft: ManualSearchProfileDraft,
  now: number = Date.now()
): ManualSearchProfile {
  return {
    ...cloneManualSearchProfile(existing),
    name: draft.name.trim(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : { description: undefined }),
    searchConfig: cloneProfile(draft.searchConfig),
    matchingPreferences: clonePreferences(draft.matchingPreferences),
    updatedAt: new Date(now).toISOString(),
  };
}

/** Dupliziert ein Profil mit neuer ID und neuen Zeitstempeln. */
export function duplicateManualSearchProfile(
  source: ManualSearchProfile,
  name?: string,
  options: ManualSearchProfileRepositoryOptions = {}
): ManualSearchProfile {
  const nowIso = new Date(options.now?.() ?? Date.now()).toISOString();
  const id = (options.createId ?? defaultCreateId)();
  return {
    ...cloneManualSearchProfile(source),
    id,
    name: (name ?? source.name).trim() || source.name,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * In-Memory-Repository fuer die laufende Sitzung.
 *
 * Bewusst kein localStorage/kein Backend: ein Reload beendet die Sammlung.
 * Die UI muss deshalb eindeutig "Fuer diese Sitzung speichern" kommunizieren.
 */
export function createManualSearchProfileRepository(
  options: ManualSearchProfileRepositoryOptions = {}
): ManualSearchProfileRepository {
  const records = new Map<string, ManualSearchProfile>();

  return {
    list(): ManualSearchProfile[] {
      // Neueste zuerst (updatedAt absteigend), defensive Kopien.
      return [...records.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(cloneManualSearchProfile);
    },

    get(id: string): ManualSearchProfile | null {
      const found = records.get(id);
      return found ? cloneManualSearchProfile(found) : null;
    },

    save(profile: ManualSearchProfile): ManualSearchProfile {
      const existing = records.get(profile.id);
      const next = cloneManualSearchProfile(profile);
      // `createdAt` und `id` sind unveraenderlich; ein Save darf sie nicht
      // ueberschreiben, auch wenn der Aufrufer andere Werte liefert.
      if (existing) next.createdAt = existing.createdAt;
      next.updatedAt = profile.updatedAt || new Date(options.now?.() ?? Date.now()).toISOString();
      records.set(next.id, next);
      return cloneManualSearchProfile(next);
    },

    delete(id: string): boolean {
      return records.delete(id);
    },
  };
}

/**
 * Deterministische Kriterienpruefung eines Stellenangebots gegen ein manuelles
 * Suchprofil.
 *
 * WICHTIG: Das ist NICHT das ATS-Matching. Es entstehen keine Prozentwerte und
 * keine Gewichtung; geprueft werden ausschliesslich harte Muss-Kriterien und
 * Ausschluesse auf Basis der vorhandenen Jobtexte.
 */
export type ManualProfileMatchStatus = "match" | "mismatch" | "unknown";

export interface ManualProfileMatchResult {
  status: ManualProfileMatchStatus;
  matchedRequired: string[];
  missingRequired: string[];
  preferredFound: string[];
  excludedFound: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jobHaystack(job: Job): string {
  return [
    job.title,
    ...(job.tags ?? []),
    job.descriptionPlain ?? "",
    job.description ?? "",
    ...(job.location ?? []),
    job.company_name,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

/**
 * Begriffssuche mit Randpruefung, damit "AWS" nicht in "AWSOME" trifft und
 * technische Begriffe wie "C++", "C#" oder ".NET" trotzdem gefunden werden.
 */
export function containsJobTerm(haystack: string, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return false;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegExp(needle)}([^\\p{L}\\p{N}_]|$)`,
    "u"
  );
  return pattern.test(haystack);
}

export function evaluateManualProfileMatch(
  profile: Pick<ManualSearchProfile, "matchingPreferences">,
  job: Job
): ManualProfileMatchResult {
  const haystack = jobHaystack(job);
  const required = normalizeManualProfileTerms(profile.matchingPreferences?.requiredSkills);
  const preferred = normalizeManualProfileTerms(profile.matchingPreferences?.preferredSkills);
  const excluded = normalizeManualProfileTerms(profile.matchingPreferences?.excludedTerms);

  if (!haystack.trim()) {
    return {
      status: "unknown",
      matchedRequired: [],
      missingRequired: [...required],
      preferredFound: [],
      excludedFound: [],
    };
  }

  const matchedRequired = required.filter((term) => containsJobTerm(haystack, term));
  const missingRequired = required.filter((term) => !matchedRequired.includes(term));
  const preferredFound = preferred.filter((term) => containsJobTerm(haystack, term));
  const excludedFound = excluded.filter((term) => containsJobTerm(haystack, term));

  if (excludedFound.length > 0 || missingRequired.length > 0) {
    return { status: "mismatch", matchedRequired, missingRequired, preferredFound, excludedFound };
  }

  return {
    status: required.length > 0 ? "match" : "unknown",
    matchedRequired,
    missingRequired,
    preferredFound,
    excludedFound,
  };
}

/** Suchkonfiguration fuer den bestehenden Suchpfad (defensive Kopie). */
export function toSearchProfile(profile: ManualSearchProfile): Profile {
  return cloneProfile(profile.searchConfig);
}
