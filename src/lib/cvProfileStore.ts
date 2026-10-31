import type { Profile } from "../types";
import type { ATSCriteriaV1 } from "./profiles/contractTypes";

// CV-PROFILE-LISTS-01 + CV-PROFILE-LISTS-02 (Privacy):
// Benannte Profil-Listen pro CV (Suchprofile/ATS-Profile) — jetzt NUR im
// Speicher der laufenden Session (kein localStorage):
//  - Reload leert die Listen automatisch (kein Fremdnutzer-/Fehler-Fall).
//  - 12 Stunden nach der Verarbeitung eines CVs wird dessen Liste von selbst
//    geleert (Lazy-Purge bei jedem Zugriff) — auch bei offenem Browser.
// Schluessel weiterhin der Inhalts-Hash des anonymisierten CV-Textes.
// Es werden nur anonymisierte/bestaetigte Profildaten gehalten.

export const CV_LISTS_TTL_MS = 12 * 60 * 60 * 1000; // 12 Stunden

const LEGACY_STORE_PREFIX = "mj-cv-lists:"; // v1: localStorage (wird bereinigt)
const MAX_ENTRIES_PER_LIST = 50;

export interface CvSearchProfileEntry {
  id: string;
  name: string;
  savedAt: number;
  profile: Profile;
  description?: string;
}

export interface CvAtsProfileEntry {
  id: string;
  name: string;
  savedAt: number;
  targetRoles: string[];
  skills: string[];
  searchProfileId?: string | null;
  criteria?: ATSCriteriaV1;
}

export interface CvProfileLists {
  searchProfiles: CvSearchProfileEntry[];
  atsProfiles: CvAtsProfileEntry[];
}

interface CvListsBucket extends CvProfileLists {
  // Festes Fenster: wird bei der ersten Verarbeitung des CVs gesetzt und von
  // weiteren Saves NICHT verlaengert (vorhersehbarer Privacy-Ablauf).
  expiresAt: number;
}

const buckets = new Map<string, CvListsBucket>();

function emptyLists(): CvProfileLists {
  return { searchProfiles: [], atsProfiles: [] };
}

function generateEntryId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getBucket(hash: string, now: number): CvListsBucket | null {
  const bucket = buckets.get(hash);
  if (!bucket) return null;
  if (now > bucket.expiresAt) {
    buckets.delete(hash); // 12h-Fenster abgelaufen -> leeren
    return null;
  }
  return bucket;
}

function getOrCreateBucket(hash: string, now: number): CvListsBucket {
  return (
    getBucket(hash, now) ?? {
      expiresAt: now + CV_LISTS_TTL_MS,
      ...emptyLists(),
    }
  );
}

export function readCvProfileLists(
  hash: string | null | undefined,
  now: number = Date.now()
): CvProfileLists {
  if (!hash) return emptyLists();
  const bucket = getBucket(hash, now);
  return bucket
    ? { searchProfiles: bucket.searchProfiles, atsProfiles: bucket.atsProfiles }
    : emptyLists();
}

export function findSavedSearchProfile(
  lists: CvProfileLists | null | undefined,
  id: string | null | undefined
): CvSearchProfileEntry | null {
  if (!lists || !id) return null;
  return lists.searchProfiles.find((e) => e.id === id) ?? null;
}

export function saveCvSearchProfile(
  hash: string | null | undefined,
  name: string,
  profile: Profile,
  description?: string
): CvSearchProfileEntry | null {
  if (!hash) return null;
  const now = Date.now();
  const bucket = getOrCreateBucket(hash, now);
  const finalName = name.trim() || profile.targetRoles?.[0] || "Suchprofil";
  // CV-UPLOAD-UX-08: gleicher Name -> vorhandener Eintrag wird ueberschrieben
  // (ID bleibt stabil; der Eintrag wandert nach vorn).
  const existing = bucket.searchProfiles.find((e) => e.name === finalName);
  const entry: CvSearchProfileEntry = existing
    ? { ...existing, savedAt: now, profile, ...(description === undefined ? {} : { description }) }
    : { id: generateEntryId(), name: finalName, savedAt: now, profile, ...(description === undefined ? {} : { description }) };
  bucket.searchProfiles = [
    entry,
    ...bucket.searchProfiles.filter((e) => e.id !== entry.id),
  ].slice(0, MAX_ENTRIES_PER_LIST);
  buckets.set(hash, bucket);
  return entry;
}

