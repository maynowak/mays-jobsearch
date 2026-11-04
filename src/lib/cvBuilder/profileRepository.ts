import { createEmptyCvBuilderDraft } from "./contractTypes";
import type { CvBuilderTemplate } from "./templates";
import {
  CV_BUILDER_PROFILE_SCHEMA_VERSION,
  CvBuilderProfileError,
  cloneCvBuilderDraft,
  cloneCvBuilderProfile,
  createCvBuilderProfileId,
  validateCvBuilderProfile,
  validateCvBuilderProfileName,
  validateCvBuilderTemplate,
  type CvBuilderProfileV1,
} from "./profileTypes";

let activeGeneration = 0;

export function beginNewCvBuilderSession(): number {
  activeGeneration += 1;
  return activeGeneration;
}

export function currentCvBuilderSessionGeneration(): number {
  return activeGeneration;
}

export interface CvBuilderProfileCreateInput {
  name: string;
  cvData?: CvBuilderProfileV1["cvData"];
  template?: CvBuilderTemplate;
}

export interface CvBuilderProfileUpdateInput {
  name?: string;
  cvData?: CvBuilderProfileV1["cvData"];
  template?: CvBuilderTemplate;
}

export interface CvBuilderProfileRepository {
  list(): CvBuilderProfileV1[];
  get(cvId: string): CvBuilderProfileV1 | null;
  create(input: CvBuilderProfileCreateInput): CvBuilderProfileV1;
  update(
    cvId: string,
    expectedVersion: number,
    changes: CvBuilderProfileUpdateInput
  ): CvBuilderProfileV1;
  rename(cvId: string, expectedVersion: number, name: string): CvBuilderProfileV1;
  duplicate(
    cvId: string,
    expectedVersion: number,
    name?: string
  ): CvBuilderProfileV1;
  delete(cvId: string, expectedVersion: number): { deleted: true };
  clear(): void;
  invalidate(): void;
}

export interface CvBuilderProfileRepositoryOptions {
  initial?: CvBuilderProfileV1[];
  idFactory?: () => string;
  now?: () => string;
}

function nowIso(now: () => string): string {
  const value = now();
  if (!Number.isFinite(Date.parse(value))) {
    throw new CvBuilderProfileError("Invalid repository timestamp");
  }
  return value;
}

function assertVersion(profile: CvBuilderProfileV1, expectedVersion: number): void {
  if (!Number.isInteger(expectedVersion) || expectedVersion !== profile.version) {
    throw new CvBuilderProfileError(
      "The CV profile changed in the meantime",
      "version_conflict"
    );
  }
}

export function createCvBuilderProfileRepository(
  options: CvBuilderProfileRepositoryOptions = {}
): CvBuilderProfileRepository {
  const generation = activeGeneration;
  const idFactory = options.idFactory ?? createCvBuilderProfileId;
  const now = options.now ?? (() => new Date().toISOString());
  let invalidated = false;
  let profiles = (options.initial ?? []).map(cloneCvBuilderProfile);

  const assertActive = (): void => {
    if (invalidated || generation !== activeGeneration) {
      throw new CvBuilderProfileError(
        "The CV builder session has ended",
        "session_ended"
      );
    }
  };

  const find = (cvId: string): CvBuilderProfileV1 => {
    assertActive();
    const profile = profiles.find((entry) => entry.cvId === cvId);
    if (!profile) {
      throw new CvBuilderProfileError("CV profile was not found", "not_found");
    }
    return profile;
  };

  const replace = (updated: CvBuilderProfileV1): CvBuilderProfileV1 => {
    profiles = profiles.map((entry) =>
      entry.cvId === updated.cvId ? updated : entry
    );
    return cloneCvBuilderProfile(updated);
  };

  const updateProfile = (
    cvId: string,
    expectedVersion: number,
    changes: CvBuilderProfileUpdateInput
  ): CvBuilderProfileV1 => {
    assertActive();
    const current = find(cvId);
    assertVersion(current, expectedVersion);
    const name = changes.name === undefined
      ? current.name
      : validateCvBuilderProfileName(changes.name);
    const template = changes.template === undefined
      ? current.template
      : validateCvBuilderTemplate(changes.template);
    const cvData = changes.cvData === undefined
      ? cloneCvBuilderDraft(current.cvData)
      : cloneCvBuilderDraft(changes.cvData);
    const updated: CvBuilderProfileV1 = {
      ...current,
      name,
      template,
      cvData,
      updatedAt: nowIso(now),
      version: current.version + 1,
    };
    validateCvBuilderProfile(updated);
    return replace(updated);
  };

  return {
    list(): CvBuilderProfileV1[] {
      assertActive();
      return profiles.map(cloneCvBuilderProfile);
    },

    get(cvId: string): CvBuilderProfileV1 | null {
      assertActive();
      const profile = profiles.find((entry) => entry.cvId === cvId);
      return profile ? cloneCvBuilderProfile(profile) : null;
    },

    create(input: CvBuilderProfileCreateInput): CvBuilderProfileV1 {
      assertActive();
      const name = validateCvBuilderProfileName(input.name);
      const template = validateCvBuilderTemplate(input.template ?? "classic");
      const cvData = cloneCvBuilderDraft(
        input.cvData ?? createEmptyCvBuilderDraft()
      );
      const cvId = idFactory();
      if (profiles.some((entry) => entry.cvId === cvId)) {
        throw new CvBuilderProfileError("CV id already exists", "id_conflict");
      }
      const timestamp = nowIso(now);
      const profile: CvBuilderProfileV1 = {
        schemaVersion: CV_BUILDER_PROFILE_SCHEMA_VERSION,
        cvId,
        name,
        cvData,
        template,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      };
      validateCvBuilderProfile(profile);
      profiles = [...profiles, profile];
      return cloneCvBuilderProfile(profile);
    },

    update: updateProfile,

    rename(cvId: string, expectedVersion: number, name: string): CvBuilderProfileV1 {
      return updateProfile(cvId, expectedVersion, { name });
    },

    duplicate(
      cvId: string,
      expectedVersion: number,
      name?: string
    ): CvBuilderProfileV1 {
      assertActive();
      const source = find(cvId);
      assertVersion(source, expectedVersion);
      const duplicateName = validateCvBuilderProfileName(
        name ?? `${source.name} (Kopie)`
      );
      const newId = idFactory();
      if (profiles.some((entry) => entry.cvId === newId)) {
        throw new CvBuilderProfileError("CV id already exists", "id_conflict");
      }
      const timestamp = nowIso(now);
      const duplicate: CvBuilderProfileV1 = {
        schemaVersion: CV_BUILDER_PROFILE_SCHEMA_VERSION,
        cvId: newId,
        name: duplicateName,
        cvData: cloneCvBuilderDraft(source.cvData),
        template: source.template,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      };
      validateCvBuilderProfile(duplicate);
      profiles = [...profiles, duplicate];
      return cloneCvBuilderProfile(duplicate);
    },

    delete(cvId: string, expectedVersion: number): { deleted: true } {
      assertActive();
      const current = find(cvId);
      assertVersion(current, expectedVersion);
      profiles = profiles.filter((entry) => entry.cvId !== cvId);
      return { deleted: true };
    },

    clear(): void {
      assertActive();
      profiles = [];
    },

    invalidate(): void {
      invalidated = true;
      profiles = [];
    },
  };
}
