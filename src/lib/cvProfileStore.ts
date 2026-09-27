import type { Profile } from "../types";

// CV-PROFILE-LISTS-01: Benannte Profil-Listen pro CV.
// Speicherung clientseitig (localStorage), Schluessel = SHA-256-Hash des
// anonymisierten/normalisierten CV-Textes (stabile Zuordnung ueber Sessions;
// Dokument-IDs sind fluechtig). Es werden nur bereits anonymisierte/
// bestaetigte Profildaten gespeichert — keine CV-Datei, kein Rohtext.

const STORE_PREFIX = "mj-cv-lists:";
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

function emptyLists(): CvProfileLists {
  return { searchProfiles: [], atsProfiles: [] };
}

function generateEntryId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function readCvProfileLists(hash: string | null | undefined): CvProfileLists {
  if (!hash) return emptyLists();
  try {
    const raw = localStorage.getItem(`${STORE_PREFIX}${hash}`);
    if (!raw) return emptyLists();
    const parsed = JSON.parse(raw) as Partial<CvProfileLists>;
    return {
      searchProfiles: Array.isArray(parsed.searchProfiles) ? parsed.searchProfiles : [],
      atsProfiles: Array.isArray(parsed.atsProfiles) ? parsed.atsProfiles : [],
    };
  } catch {
    return emptyLists();
  }
}

function writeLists(hash: string, lists: CvProfileLists): void {
  try {
    localStorage.setItem(`${STORE_PREFIX}${hash}`, JSON.stringify(lists));
  } catch {
    /* noop — Speicher voll o. ae.: Speichern ist optional, der Flow laeuft weiter */
  }
}

export function saveCvSearchProfile(
  hash: string | null | undefined,
  name: string,
  profile: Profile
): CvSearchProfileEntry | null {
  if (!hash) return null;
  const lists = readCvProfileLists(hash);
  const entry: CvSearchProfileEntry = {
    id: generateEntryId(),
    name: name.trim() || profile.targetRole || "Suchprofil",
    savedAt: Date.now(),
    profile,
  };
  lists.searchProfiles = [entry, ...lists.searchProfiles].slice(0, MAX_ENTRIES_PER_LIST);
  writeLists(hash, lists);
  return entry;
}

export function saveCvAtsProfile(
  hash: string | null | undefined,
  name: string,
  skills: string[],
  targetRole: string
): CvAtsProfileEntry | null {
  if (!hash) return null;
  const lists = readCvProfileLists(hash);
  const entry: CvAtsProfileEntry = {
    id: generateEntryId(),
    name: name.trim() || skills[0] || "ATS-Profil",
    savedAt: Date.now(),
    targetRole,
    skills,
  };
  lists.atsProfiles = [entry, ...lists.atsProfiles].slice(0, MAX_ENTRIES_PER_LIST);
  writeLists(hash, lists);
  return entry;
}
