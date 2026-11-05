// Remote ApplicationV1 mode is opt-in and restricted to an explicit list of
// synthetic test subjects. It must never be enabled for normal production users
// until the RIS privacy/consent and Jobsearch BFF gates are separately signed
// off.

export function risRemoteTestSubs(): string[] {
  return String(import.meta.env.VITE_RIS_REMOTE_TEST_SUBS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function risRemoteEnabledFor(sub: string | undefined | null): boolean {
  if (import.meta.env.VITE_RIS_APPLICATIONS_REMOTE !== "true") return false;
  if (!sub) return false;
  return risRemoteTestSubs().includes(sub);
}
