import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useLang } from "../i18n";
import { fetchRisConsent, type RisConsentStatus } from "../lib/risConsentApi";
import {
  durableStorageAreas,
  hasExtendedDurableStorage,
  isApplicationStorageGranted,
  storageConsentNoticeKey,
  STORAGE_AREA_LABEL_KEYS,
  type DurableStorageFlags,
  type StorageAreaId,
  type StorageConsentDisplayState,
} from "../lib/storageConsentDisplay";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface Props {
  identityVerified: boolean;
  onOpenSettings: () => void;
  /** Test/preview override; production uses the verified identity and env flag. */
  liveConsentEnabled?: boolean;
  cvStorageEnabled?: boolean;
  cvConsentStatus?: "NOT_GRANTED" | "GRANTED" | "WITHDRAWN" | null;
  searchProfileStorageEnabled?: boolean;
  searchProfileConsentStatus?: "NOT_GRANTED" | "GRANTED" | "WITHDRAWN" | null;
}

/**
 * Dashboard summary card. It uses the same server-side consent status as the
 * settings area, so an active application-storage purpose is never presented
 * as "preparation" on the overview.
 */
export default function StorageConsentOverview({
  identityVerified,
  onOpenSettings,
  liveConsentEnabled,
  cvStorageEnabled = false,
  cvConsentStatus = null,
  searchProfileStorageEnabled = false,
  searchProfileConsentStatus = null,
}: Props) {
  const { t, lang } = useLang();
  const envEnabled = import.meta.env.VITE_RIS_CONSENT_UI_ENABLED === "true";
  const liveEnabled = (liveConsentEnabled ?? envEnabled) && identityVerified;
  const cvGranted = cvStorageEnabled && cvConsentStatus === "GRANTED";
  const searchProfileGranted =
    searchProfileStorageEnabled && searchProfileConsentStatus === "GRANTED";

  if (!liveEnabled) {
    const flags: DurableStorageFlags = {
      applicationGranted: false,
      cvGranted,
      searchProfileGranted,
    };
    if (hasExtendedDurableStorage(flags)) {
      const areas = durableStorageAreas(flags);
      const areaText = new Intl.ListFormat(lang === "de" ? "de-DE" : "en-US", {
        style: "long",
        type: "conjunction",
      }).format(areas.map((area) => t(STORAGE_AREA_LABEL_KEYS[area])));
      return (
        <Card className="dashboard-v2__storage-notice">
          <div className="dashboard-v2__card-heading">
            <h2>{t("privacyStorage.title")}</h2>
            <Badge tone="active">{t("privacyStorage.badge.active")}</Badge>
          </div>
          <p>{t("privacyStorage.notice.durableActive", { areas: areaText })}</p>
          <Button variant="ghost" onClick={onOpenSettings}>
            {t("privacyStorage.openSettings")}
          </Button>
        </Card>
      );
    }
    return (
      <Card className="dashboard-v2__storage-notice">
        <div className="dashboard-v2__card-heading">
          <h2>{t("privacyStorage.title")}</h2>
          <Badge tone="soon">{t("privacyStorage.badge.preparing")}</Badge>
        </div>
        <p>{t("privacyStorage.notice")}</p>
        <Button variant="ghost" onClick={onOpenSettings}>
          {t("privacyStorage.openSettings")}
        </Button>
      </Card>
    );
  }

  return (
    <LiveStorageConsentOverview
      onOpenSettings={onOpenSettings}
      cvStorageEnabled={cvStorageEnabled}
      cvConsentStatus={cvConsentStatus}
      searchProfileStorageEnabled={searchProfileStorageEnabled}
      searchProfileConsentStatus={searchProfileConsentStatus}
    />
  );
}

function LiveStorageConsentOverview({
  onOpenSettings,
  cvStorageEnabled,
  cvConsentStatus,
  searchProfileStorageEnabled,
  searchProfileConsentStatus,
}: {
  onOpenSettings: () => void;
  cvStorageEnabled: boolean;
  cvConsentStatus: "NOT_GRANTED" | "GRANTED" | "WITHDRAWN" | null;
  searchProfileStorageEnabled: boolean;
  searchProfileConsentStatus: "NOT_GRANTED" | "GRANTED" | "WITHDRAWN" | null;
}) {
  const auth = useAuth();
  const { t, lang } = useLang();
  const token = auth.user?.access_token ?? "";
  const [status, setStatus] = useState<RisConsentStatus>("NOT_GRANTED");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoaded(false);
    setError(false);
    fetchRisConsent(token)
      .then((state) => {
        if (!active) return;
        setStatus(state.consent?.status ?? "NOT_GRANTED");
        setError(false);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoaded(true);
      });
    return () => { active = false; };
  }, [token]);

  const display: StorageConsentDisplayState = {
    liveEnabled: true,
    loaded,
    error,
    status,
  };
  const flags: DurableStorageFlags = {
    applicationGranted: isApplicationStorageGranted(display),
    cvGranted: cvStorageEnabled && cvConsentStatus === "GRANTED",
    searchProfileGranted:
      searchProfileStorageEnabled && searchProfileConsentStatus === "GRANTED",
  };
  const extendedSummary = hasExtendedDurableStorage(flags);
  const areas = durableStorageAreas(flags);
  const areaText = new Intl.ListFormat(lang === "de" ? "de-DE" : "en-US", {
    style: "long",
    type: "conjunction",
  }).format(areas.map((area: StorageAreaId) => t(STORAGE_AREA_LABEL_KEYS[area])));

  return (
    <Card className="dashboard-v2__storage-notice">
      <div className="dashboard-v2__card-heading">
        <h2>{t("privacyStorage.title")}</h2>
        <Badge tone={extendedSummary || isApplicationStorageGranted(display) ? "active" : "soon"}>
          {t(
            extendedSummary || isApplicationStorageGranted(display)
              ? "privacyStorage.badge.active"
              : loaded && !error
                ? "privacyStorage.badge.actionRequired"
                : error
                  ? "privacyStorage.badge.unavailable"
                  : "privacyStorage.badge.checking"
          )}
        </Badge>
      </div>
      <p>
        {extendedSummary
          ? t("privacyStorage.notice.durableActive", { areas: areaText })
          : t(storageConsentNoticeKey(display))}
      </p>
      <Button variant="ghost" onClick={onOpenSettings}>
        {t("privacyStorage.openSettings")}
      </Button>
    </Card>
  );
}
