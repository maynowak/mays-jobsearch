import type { Profile } from "../types";

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
}

export interface CvAtsProfileEntry {
  id: string;
  name: string;
  savedAt: number;
  targetRole: string;
  skills: string[];
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

export function saveCvSearchProfile(
  hash: string | null | undefined,
  name: string,
  profile: Profile
): CvSearchProfileEntry | null {
  if (!hash) return null;
  const now = Date.now();
  const bucket = getOrCreateBucket(hash, now);
  const finalName = name.trim() || profile.targetRole || "Suchprofil";
  // CV-UPLOAD-UX-08: gleicher Name -> vorhandener Eintrag wird ueberschrieben
  // (ID bleibt stabil; der Eintrag wandert nach vorn).
  const existing = bucket.searchProfiles.find((e) => e.name === finalName);
  const entry: CvSearchProfileEntry = existing
    ? { ...existing, savedAt: now, profile }
    : { id: generateEntryId(), name: finalName, savedAt: now, profile };
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
  targetRole: string
): CvAtsProfileEntry | null {
  if (!hash) return null;
  const now = Date.now();
  const bucket = getOrCreateBucket(hash, now);
  const finalName = name.trim() || skills[0] || "ATS-Profil";
  // CV-UPLOAD-UX-08: Ueberschreiben bei gleichem Namen (wie Suchprofile)
  const existing = bucket.atsProfiles.find((e) => e.name === finalName);
  const entry: CvAtsProfileEntry = existing
    ? { ...existing, savedAt: now, skills, targetRole }
    : { id: generateEntryId(), name: finalName, savedAt: now, targetRole, skills };
  bucket.atsProfiles = [
    entry,
    ...bucket.atsProfiles.filter((e) => e.id !== entry.id),
  ].slice(0, MAX_ENTRIES_PER_LIST);
  buckets.set(hash, bucket);
  return entry;
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
