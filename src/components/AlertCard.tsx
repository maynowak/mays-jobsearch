import { useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "../types";
import { subscribeAlert, unsubscribeAlert } from "../api";
import { useLang } from "../i18n";

type AlertStatus = { type: "ok" | "err"; message: string } | null;

interface Props {
  profile: Profile;
}

export default function AlertCard({ profile }: Props) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AlertStatus>(null);
  const [busy, setBusy] = useState(false);

  const handleSubscribe = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus({ type: "err", message: t("alerts.needEmail") });
      return;
    }
    setBusy(true);
    try {
      const message = await subscribeAlert(trimmed, {
        skills: profile.skills,
        targetRole: profile.targetRole,
        city: profile.city,
      });
      setStatus({ type: "ok", message });
    } catch (err) {
      setStatus({ type: "err", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus({ type: "err", message: t("alerts.needEmailUnsub") });
      return;
    }
    setBusy(true);
    try {
      const message = await unsubscribeAlert(trimmed);
      setStatus({ type: "ok", message });
    } catch (err) {
      setStatus({ type: "err", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="alerts" className="card alert-card">
      <h2>{t("alerts.heading")}</h2>
      <p className="alert-hint">{t("alerts.hint")}</p>
      <form id="alert-form" onSubmit={handleSubscribe} noValidate>
        <div className="field">
          <label htmlFor="alert-email">{t("alerts.email")}</label>
          <input
            id="alert-email"
            type="email"
            placeholder={t("alerts.emailPh")}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button id="alert-btn" type="submit" disabled={busy}>
          {t("alerts.subscribe")}
        </button>
      </form>
      {status && <p className={`alert-status ${status.type}`}>{status.message}</p>}
      <button id="alert-unsub" type="button" className="btn-ghost" onClick={handleUnsubscribe} disabled={busy}>
        {t("alerts.cancel")}
      </button>
    </section>
  );
}