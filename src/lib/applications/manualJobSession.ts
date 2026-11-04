import type { Job } from "../../types";
import type { ApplicationJobReferenceV1 } from "./contractTypes";

/**
 * Session-only manual-job context. It is deliberately memory-only and keyed by
 * the stable manual job ID so the form and LetterModal can share the exact
 * description without putting it into ApplicationV1 or any browser storage.
 */
export interface ManualJobSessionEntry {
  id: string;
  job: Job;
  reference: ApplicationJobReferenceV1;
  updatedAt: string;
}

const entries = new Map<string, ManualJobSessionEntry>();
let generation = 0;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Invalidate all manual-job context when the auth/session identity changes. */
export function beginNewManualJobSession(): number {
  generation += 1;
  entries.clear();
  return generation;
}

export function currentManualJobSessionGeneration(): number {
  return generation;
}

export function saveManualJobSession(entry: ManualJobSessionEntry): void {
  entries.set(entry.id, clone(entry));
}

export function getManualJobSession(id: string): ManualJobSessionEntry | null {
  const entry = entries.get(id);
  return entry ? clone(entry) : null;
}

export function clearManualJobSession(): void {
  entries.clear();
}
