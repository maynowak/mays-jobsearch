import { useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "../types";
import { subscribeAlert, unsubscribeAlert } from "../api";

type AlertStatus = { type: "ok" | "err"; message: string } | null;

interface Props {
  profile: Profile;
}

export default function AlertCard({ profile }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AlertStatus>(null);
  const [busy, setBusy] = useState(false);

  const handleSubscribe = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus({ type: "err", message: "Please enter your email address." });
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
      setStatus({ type: "err", message: "Enter your email to cancel the alert." });
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
    <section className="card alert-card">
      <h2>Daily job alerts</h2>
      <p className="alert-hint">
        Get an email every morning with new matches for your current search.
      </p>
      <form id="alert-form" onSubmit={handleSubscribe} noValidate>
        <div className="field">
          <label htmlFor="alert-email">Email</label>
          <input
            id="alert-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button id="alert-btn" type="submit" disabled={busy}>
          Subscribe to daily digest
        </button>
      </form>
      {status && <p className={`alert-status ${status.type}`}>{status.message}</p>}
      <button id="alert-unsub" type="button" className="btn-ghost" onClick={handleUnsubscribe} disabled={busy}>
        Cancel my alert
      </button>
    </section>
  );
}