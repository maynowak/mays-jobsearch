import { useEffect, useId, useRef, useState } from "react";
import { useLang } from "../i18n";
import type {
  ApplicationMigrationPortV1,
  ApplicationMigrationPreviewV1,
  ApplicationMigrationResultV1,
} from "../lib/applications/repositoryTypes";
import { ApplicationRepositoryError } from "../lib/applications/repositoryTypes";
import type { SessionApplicationV1 } from "../lib/applications/sessionApplications";

interface Props {
  open: boolean;
  applications: SessionApplicationV1[];
  port: Pick<ApplicationMigrationPortV1, "preview" | "commit">;
  onClose: () => void;
  onTransferred?: (result: ApplicationMigrationResultV1) => void;
}

function migrationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `migration-${crypto.randomUUID()}`;
  }
  return `migration-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ApplicationMigrationDialog({
  open,
  applications,
  port,
  onClose,
  onTransferred,
}: Props) {
  const { t } = useLang();
  const titleId = useId();
  const idempotencyKeyRef = useRef("");
  const [preview, setPreview] = useState<ApplicationMigrationPreviewV1 | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApplicationMigrationResultV1 | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    idempotencyKeyRef.current = migrationKey();
    setPreview(null);
    setSelected(new Set());
    setConfirmed(false);
    setBusy(true);
    setError("");
    setResult(null);
    const localIds = applications.map((application) => application.localId);
    port
      .preview({ localIds })
      .then((next) => {
        if (!active) return;
        setPreview(next);
        setSelected(
          new Set(next.items.filter((item) => item.status === "READY").map((item) => item.localId))
        );
      })
      .catch((err) => {
        if (!active) return;
        const code = err instanceof ApplicationRepositoryError ? err.code : "unavailable";
        setError(t(`applications.error.${code}`));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, port, applications.map((application) => application.localId).join(","), t]);

  if (!open) return null;

  const toggle = (localId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
    setConfirmed(false);
  };

  const commit = async () => {
    if (!selected.size || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      const next = await port.commit(
        { localIds: [...selected], confirmed: true },
        idempotencyKeyRef.current
      );
      setResult(next);
      onTransferred?.(next);
    } catch (err) {
      const code = err instanceof ApplicationRepositoryError ? err.code : "unavailable";
      setError(t(`applications.error.${code}`));
    } finally {
      setBusy(false);
    }
  };

  const statusKey = (status: string): string => {
    if (status === "INCOMPATIBLE") return "applications.migration.incompatible";
    if (status === "CONFLICT") return "applications.migration.duplicate";
    if (status === "TRANSFERRED") return "applications.migration.transferred";
    return "applications.migration.ready";
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>{t("applications.migration.title")}</h2>
        <p>{t("applications.migration.description")}</p>
        <p className="applications-migration-note">{t("applications.migration.mockNote")}</p>

        {busy && !preview ? <p>{t("applications.migration.preparing")}</p> : null}
        {error ? <p role="alert">{error}</p> : null}

        {preview ? (
          <ul className="applications-migration-list">
            {preview.items.map((item) => {
              const application = applications.find((entry) => entry.localId === item.localId);
              const disabled = item.status !== "READY";
              return (
                <li key={item.localId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(item.localId)}
                      disabled={disabled || busy}
                      onChange={() => toggle(item.localId)}
                    />
                    <span>{application?.job.title ?? item.localId}</span>
                  </label>
                  <span className="applications-migration-status">{t(statusKey(item.status))}</span>
                  {item.reasons.length ? (
                    <ul>
                      {item.reasons.map((reason) => (
                        <li key={reason}>
                          {t(`applications.migration.reasons.${reason}`)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <label className="applications-migration-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy || !selected.size}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{t("applications.migration.confirm")}</span>
        </label>

        {result ? (
          <p role="status">
            {t("applications.migration.result", {
              succeeded: String(result.succeeded.length),
              failed: String(result.failed.length),
            })}
          </p>
        ) : null}

        {!selected.size && preview && !busy ? (
          <p role="status">{t("applications.migration.noSelection")}</p>
        ) : null}

        <div className="applications-migration-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            {t("applications.migration.cancel")}
          </button>
          <button
            type="button"
            className="letter-btn"
            onClick={() => void commit()}
            disabled={busy || !confirmed || !selected.size}
          >
            {t("applications.migration.transfer")}
          </button>
        </div>
      </div>
    </div>
  );
}