export function saveCvAtsProfile(
  hash: string | null | undefined,
  name: string,
  skills: string[],
  targetRoles: string[],
  searchProfileId: string | null = null,
  criteria?: ATSCriteriaV1
): CvAtsProfileEntry | null {
  if (!hash) return null;
  const now = Date.now();
  const bucket = getOrCreateBucket(hash, now);
  const finalName = name.trim() || targetRoles[0] || skills[0] || "ATS-Profil";

  // Rule: Prevent accidental re-assignment of an already assigned profile
  const existing = bucket.atsProfiles.find((e) => e.name === finalName);
  if (existing && existing.searchProfileId !== null && existing.searchProfileId !== searchProfileId) {
    return null; // Block re-assignment via name-overwrite
  }

  // Rule: SearchProfile must actually exist in this CV context
  if (searchProfileId && !bucket.searchProfiles.some(sp => sp.id === searchProfileId)) {
    return null;
  }

  // Rule: Max 5 ATS profiles per search profile
  if (searchProfileId) {
    const assignedCount = bucket.atsProfiles.filter(e => e.searchProfileId === searchProfileId).length;
    const isChangingAssignment = existing && existing.searchProfileId !== searchProfileId;
    
    // If it's a new profile for this searchProfile, check cap
    if (!existing || isChangingAssignment) {
      if (assignedCount >= 5) return null;
    }
  }

  const entry: CvAtsProfileEntry = existing
    ? { ...existing, savedAt: now, skills, targetRoles, searchProfileId, ...(criteria ? { criteria } : {}) }
    : { id: generateEntryId(), name: finalName, savedAt: now, targetRoles, skills, searchProfileId, ...(criteria ? { criteria } : {}) };
  bucket.atsProfiles = [
    entry,
    ...bucket.atsProfiles.filter((e) => e.id !== entry.id),
  ].slice(0, MAX_ENTRIES_PER_LIST);
  buckets.set(hash, bucket);
  return entry;
}

/** Session adapter helpers: mutate only the existing hash bucket. */
export function updateCvSearchProfile(
  hash: string | null | undefined,
  id: string,
  name: string,
  profile: Profile,
  description?: string
): CvSearchProfileEntry | null {
  if (!hash) return null;
  const bucket = getBucket(hash, Date.now());
  const existing = bucket?.searchProfiles.find((entry) => entry.id === id);
  if (!bucket || !existing) return null;
  const updated = { ...existing, name: name.trim() || existing.name, savedAt: Date.now(), profile, ...(description === undefined ? {} : { description }) };
  bucket.searchProfiles = [updated, ...bucket.searchProfiles.filter((entry) => entry.id !== id)];
  buckets.set(hash, bucket);
  return updated;
}

export function deleteCvSearchProfile(hash: string | null | undefined, id: string): boolean {
  if (!hash) return false;
  const bucket = getBucket(hash, Date.now());
  if (!bucket || !bucket.searchProfiles.some((entry) => entry.id === id)) return false;
  bucket.searchProfiles = bucket.searchProfiles.filter((entry) => entry.id !== id);
  bucket.atsProfiles = bucket.atsProfiles.map((entry) =>
    entry.searchProfileId === id ? { ...entry, searchProfileId: null } : entry
  );
  buckets.set(hash, bucket);
  return true;
}

export function updateCvAtsProfile(
  hash: string | null | undefined,
  id: string,
  name: string,
  skills: string[],
  targetRoles: string[],
  searchProfileId: string | null,
  criteria?: ATSCriteriaV1
): CvAtsProfileEntry | null {
  if (!hash) return null;
  const bucket = getBucket(hash, Date.now());
  const existing = bucket?.atsProfiles.find((entry) => entry.id === id);
  if (!bucket || !existing) return null;
  if (searchProfileId && !bucket.searchProfiles.some((entry) => entry.id === searchProfileId)) return null;
  if (searchProfileId && existing.searchProfileId !== searchProfileId) {
    const assignedCount = bucket.atsProfiles.filter((entry) => entry.searchProfileId === searchProfileId).length;
    if (assignedCount >= 5) return null;
  }
  const updated = {
    ...existing,
    name: name.trim() || existing.name,
    skills: [...skills],
    targetRoles: [...targetRoles],
    searchProfileId,
    ...(criteria ? { criteria } : {}),
    savedAt: Date.now(),
  };
  bucket.atsProfiles = [updated, ...bucket.atsProfiles.filter((entry) => entry.id !== id)];
  buckets.set(hash, bucket);
  return updated;
}

