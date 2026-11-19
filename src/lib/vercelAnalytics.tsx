import { Analytics } from "@vercel/analytics/react";

/**
 * Vercel Web Analytics is deliberately disabled by default.
 *
 * Activation requires a build/deployment env opt-in plus privacy approval.
 * No custom events or CV/profile/application payloads are passed to Analytics.
 */
export function isVercelAnalyticsEnabled(): boolean {
  return import.meta.env.VITE_VERCEL_ANALYTICS_ENABLED === "true";
}

export function VercelAnalytics({ enabled = isVercelAnalyticsEnabled() }: { enabled?: boolean }) {
  return enabled ? <Analytics /> : null;
}
