import { useLang } from "../i18n";
import {
  STORAGE_CONSENT_BACKEND_UNAVAILABLE,
  STORAGE_CONSENT_PURPOSES,
  type StorageConsentPurpose,
} from "../lib/storageConsent";

interface Props {
  /** True only when `iss + sub` were verified for the signed-in account. */
  identityVerified: boolean;
}

const PURPOSE_LABEL_KEYS: Record<StorageConsentPurpose, string> = {
  cv_storage: "privacyStorage.purpose.cv_storage",
  application_storage: "privacyStorage.purpose.application_storage",
  search_profile_storage: "privacyStorage.purpose.search_profile_storage",
};

const PURPOSE_DESCRIPTION_KEYS: Record<StorageConsentPurpose, string> = {
  cv_storage: "privacyStorage.purpose.cv_storage.description",
  application_storage: "privacyStorage.purpose.application_storage.description",
  search_profile_storage: "privacyStorage.purpose.search_profile_storage.description",
};

export default function StorageConsentSection({ identityVerified }: Props) {
  const { t } = useLang();
  const unavailable = STORAGE_CONSENT_BACKEND_UNAVAILABLE;

  return (
    <section className="aurora-card storage-consent" aria-labelledby="storage-consent-title">
      <div className="storage-consent__head">
        <div>
          <h2 id="storage-consent-title">{t("privacyStorage.title")}</h2>
          <p className="storage-consent__status">
            <span className="ui-badge ui-badge-soon">{t("privacyStorage.badge.preparing")}</span>
          </p>
        </div>
      </div>

      <p className="storage-consent__notice" role="note">
        {t("privacyStorage.notice")}
      </p>

      <p className="storage-consent__identity" role="status">
        {identityVerified
          ? t("privacyStorage.identity.verified")
          : t("privacyStorage.identity.unverified")}
      </p>

      <section className="storage-consent__block" aria-labelledby="storage-consent-purposes-title">
        <h3 id="storage-consent-purposes-title">{t("privacyStorage.purposesTitle")}</h3>
        <ul className="storage-consent__purposes">
          {STORAGE_CONSENT_PURPOSES.map((purpose) => (
            <li key={purpose} className="storage-consent__purpose">
              <div>
                <strong>{t(PURPOSE_LABEL_KEYS[purpose])}</strong>
                <p>{t(PURPOSE_DESCRIPTION_KEYS[purpose])}</p>
              </div>
              <span className="storage-consent__not-granted">
                {t("privacyStorage.purpose.notGranted")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="storage-consent__block" aria-labelledby="storage-consent-required-title">
        <h3 id="storage-consent-required-title">{t("privacyStorage.requiredTitle")}</h3>
        <p>{t("privacyStorage.requiredText")}</p>
      </section>

      <section className="storage-consent__block" aria-labelledby="storage-consent-ai-title">
        <h3 id="storage-consent-ai-title">{t("privacyStorage.aiTitle")}</h3>
        <p>{t("privacyStorage.aiText")}</p>
      </section>

      <section className="storage-consent__block" aria-labelledby="storage-consent-session-title">
        <h3 id="storage-consent-session-title">{t("privacyStorage.sessionTitle")}</h3>
        <p>{t("privacyStorage.sessionText")}</p>
      </section>

      <section className="storage-consent__block" aria-labelledby="storage-consent-ris-title">
        <h3 id="storage-consent-ris-title">{t("privacyStorage.risTitle")}</h3>
        <p>{t("privacyStorage.risText")}</p>
      </section>

      <section className="storage-consent__block" aria-labelledby="storage-consent-rights-title">
        <h3 id="storage-consent-rights-title">{t("privacyStorage.rightsTitle")}</h3>
        <p>{t("privacyStorage.rightsText")}</p>
        <p className="storage-consent__links">
          <a href="/datenschutz">{t("privacyStorage.privacyLink")}</a>
          <span aria-hidden="true"> · </span>
          <a href="/datenschutzprinzipien">{t("privacyStorage.principlesLink")}</a>
        </p>
      </section>

      <section className="storage-consent__block" aria-labelledby="storage-consent-actions-title">
        <h3 id="storage-consent-actions-title">{t("privacyStorage.actionsTitle")}</h3>
        <div className="storage-consent__actions">
          {[
            "privacyStorage.actions.show",
            "privacyStorage.actions.export",
            "privacyStorage.actions.erasure",
            "privacyStorage.actions.withdraw",
          ].map((key) => (
            <button
              key={key}
              type="button"
              className="btn-ghost"
              disabled
              aria-describedby="storage-consent-actions-unavailable"
            >
              {t(key)}
            </button>
          ))}
        </div>
        <p id="storage-consent-actions-unavailable" className="field-hint">
          {t("privacyStorage.actions.unavailable")}
        </p>
        <p className="visually-hidden">
          {`backend: ${unavailable.reason}; consent text ${unavailable.consentTextVersion}; privacy notice ${unavailable.privacyNoticeVersion}`}
        </p>
      </section>
    </section>
  );
}
