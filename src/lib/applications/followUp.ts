import type { ApplicationFollowUpV1 } from "./contractTypes";

export type FollowUpViewState = "completed" | "overdue" | "today" | "scheduled";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function localCalendarDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function daysFromToday(dueOn: string): number {
  const due = Date.parse(`${dueOn}T00:00:00.000Z`);
  const today = Date.parse(`${localCalendarDate()}T00:00:00.000Z`);
  return Math.round((due - today) / 86_400_000);
}

export function getFollowUpViewState(followUp: ApplicationFollowUpV1): FollowUpViewState {
  if (followUp.status === "completed") return "completed";
  const days = daysFromToday(followUp.dueOn);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "scheduled";
}

export function formatFollowUpDue(dueOn: string, locale: string): string {
  const date = new Date(`${dueOn}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function followUpShortLabel(
  followUp: ApplicationFollowUpV1,
  locale: string,
  t: Translate
): string {
  if (followUp.status === "completed") return t("applications.followUp.completed");
  const days = daysFromToday(followUp.dueOn);
  if (days < 0) {
    return days === -1
      ? t("applications.followUp.overdueOne")
      : t("applications.followUp.overdueMany", { count: Math.abs(days) });
  }
  if (days === 0) return t("applications.followUp.dueToday");
  return t("applications.followUp.dueOn", { date: formatFollowUpDue(followUp.dueOn, locale) });
}

export function followUpSummaryLabel(
  followUp: ApplicationFollowUpV1,
  locale: string,
  t: Translate
): string {
  if (followUp.status === "completed") return t("applications.followUp.completed");
  const days = daysFromToday(followUp.dueOn);
  if (days < 0) {
    return days === -1
      ? t("applications.followUp.overdueOne")
      : t("applications.followUp.overdueMany", { count: Math.abs(days) });
  }
  if (days === 0) return t("applications.followUp.dueToday");
  return formatFollowUpDue(followUp.dueOn, locale);
}
