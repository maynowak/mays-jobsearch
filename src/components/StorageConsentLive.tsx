import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import {
  RisConsentApiError,
  fetchRisConsent,
  fetchRisConsentHistory,
  grantRisConsent,
  withdrawRisConsent,
  type RisConsent,
  type RisConsentState,
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
  const [pendingAction, setPendingAction] = useState<"grant" | "withdraw" | "history" | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>> | null>(null);
  const busy = pendingAction !== null;

  const applyConsentState = (state: RisConsentState) => {
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
    // Reflect an already granted Art. 9 declaration after a reload instead of
    // presenting an unchecked checkbox as if the declaration were missing.
    if (state.consent?.status === "GRANTED") {
      setSpecialCategoriesConsent(state.consent.specialCategoriesConsent === true);
    } else if (state.consent?.status === "WITHDRAWN") {
      setSpecialCategoriesConsent(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoaded(false);
    setError(null);
    setSuccessMessage(null);
    fetchRisConsent(token)
      .then((state) => {
        if (!active) return;
        applyConsentState(state);
        setLoaded(true);
      })
      .catch((err) => {
        if (!active) return;
        setError(messageOf(err));
        setLoaded(true);
      });
    return () => { active = false; };
    // applyConsentState is intentionally local to the current token render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const run = async (
    action: () => Promise<RisConsent>,
    pending: "grant" | "withdraw",
    success: string
  ) => {
    setPendingAction(pending);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await action();
      // The POST response is the server-confirmed state. Do not issue a second
      // read here: a transient GET must not turn a confirmed grant into a
      // false error, and the next mount/reload performs the normal GET.
      setConsent(result);
      if (result.status === "GRANTED") {
        setSpecialCategoriesConsent(result.specialCategoriesConsent === true);
      }
      setSuccessMessage(success);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPendingAction(null);
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

  const validateGrant = (): string | null => {
    if (!token) {
      return "Die Einwilligung kann nicht gespeichert werden, weil die Anmeldung fehlt. Bitte melde dich erneut an.";
    }
    if (status === "GRANTED") {
      return "Die Einwilligung ist bereits erteilt. Ein erneuter Grant ist nicht erforderlich.";
    }
    if (!grantAllowed) {
      return `Die Einwilligung kann derzeit nicht gespeichert werden, weil RIS die Freigabe noch nicht erteilt hat. ${reasonOf(noticeReason ?? "notice_not_active")} Bitte später erneut versuchen oder den Betreiber informieren.`;
    }
    if (!textMappingMatches || !textServerApproved) {
      return "Die Einwilligung kann nicht gespeichert werden, weil die angezeigte Textfassung nicht der serverseitig freigegebenen Fassung entspricht. Bitte lade die Seite neu oder informiere den Betreiber.";
    }
    if (art9Missing) {
      return "Die Einwilligung wurde nicht gespeichert, weil die ausdrückliche Art.-9-Bestätigung fehlt. Bitte setze die Checkbox und versuche es erneut.";
    }
    return null;
  };

  const handleGrant = () => {
    const validation = validateGrant();
    if (validation) {
      setError(validation);
      setSuccessMessage(null);
      return;
    }
    void run(
      () => grantRisConsent(token, specialCategoriesConsent),
      "grant",
      "Die Einwilligung zur dauerhaften Speicherung wurde gespeichert. Status: erteilt."
    );
  };
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
      {pendingAction === "grant" && (
        <p className="field-hint" role="status" aria-live="polite">
          Einwilligung wird geprüft …
        </p>
      )}
      {successMessage && (
        <p className="field-hint storage-consent__success" role="note" aria-live="polite">
          {successMessage}
        </p>
      )}
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
          aria-busy={pendingAction === "grant" || undefined}
          onClick={handleGrant}
        >
          {pendingAction === "grant" ? "Einwilligung wird geprüft …" : "Speicherung zustimmen"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || status !== "GRANTED"}
          aria-busy={pendingAction === "withdraw" || undefined}
          onClick={() =>
            run(
              () => withdrawRisConsent(token),
              "withdraw",
              "Die Einwilligung wurde widerrufen. Neue Speicherungen sind gesperrt."
            )
          }
        >
          {pendingAction === "withdraw" ? "Wird widerrufen …" : "Einwilligung widerrufen"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !token}
          aria-busy={pendingAction === "history" || undefined}
          onClick={async () => {
            setPendingAction("history");
            setError(null);
            setSuccessMessage(null);
            try { setHistory(await fetchRisConsentHistory(token)); }
            catch (err) { setError(messageOf(err)); }
            finally { setPendingAction(null); }
          }}
        >
          {pendingAction === "history" ? "Verlauf wird geladen …" : "Verlauf anzeigen"}
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
    if (err.status === 401 || err.code === "unauthenticated" || err.code === "invalid_token") {
      return "Die Einwilligung wurde nicht gespeichert, weil die Anmeldung abgelaufen ist. Bitte melde dich erneut an und öffne die Einstellungen noch einmal.";
    }
    if (err.status === 403 || err.code === "test_user_not_allowed" || err.code === "forbidden") {
      return "Die Einwilligung wurde nicht gespeichert, weil dieses Konto für die RIS-Speicherung nicht freigegeben ist. Bitte wende dich an den Betreiber.";
    }
    if (err.code === "special_categories_consent_required") {
      return "Die Einwilligung wurde nicht gespeichert, weil die ausdrückliche Art.-9-Bestätigung fehlt. Bitte setze die Checkbox und versuche es erneut.";
    }
    if (err.code === "notice_not_active") {
      return "Die Einwilligung wurde nicht gespeichert, weil RIS die Einwilligungs-Textversion noch nicht für neue Zustimmungen freigegeben hat. Bitte später erneut versuchen oder den Betreiber informieren.";
    }
    if (err.code === "notice_not_approved") {
      return "Die Einwilligung wurde nicht gespeichert, weil die RIS-Textversion noch nicht rechtlich freigegeben ist. Bitte später erneut versuchen.";
    }
    if (err.code === "notice_not_accepted") {
      return "Die Einwilligung wurde nicht gespeichert, weil RIS derzeit keine neuen Zustimmungen für diese Textversion annimmt. Bitte später erneut versuchen.";
    }
    if (err.code === "notice_version_unknown" || err.code === "notice_version_not_mapped") {
      return "Die Einwilligung wurde nicht gespeichert, weil die App-Textversion und die RIS-Konfiguration nicht zusammenpassen. Bitte informiere den Betreiber.";
    }
    if (
      err.code === "consent_text_not_configured" ||
      err.code === "consent_text_mismatch" ||
      err.code === "consent_text_not_approved"
    ) {
      return "Die Einwilligung wurde nicht gespeichert, weil die angezeigte Textfassung serverseitig nicht freigegeben ist. Bitte lade die Seite neu oder informiere den Betreiber.";
    }
    if (err.code === "notice_catalog_unavailable") {
      return "Die Einwilligung wurde nicht gespeichert, weil der RIS-Freigabestatus nicht geprüft werden konnte. Bitte später erneut versuchen.";
    }
    if (err.code === "consent_disabled") {
      return "Die Einwilligung wurde nicht gespeichert, weil die RIS-Einwilligungsfunktion derzeit deaktiviert ist. Bitte später erneut versuchen.";
    }
    if (err.code === "missing_config") {
      return "Die Einwilligung wurde nicht gespeichert, weil die RIS-Einwilligungsfunktion serverseitig nicht vollständig konfiguriert ist. Bitte informiere den Betreiber.";
    }
    if (err.status === 503) {
      return "Die Einwilligung wurde nicht gespeichert, weil der Einwilligungsdienst derzeit nicht erreichbar ist. Bitte später erneut versuchen.";
    }
  }
  return "Die Einwilligung konnte nicht gespeichert werden. Bitte prüfe die Verbindung und versuche es erneut; bleibt der Fehler bestehen, informiere den Betreiber.";
}
