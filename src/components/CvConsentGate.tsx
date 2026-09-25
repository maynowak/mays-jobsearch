import { useState } from "react";
import { useLang } from "../i18n";

interface Props {
  fileName: string;
  onAccept: () => void;
  onCancel: () => void;
  processingInfo: string;
  externalAI: boolean;
  disabled: boolean;
}

export default function CvConsentGate({
  fileName,
  onAccept,
  onCancel,
  processingInfo,
  externalAI,
  disabled,
}: Props) {
  const { t } = useLang();
  // Die Zustimmung ist eine echte Voraussetzung (BROWSER-BUG-06):
  // ohne aktivierte Checkbox darf keine Verarbeitung gestartet werden.
  const [consented, setConsented] = useState(false);

  return (
    <div className="cv-consent-gate" role="dialog" aria-modal="true" aria-labelledby="cv-consent-title">
      <h3 id="cv-consent-title" className="cv-consent-gate__title">
        {t("cv.consentTitle")}
      </h3>

      <p className="cv-consent-gate__description">
        {t("cv.consentDescription")}
      </p>

      <p className="cv-consent-gate__file-label">
        <span className="cv-consent-gate__file-label-text">{t("cv.consentFileLabel")}</span>
        <span className="cv-consent-gate__file-name">{fileName}</span>
      </p>

      <p className="cv-consent-gate__description">
        {t("cv.consentDataUsed")}
      </p>
      <ul className="cv-consent-gate__list">
        <li>• {t("cv.consentDataItem1")}</li>
        <li>• {t("cv.consentDataItem2")}</li>
        <li>• {t("cv.consentDataItem3")}</li>
        <li>• {t("cv.consentDataItem4")}</li>
        <li>• {t("cv.consentDataItem5")}</li>
      </ul>

      <p className="cv-consent-gate__description">
        {t("cv.consentPurpose")}
      </p>

      <p className="cv-consent-gate__processing-info">
        {t("cv.consentDataProcessing", { processingInfo })}
      </p>

      {externalAI && (
        <p className="cv-consent-gate__external-ai">
          {t("cv.consentExternalAI")}
        </p>
      )}

      <label className="cv-consent-gate__consent">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="cv-consent-gate__checkbox"
          disabled={disabled}
        />
        <span className="cv-consent-gate__consent-text">{t("cv.consentCheckbox")}</span>
      </label>

      <div className="cv-consent-gate__actions">
        <button
          type="button"
          className="cv-consent-gate__cancel"
          onClick={onCancel}
          disabled={disabled}
        >
          {t("cv.consentCancel")}
        </button>
        <button
          type="button"
          className="cv-consent-gate__confirm"
          onClick={onAccept}
          disabled={disabled || !consented}
        >
          {t("cv.consentConfirm")}
        </button>
      </div>
    </div>
  );
}

