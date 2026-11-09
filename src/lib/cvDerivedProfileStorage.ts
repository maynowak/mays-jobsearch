export type DerivedProfileStorageChoice = "session" | "persistent";

export type ProfileStorageUnavailableReason = "durable-cv" | "consent";

/** Persistent writes require both a durable RIS cvId and the separate consent. */
export function profileStorageUnavailableReason(
  risCvId: string | undefined,
  persistentActive: boolean
): ProfileStorageUnavailableReason | null {
  if (!risCvId) return "durable-cv";
  if (!persistentActive) return "consent";
  return null;
}

/** An ATS profile may only hang under a durable search profile of this CV. */
export function isDurableAtsParentValid(
  parentId: string,
  durableSearchProfileIds: readonly string[]
): boolean {
  return parentId.trim().length > 0 && durableSearchProfileIds.includes(parentId);
}
