import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useLang } from "../i18n";
import { fetchRisConsent, type RisConsentStatus } from "../lib/risConsentApi";
import {
  isApplicationStorageGranted,
  storageConsentNoticeKey,
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
}: Props) {
  const { t } = useLang();
  const envEnabled = import.meta.env.VITE_RIS_CONSENT_UI_ENABLED === "true";
  const liveEnabled = (liveConsentEnabled ?? envEnabled) && identityVerified;

  if (!liveEnabled) {
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

  return <LiveStorageConsentOverview onOpenSettings={onOpenSettings} />;
}

function LiveStorageConsentOverview({ onOpenSettings }: { onOpenSettings: () => void }) {
  const auth = useAuth();
  const { t } = useLang();
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

  return (
    <Card className="dashboard-v2__storage-notice">
      <div className="dashboard-v2__card-heading">
        <h2>{t("privacyStorage.title")}</h2>
        <Badge tone={isApplicationStorageGranted(display) ? "active" : "soon"}>
          {t(
            isApplicationStorageGranted(display)
              ? "privacyStorage.badge.active"
              : loaded && !error
                ? "privacyStorage.badge.actionRequired"
                : error
                  ? "privacyStorage.badge.unavailable"
                  : "privacyStorage.badge.checking"
          )}
        </Badge>
      </div>
      <p>{t(storageConsentNoticeKey(display))}</p>
      <Button variant="ghost" onClick={onOpenSettings}>
        {t("privacyStorage.openSettings")}
      </Button>
    </Card>
  );
}
