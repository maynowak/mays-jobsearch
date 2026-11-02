import { useState } from "react";
import { useLang } from "../i18n";
import type { ApplicationChannel, ApplicationSalaryV1, SalaryPeriod } from "../lib/applications/contractTypes";
import type {
  SessionApplicationUpdateChanges,
  SessionApplicationV1,
  SessionSalaryUpdate,
} from "../lib/applications/sessionApplications";

interface Props {
  application: SessionApplicationV1;
  busy: boolean;
  error: string;
  onSave: (changes: SessionApplicationUpdateChanges) => void;
  onCancel: () => void;
}

interface EditDraft {
  applicationChannel: "" | ApplicationChannel;
  applicationDate: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  expectationAmount: string;
  expectationCurrency: string;
  expectationPeriod: SalaryPeriod;
  offerAmount: string;
  offerCurrency: string;
  offerPeriod: SalaryPeriod;
}

const CHANNELS: readonly ApplicationChannel[] = ["online", "email", "portal", "postal", "other"];
const PERIODS: readonly SalaryPeriod[] = ["year", "month", "hour"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function salaryAmount(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function dateInputValue(value: string | undefined): string {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function draftFromApplication(application: SessionApplicationV1): EditDraft {
  return {
    applicationChannel: application.applicationChannel ?? "",
    applicationDate: dateInputValue(application.applicationDate),
    contactName: application.contact?.name ?? "",
    contactEmail: application.contact?.email ?? "",
    contactPhone: application.contact?.phone ?? "",
    notes: application.notes ?? "",
    expectationAmount: salaryAmount(application.salary?.expectation?.amount),
    expectationCurrency: application.salary?.expectation?.currency ?? "EUR",
    expectationPeriod: application.salary?.expectation?.period ?? "year",
    offerAmount: salaryAmount(application.salary?.offer?.amount),
    offerCurrency: application.salary?.offer?.currency ?? "EUR",
    offerPeriod: application.salary?.offer?.period ?? "year",
  };
}

function parseSalary(
  amount: string,
  currency: string,
  period: SalaryPeriod,
  t: (key: string) => string
): ApplicationSalaryV1 | null {
  const text = amount.trim().replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(t("applications.edit.invalidAmount"));
  }
  const code = currency.trim().toUpperCase() || "EUR";
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error(t("applications.edit.invalidCurrency"));
  }
  if (!PERIODS.includes(period)) {
    throw new Error(t("applications.edit.invalidSalary"));
  }
  return { amount: parsed, currency: code, period };
}

function parseDate(value: string, t: (key: string) => string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(t("applications.edit.invalidDate"));
  }
  return parsed.toISOString();
}

function buildChanges(draft: EditDraft, t: (key: string) => string): SessionApplicationUpdateChanges {
  const email = draft.contactEmail.trim();
  if (email && !EMAIL_RE.test(email)) {
    throw new Error(t("applications.edit.invalidEmail"));
  }
  if (/[\u0000-\u001f\u007f]/.test(draft.contactPhone)) {
    throw new Error(t("applications.edit.invalidPhone"));
  }

  const name = draft.contactName.trim();
  const phone = draft.contactPhone.trim();
  const contact =
    name || email || phone
      ? {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
        }
      : null;

  const expectation = parseSalary(
    draft.expectationAmount,
    draft.expectationCurrency,
    draft.expectationPeriod,
    t
  );
  const offer = parseSalary(draft.offerAmount, draft.offerCurrency, draft.offerPeriod, t);
  const salary: SessionSalaryUpdate = { expectation, offer };

  return {
    applicationChannel: draft.applicationChannel || null,
    applicationDate: parseDate(draft.applicationDate, t),
    contact,
    notes: draft.notes.trim() ? draft.notes : "",
    salary,
  };
}

