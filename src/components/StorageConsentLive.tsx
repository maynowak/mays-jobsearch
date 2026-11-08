import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import {
  RisConsentApiError,
  fetchRisConsent,
  fetchRisConsentHistory,
  grantRisConsent,
  withdrawRisConsent,
  type RisConsent,
  type RisConsentStatus,
} from "../lib/risConsentApi";
import {
  APPLICATION_STORAGE_CONSENT_PARAGRAPHS,
  APPLICATION_STORAGE_CONSENT_RIS_NOTICE_VERSION,
  APPLICATION_STORAGE_CONSENT_STATE,
  APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
  APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
} from "../lib/applicationStorageConsent";

export interface StorageConsentLiveState {
  status: RisConsentStatus;
  loaded: boolean;
  error: boolean;
}

interface Props {
  /**
   * Lets the parent surface the same server-side status in the summary card
   * and storage categories without duplicating the consent request.
   */
  onStateChange?: (state: StorageConsentLiveState) => void;
}

/**
 * Live consent controls backed by the RIS consent service through the BFF.
 * Rendered only when VITE_RIS_CONSENT_UI_ENABLED=true and the identity is
 * verified, so the preparation-mode markup stays the default.
 */
export default function StorageConsentLive({ onStateChange }: Props = {}) {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";
  const [consent, setConsent] = useState<RisConsent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [grantAllowed, setGrantAllowed] = useState(false);
  const [noticeVersion, setNoticeVersion] = useState<string | null>(null);
  const [noticeState, setNoticeState] = useState<string | null>(null);
  const [noticeReason, setNoticeReason] = useState<string | null>(null);
  const [textVersion, setTextVersion] = useState<string | null>(null);
  const [textHash, setTextHash] = useState<string | null>(null);
  const [textState, setTextState] = useState<string | null>(null);
  const [textMapped, setTextMapped] = useState(false);
  const [textApproved, setTextApproved] = useState(false);
  const [textReason, setTextReason] = useState<string | null>(null);
  const [specialCategoriesConsent, setSpecialCategoriesConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>> | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoaded(false);
    setError(null);
    fetchRisConsent(token)
      .then((state) => {
        if (!active) return;
        setConsent(state.consent);
        setGrantAllowed(state.grantAllowed);
        setNoticeVersion(state.noticeVersion);
        setNoticeState(state.noticeState);
        setNoticeReason(state.noticeReason);
        setTextVersion(state.textVersion);
        setTextHash(state.textHash);
        setTextState(state.textState);
        setTextMapped(state.textMapped);
        setTextApproved(state.textApproved);
        setTextReason(state.textReason);
        setLoaded(true);
      })
      .catch((err) => {
        if (!active) return;
        setError(messageOf(err));
        setLoaded(true);
      });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    onStateChange?.({
      status: consent?.status ?? "NOT_GRANTED",
      loaded,
      error: error !== null,
    });
  }, [consent?.status, error, loaded, onStateChange]);

  useEffect(() => {
    setSpecialCategoriesConsent(false);
  }, [token]);

  /**
   * A withdrawal revokes the Art. 9 declaration as well. Clear the checkbox so a
   * regrant in the same mounted UI requires a fresh, explicit check. The
   * initial load and the NOT_GRANTED -> GRANTED grant flow are unaffected
   * because they never transition into WITHDRAWN.
   */
  useEffect(() => {
    if (consent?.status === "WITHDRAWN") setSpecialCategoriesConsent(false);
  }, [consent?.status]);

  const run = async (action: () => Promise<RisConsent>) => {
    setBusy(true);
    setError(null);
    try {
      setConsent(await action());
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const status = consent?.status ?? "NOT_GRANTED";
  const textMappingMatches =
    textVersion === APPLICATION_STORAGE_CONSENT_TEXT_VERSION &&
    textHash === APPLICATION_STORAGE_CONSENT_TEXT_SHA256;
  const textServerApproved = textMapped && textApproved && textState === "APPROVED";
  const textBlocked = !grantAllowed || !textMappingMatches || !textServerApproved;
  const art9Missing = !specialCategoriesConsent;
  const canGrant = !textBlocked && !art9Missing && status !== "GRANTED";
  const version = consent?.noticeVersion ?? noticeVersion;
  const shortHash = `${APPLICATION_STORAGE_CONSENT_TEXT_SHA256.slice(0, 12)}…${APPLICATION_STORAGE_CONSENT_TEXT_SHA256.slice(-8)}`;
  const proofVersion = consent?.externalTextVersion ?? null;
  const proofHash = consent?.externalTextSha256 ?? null;
  const proofCategories = consent?.specialCategories ?? [];
  const proofConsent = consent?.specialCategoriesConsent === true;

  return (
    <section className="storage-consent__block" aria-labelledby="storage-consent-live-title">
      <h3 id="storage-consent-live-title">Speicherung von Bewerbungen</h3>
      <p role="status">
        Status: <strong>{label(status)}</strong>
        {version ? ` (Textversion ${version})` : ""}
      </p>
      {error && <p role="alert">{error}</p>}
      {status !== "GRANTED" && textBlocked && (
        <p className="field-hint" role="note">
          Die Einwilligungs-Textversion ist noch nicht freigegeben. Die Zustimmung ist gesperrt.
          {noticeState ? ` RIS-Status: ${stateLabel(noticeState)} (${noticeState}).` : ""}
          {noticeReason ? ` ${reasonOf(noticeReason)}` : ""}
          {!textMappingMatches
            ? " Die angezeigte Textfassung stimmt nicht mit der serverseitigen Zuordnung überein."
            : ""}
          {textReason ? ` ${textReasonOf(textReason)}` : ""}
        </p>
      )}
      {status !== "GRANTED" && !textBlocked && art9Missing && (
        <p className="field-hint" role="note">
          Bitte bestätige die Art.-9-Einwilligung ausdrücklich, um die Speicherung zu aktivieren.
        </p>
      )}
      <p className="field-hint">
        <a href="/datenschutz">Datenschutzhinweise zur Bewerbungsspeicherung</a>
        {version ? ` · RIS-Textversion: ${version}` : ""}
        {` · RIS-Notice: ${APPLICATION_STORAGE_CONSENT_RIS_NOTICE_VERSION}`}
      </p>

      <div
        className="storage-consent__declaration"
        aria-labelledby="storage-consent-declaration-title"
      >
        <h4 id="storage-consent-declaration-title">
          Einwilligungserklärung zur dauerhaften Speicherung von Bewerbungen
        </h4>
        {APPLICATION_STORAGE_CONSENT_PARAGRAPHS.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        <p className="field-hint storage-consent__text-meta">
          {`Textfassung: ${APPLICATION_STORAGE_CONSENT_TEXT_VERSION}`}
          {` · SHA-256: ${shortHash}`}
          {textState
            ? ` · Textstatus: ${stateLabel(textState)} (${textState})`
            : " · Textstatus: nicht konfiguriert"}
          {!textApproved
            ? ` · ${candidateLabel(APPLICATION_STORAGE_CONSENT_STATE)}`
            : ""}
          {textMappingMatches ? " · Version/Hash stimmen überein" : " · Version/Hash stimmen nicht überein"}
        </p>
      </div>

      <label className="storage-consent__special-categories">
        <input
          type="checkbox"
          checked={specialCategoriesConsent}
          disabled={busy || status === "GRANTED"}
          onChange={(event) => setSpecialCategoriesConsent(event.target.checked)}
        />
        <span>
          Ich willige ausdrücklich in die Speicherung besonderer Kategorien personenbezogener
          Daten gemäß Art. 9 Abs. 2 lit. a DSGVO ein.
        </span>
      </label>

      {status === "GRANTED" && (
        <p className="field-hint storage-consent__proof">
          {`Art.-9-Einwilligung: ${proofConsent ? "erteilt" : "nicht erteilt"}`}
          {proofVersion ? ` · Nachweis-Textversion: ${proofVersion}` : ""}
          {proofHash
            ? ` · Nachweis-SHA-256: ${proofHash.slice(0, 12)}…${proofHash.slice(-8)}`
            : ""}
          {proofCategories.length ? ` · Kategorien: ${proofCategories.join(", ")}` : ""}
        </p>
      )}

      <div className="storage-consent__actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !canGrant}
          onClick={() => run(() => grantRisConsent(token, specialCategoriesConsent))}
        >
          Speicherung zustimmen
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || status !== "GRANTED"}
          onClick={() => run(() => withdrawRisConsent(token))}
        >
          Einwilligung widerrufen
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !token}
          onClick={async () => {
            setBusy(true);
            try { setHistory(await fetchRisConsentHistory(token)); }
            catch (err) { setError(messageOf(err)); }
            finally { setBusy(false); }
          }}
        >
          Verlauf anzeigen
        </button>
      </div>
      {history && (
        <ul aria-label="Einwilligungsverlauf">
          {history.map((event, index) => (
            <li key={String(event.eventId ?? index)}>
              {String(event.event ?? "")} · {String(event.occurredAt ?? "")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function label(status: string): string {
  if (status === "GRANTED") return "erteilt";
  if (status === "WITHDRAWN") return "widerrufen";
  return "nicht erteilt";
}

function stateLabel(state: string): string {
  if (state === "ACTIVE") return "freigegeben";
  if (state === "APPROVED") return "rechtlich freigegeben";
  if (state === "DRAFT") return "Entwurf";
  if (state === "SUPERSEDED") return "ersetzt";
  return "unbekannt";
}

/**
 * The client constant describes provenance, not approval. Never present it as a
 * DRAFT "status" next to an approved server state; only call it a candidate
 * while the server has not approved the mapping.
 */
function candidateLabel(state: string): string {
  if (state === "DRAFT") return "Text-Kandidat (Kandidat für Betreiberfreigabe)";
  return "bekannte Textfassung";
}

function reasonOf(reason: string): string {
  if (reason === "notice_version_not_mapped") return "Für diese App ist noch keine Textversion hinterlegt.";
  if (reason === "notice_version_unknown") return "Die hinterlegte Textversion ist bei RIS nicht veröffentlicht.";
  if (reason === "notice_not_active") return "Die RIS-Textversion ist weder freigegeben (APPROVED) noch aktiv (ACTIVE).";
  if (reason === "notice_not_approved") return "Die RIS-Textversion ist noch nicht rechtlich freigegeben.";
  if (reason === "notice_not_accepted") return "Die RIS-Textversion ist noch nicht für neue Zustimmungen geöffnet.";
  return "Der Freigabestatus konnte nicht geprüft werden.";
}

function textReasonOf(reason: string): string {
  if (reason === "consent_text_not_configured") return "Für diese App ist keine Einwilligungs-Textfassung konfiguriert.";
  if (reason === "consent_text_mismatch") return "Die konfigurierte Textfassung weicht von der kanonischen Fassung ab.";
  if (reason === "consent_text_not_approved") return "Die Einwilligungs-Textfassung ist noch nicht freigegeben.";
  return "Die serverseitige Textzuordnung konnte nicht geprüft werden.";
}

function messageOf(err: unknown): string {
  if (err instanceof RisConsentApiError) {
    if (
      err.code === "notice_version_not_mapped" ||
      err.code === "notice_version_unknown" ||
      err.code === "notice_not_active" ||
      err.code === "notice_not_approved" ||
      err.code === "notice_not_accepted" ||
      err.code === "consent_text_not_configured" ||
      err.code === "consent_text_mismatch" ||
      err.code === "consent_text_not_approved"
    ) {
      return "Die Einwilligungs-Textversion ist noch nicht freigegeben.";
    }
    if (err.code === "test_user_not_allowed") {
      return "Dieses Konto ist für die RIS-Testspeicherung nicht freigegeben.";
    }
  }
  return "Einwilligungsdienst ist derzeit nicht verfügbar.";
}