export function deleteCvAtsProfile(hash: string | null | undefined, id: string): boolean {
  if (!hash) return false;
  const bucket = getBucket(hash, Date.now());
  if (!bucket || !bucket.atsProfiles.some((entry) => entry.id === id)) return false;
  bucket.atsProfiles = bucket.atsProfiles.filter((entry) => entry.id !== id);
  buckets.set(hash, bucket);
  return true;
}

// Leert alle Listen sofort (Tests + kuenftiger "Alles löschen"-Button).
export function resetCvProfileLists(): void {
  buckets.clear();
}

// Einmalige Bereinigung von Altlasten aus CV-PROFILE-LISTS-01 (v1 speicherte
// in localStorage). Laeuft beim App-Start; entfernt alle mj-cv-lists:*-Keys.
export function purgeLegacyCvListsFromLocalStorage(): number {
  let removed = 0;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LEGACY_STORE_PREFIX))
      .forEach((k) => {
        localStorage.removeItem(k);
        removed += 1;
      });
  } catch {
    /* noop */
  }
  return removed;
}

export function assignCvAtsProfileToSearchProfile(
  hash: string | null | undefined,
  atsId: string,
  searchProfileId: string | null
): boolean {
  if (!hash) return false;
  const now = Date.now();
  const bucket = getOrCreateBucket(hash, now);
  const entry = bucket.atsProfiles.find((e) => e.id === atsId);
  if (!entry) return false;

  // Rule: Idempotent assignment
  if (entry.searchProfileId === searchProfileId) return true;

  // Rule: SearchProfile must actually exist in this CV context
  if (searchProfileId && !bucket.searchProfiles.some(sp => sp.id === searchProfileId)) {
    return false;
  }

  // Rule: Max 5 ATS profiles per search profile (for new assignment)
  if (searchProfileId) {
    const assignedCount = bucket.atsProfiles.filter(e => e.searchProfileId === searchProfileId).length;
    if (assignedCount >= 5) return false;
  }

  entry.searchProfileId = searchProfileId;
  buckets.set(hash, bucket);
  return true;
}

export function updateCvAtsProfileSkills(
  hash: string | null | undefined,
  atsId: string,
  searchProfileId: string | null,
  newSkills: string[]
): boolean {
  if (!hash) return false;
  const now = Date.now();
  const bucket = getOrCreateBucket(hash, now);
  const entryIndex = bucket.atsProfiles.findIndex((e) => e.id === atsId);
  if (entryIndex === -1) return false;

  // Rule: Must belong to the provided searchProfileId (Integrity)
  const existingEntry = bucket.atsProfiles[entryIndex];
  if (existingEntry.searchProfileId !== searchProfileId) return false;

  // Rule: SearchProfile must exist in this context
  if (searchProfileId && !bucket.searchProfiles.some(sp => sp.id === searchProfileId)) {
    return false;
  }

  // Rule: Idempotent update - only save if skills actually changed
  const sortedCurrent = [...(existingEntry.skills || [])].sort().join(",");
  const sortedNew = [...newSkills].sort().join(",");
  if (sortedCurrent === sortedNew) return true;

  // Create new entry to preserve reference semantics (avoid React re-render issues)
  const newEntry: CvAtsProfileEntry = {
    ...existingEntry,
    skills: [...newSkills],
    savedAt: now,
  };
  bucket.atsProfiles[entryIndex] = newEntry;
  buckets.set(hash, bucket);
  return true;
}

export function resolveSearchProfileFromAtsProfile(
  hash: string | null | undefined,
  atsProfileId: string | null | undefined
): CvSearchProfileEntry | null {
  if (!hash || !atsProfileId) return null;
  const lists = readCvProfileLists(hash);
  const atsEntry = lists.atsProfiles.find(e => e.id === atsProfileId);
  if (!atsEntry || !atsEntry.searchProfileId) return null;
  return findSavedSearchProfile(lists, atsEntry.searchProfileId);
}