export default function ApplicationEditForm({ application, busy, error, onSave, onCancel }: Props) {
  const { t } = useLang();
  const [draft, setDraft] = useState<EditDraft>(() => draftFromApplication(application));
  const [localError, setLocalError] = useState("");

  const update = <K extends keyof EditDraft>(field: K, value: EditDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setLocalError("");
    try {
      onSave(buildChanges(draft, t));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t("applications.edit.invalid"));
    }
  };

  const visibleError = localError || error;

  return (
    <form
      className="applications-edit"
      onSubmit={submit}
      noValidate
      aria-label={t("applications.edit.title")}
    >
      <div className="applications-edit__grid">
        <section className="applications-edit__section">
          <h4>{t("applications.section.application")}</h4>
          <label className="letter-field">
            <span>{t("applications.channel")}</span>
            <select
              value={draft.applicationChannel}
              onChange={(event) =>
                update("applicationChannel", event.target.value as "" | ApplicationChannel)
              }
            >
              <option value="">{t("applications.edit.noChannel")}</option>
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {t(`applications.channel.${channel}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="letter-field">
            <span>{t("applications.edit.applicationDate")}</span>
            <input
              type="date"
              value={draft.applicationDate}
              onChange={(event) => update("applicationDate", event.target.value)}
            />
          </label>
        </section>

        <section className="applications-edit__section">
          <h4>{t("applications.contact")}</h4>
          <label className="letter-field">
            <span>{t("applications.edit.contactName")}</span>
            <input
              value={draft.contactName}
              onChange={(event) => update("contactName", event.target.value)}
              maxLength={500}
            />
          </label>
          <label className="letter-field">
            <span>{t("applications.edit.contactEmail")}</span>
            <input
              type="email"
              value={draft.contactEmail}
              onChange={(event) => update("contactEmail", event.target.value)}
              maxLength={500}
            />
          </label>
          <label className="letter-field">
            <span>{t("applications.edit.contactPhone")}</span>
            <input
              type="tel"
              value={draft.contactPhone}
              onChange={(event) => update("contactPhone", event.target.value)}
              maxLength={500}
            />
          </label>
        </section>
      </div>

      <section className="applications-edit__section">
        <h4>{t("applications.section.salary")}</h4>
        <div className="applications-edit__salary">
          <SalaryFields
            label={t("applications.expectation")}
            amount={draft.expectationAmount}
            currency={draft.expectationCurrency}
            period={draft.expectationPeriod}
            onAmount={(value) => update("expectationAmount", value)}
            onCurrency={(value) => update("expectationCurrency", value)}
            onPeriod={(value) => update("expectationPeriod", value)}
            t={t}
          />
          <SalaryFields
            label={t("applications.offer")}
            amount={draft.offerAmount}
            currency={draft.offerCurrency}
            period={draft.offerPeriod}
            onAmount={(value) => update("offerAmount", value)}
            onCurrency={(value) => update("offerCurrency", value)}
            onPeriod={(value) => update("offerPeriod", value)}
            t={t}
          />
        </div>
      </section>

      <section className="applications-edit__section">
        <h4>{t("applications.notes")}</h4>
        <label className="letter-field">
          <span>{t("applications.edit.notesLabel")}</span>
          <textarea
            value={draft.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={4}
            maxLength={10000}
          />
        </label>
        <p className="letter-hint">{t("applications.edit.notesHint")}</p>
      </section>

      {visibleError && (
        <p className="letter-review-warning" role="alert">
          {visibleError}
        </p>
      )}

      <div className="applications-edit__actions">
        <button type="submit" className="letter-btn" disabled={busy}>
          {t("applications.edit.save")}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          {t("applications.cancel")}
        </button>
      </div>
    </form>
  );
}

function SalaryFields({
  label,
  amount,
  currency,
  period,
  onAmount,
  onCurrency,
  onPeriod,
  t,
}: {
  label: string;
  amount: string;
  currency: string;
  period: SalaryPeriod;
  onAmount: (value: string) => void;
  onCurrency: (value: string) => void;
  onPeriod: (value: SalaryPeriod) => void;
  t: (key: string) => string;
}) {
  return (
    <fieldset className="applications-edit__salary-group">
      <legend>{label}</legend>
      <div className="applications-edit__salary-row">
        <label className="letter-field">
          <span>{t("applications.edit.amount")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => onAmount(event.target.value)}
            aria-label={`${label} ${t("applications.edit.amount")}`}
          />
        </label>
        <label className="letter-field">
          <span>{t("applications.edit.currency")}</span>
          <input
            value={currency}
            onChange={(event) => onCurrency(event.target.value.toUpperCase())}
            maxLength={3}
            aria-label={`${label} ${t("applications.edit.currency")}`}
          />
        </label>
        <label className="letter-field">
          <span>{t("applications.edit.period")}</span>
          <select
            value={period}
            onChange={(event) => onPeriod(event.target.value as SalaryPeriod)}
            aria-label={`${label} ${t("applications.edit.period")}`}
          >
            {PERIODS.map((value) => (
              <option key={value} value={value}>
                {t(`applications.period.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
