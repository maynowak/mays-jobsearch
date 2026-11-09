import { useState } from 'react';
import type { CvDocument, StatusMessage } from '../types';
import { useLang } from '../i18n';
import { readCvProfileLists } from '../lib/cvProfileStore';
import CvDocumentList from './CvDocumentList';
import CvBuilderProfileList from './CvBuilderProfileList';
import CvProfilesOverlay from './CvProfilesOverlay';
import Status from './Status';
import PersistentCvList from './PersistentCvList';
import type { CvBuilderProfileV1 } from '../lib/cvBuilder/profileTypes';
import type { PersistentCvStorageState } from '../lib/usePersistentCvStorage';
import type { PersistentCv } from '../lib/cvStorageApi';

interface Props {
  documents: CvDocument[];
  selectedDocumentId: string | null;
  selectedSearchProfileId: string | null;
  selectedAtsProfileId: string | null;
  processing: boolean;
  searching: boolean;
  // CV-FILESIZE-DISPLAY-01: Upload-/Workflow-Rueckmeldungen (z. B. abgelehnte
  // 0-Byte-Datei) muessen auch im Dashboard sichtbar sein.
  message?: StatusMessage | null;
  onSelectDocument: (id: string) => void;
  onRemoveDocument: (id: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onProcess: (id: string) => void;
  onSearch: () => void;
  onRemoveData: () => void;
  onSelectSearchProfile: (id: string | null) => void;
  onSelectAtsProfile: (id: string | null) => void;
  onOpenCvUpload: () => void;
  onOpenCvBuilder?: () => void;
  onProcessPersistentCv?: (cv: PersistentCv) => Promise<void>;
  cvProfiles?: CvBuilderProfileV1[];
  activeCvProfileId?: string | null;
  canAdoptCvDraft?: boolean;
  assignedCvIds?: string[];
  onCreateCvProfile?: () => void;
  onAdoptCvDraft?: () => void;
  onEditCvProfile?: (cvId: string) => void;
  onDuplicateCvProfile?: (cvId: string) => void;
  onRenameCvProfile?: (cvId: string, name: string) => void;
  onDeleteCvProfile?: (cvId: string) => void;
  onDownloadCvProfile?: (cvId: string) => void;
  // JM-ATS-OVERLAY-PARITY-08A: same session-adapter handler as the search page.
  cvStorageEnabled?: boolean;
  cvStorageMode?: "session" | "persistent";
  onCvStorageModeChange?: (mode: "session" | "persistent") => void;
  persistentCvStorage?: PersistentCvStorageState | null;
  onAssignUnassigned?: (
    cvHash: string,
    atsSessionId: string,
    targetSearchProfileId: string
  ) => Promise<void>;
}

const DashboardV2CvSection = ({
  documents,
  selectedDocumentId,
  selectedSearchProfileId,
  selectedAtsProfileId,
  processing,
  searching,
  message,
  onSelectDocument,
  onRemoveDocument,
  onAddFiles,
  onProcess,
  onSearch,
  onRemoveData,
  onSelectSearchProfile,
  onSelectAtsProfile,
  onOpenCvBuilder,
  onProcessPersistentCv,
  cvProfiles = [],
  activeCvProfileId = null,
  canAdoptCvDraft = false,
  assignedCvIds = [],
  onCreateCvProfile,
  onAdoptCvDraft,
  onEditCvProfile,
  onDuplicateCvProfile,
  onRenameCvProfile,
  onDeleteCvProfile,
  onDownloadCvProfile,
  cvStorageEnabled = false,
  cvStorageMode = "session",
  onCvStorageModeChange,
  persistentCvStorage = null,
  onAssignUnassigned,
}: Props) => {
  const { t } = useLang();
  const [profilesDocumentId, setProfilesDocumentId] = useState<string | null>(null);
  const activeDocument = documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null;
  const lists = readCvProfileLists(activeDocument?.hash ?? null);
  const selectedSearchProfile = lists.searchProfiles.find((entry) => entry.id === selectedSearchProfileId) ?? null;
  const visibleAtsProfiles = selectedSearchProfileId
    ? lists.atsProfiles.filter((entry) => entry.searchProfileId === selectedSearchProfileId)
    : [];
  const selectedAtsProfile = visibleAtsProfiles.find((entry) => entry.id === selectedAtsProfileId) ?? null;

  return (
    <section className="dashboard-v2__cv-section" aria-labelledby="dashboard-v2-cv-title">
      <div className="dashboard-v2__card-heading">
        <div>
          <h2 id="dashboard-v2-cv-title">{t('dashboard.nav.cv')}</h2>
          <p>{t('dashboard.cvDescription')}</p>
          {onOpenCvBuilder && (
            <button type="button" className="btn-ghost" onClick={onOpenCvBuilder}>
              {t('cvBuilder.open')}
            </button>
          )}
        </div>
        <span className={`ui-badge ${cvStorageMode === "persistent" && persistentCvStorage?.consent?.consent?.status === "GRANTED" ? "ui-badge-active" : "ui-badge-soon"}`}>
          {cvStorageMode === "persistent"
            ? (persistentCvStorage?.consent?.consent?.status === "GRANTED"
              ? t('cvStorage.status.granted')
              : t('cvStorage.consentRequired'))
            : t('dashboard.cvSession')}
        </span>
      </div>

      <div className="dashboard-v2__cv-boundary" role="note">
        <p>{cvStorageMode === "persistent" ? t('cvStorage.persistentHint') : t('dashboard.cvSessionNote')}</p>
        <p>{t('cvStorage.sessionVsPersistent')}</p>
        {cvStorageMode === "persistent" && <p>{t('cvStorage.processNoAiConsent')}</p>}
      </div>

      {cvStorageEnabled && onCvStorageModeChange && (
        <>
          <div className="cv-storage-mode" role="group" aria-label={t('cvStorage.modeLabel')}>
            <button
              type="button"
              aria-pressed={cvStorageMode === "session"}
              className={cvStorageMode === "session" ? "active" : ""}
              onClick={() => onCvStorageModeChange("session")}
            >
              {t('cvStorage.sessionMode')}
            </button>
            <button
              type="button"
              aria-pressed={cvStorageMode === "persistent"}
              className={cvStorageMode === "persistent" ? "active" : ""}
              onClick={() => onCvStorageModeChange("persistent")}
            >
              {t('cvStorage.persistentMode')}
            </button>
          </div>
          <p className="field-hint">
            {cvStorageMode === "persistent" ? t('cvStorage.persistentHint') : t('cvStorage.sessionHint')}
          </p>
        </>
      )}

      <Status status={message ?? null} />

      {onCreateCvProfile && onEditCvProfile && onDuplicateCvProfile &&
        onRenameCvProfile && onDeleteCvProfile && onDownloadCvProfile && (
          <CvBuilderProfileList
            profiles={cvProfiles}
            activeCvId={activeCvProfileId}
            canAdoptDraft={canAdoptCvDraft}
            assignedCvIds={assignedCvIds}
            onCreate={onCreateCvProfile}
            onAdoptDraft={onAdoptCvDraft}
            onEdit={onEditCvProfile}
            onDuplicate={onDuplicateCvProfile}
            onRename={onRenameCvProfile}
            onDelete={onDeleteCvProfile}
            onDownload={onDownloadCvProfile}
          />
        )}

      {cvStorageMode === "session" && (
        <>
          {documents.length > 0 && (
            <div className="field dashboard-v2__cv-picker">
              <label htmlFor="dashboard-v2-cv-picker">{t('dashboard.cvChoose')}</label>
              <select
                id="dashboard-v2-cv-picker"
                value={activeDocument?.id ?? ''}
                onChange={(event) => onSelectDocument(event.target.value)}
                disabled={processing}
              >
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>{document.name}</option>
                ))}
              </select>
            </div>
          )}

          <CvDocumentList
            documents={documents}
            onRemove={onRemoveDocument}
            onAddFiles={onAddFiles}
            onProcess={() => {
              if (activeDocument) onProcess(activeDocument.id);
            }}
            onSearch={onSearch}
            onShowProfiles={setProfilesDocumentId}
            onRemoveData={onRemoveData}
            selectionMode="single"
            activeDocumentId={selectedDocumentId}
            disabled={processing}
            processing={processing}
            searching={searching}
          />

          {activeDocument ? (
            <div className="dashboard-v2__cv-details">
              <h3>{t('dashboard.cvResultsTitle', { name: activeDocument.name })}</h3>
              <section aria-labelledby="dashboard-v2-parser-title">
                <h4 id="dashboard-v2-parser-title">{t('dashboard.cvParserResults')}</h4>
                {activeDocument.skills && activeDocument.skills.length > 0 ? (
                  <ul className="dashboard-v2__cv-tags">
                    {activeDocument.skills.map((skill) => <li key={skill} className="tag">{skill}</li>)}
                  </ul>
                ) : (
                  <p className="dashboard-v2__cv-empty">{t('dashboard.cvNoParserResults')}</p>
                )}
              </section>

              <div className="dashboard-v2__cv-selectors">
                <div className="field">
                  <label htmlFor="dashboard-v2-search-profile">{t('cv.chooseSearchProfile')}</label>
                  <select
                    id="dashboard-v2-search-profile"
                    key={`dashboard-search-profile-${activeDocument?.hash ?? 'none'}`}
                    value={selectedSearchProfile?.id ?? ''}
                    disabled={lists.searchProfiles.length === 0}
                    onChange={(event) => onSelectSearchProfile(event.target.value || null)}
                  >
                    <option value="">
                      {lists.searchProfiles.length > 0 ? t('cv.choosePlaceholder') : t('cv.noSearchProfiles')}
                    </option>
                    {lists.searchProfiles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="dashboard-v2-ats-profile">{t('cv.chooseAtsProfile')}</label>
                  <select
                    id="dashboard-v2-ats-profile"
                    key={`dashboard-ats-profile-${activeDocument?.hash ?? 'none'}-${selectedSearchProfileId ?? 'none'}`}
                    value={selectedAtsProfile?.id ?? ''}
                    disabled={visibleAtsProfiles.length === 0}
                    onChange={(event) => onSelectAtsProfile(event.target.value || null)}
                  >
                    <option value="">
                      {visibleAtsProfiles.length > 0 ? t('cv.choosePlaceholder') : t('cv.noAtsProfiles')}
                    </option>
                    {visibleAtsProfiles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                </div>
              </div>

              {selectedSearchProfile && (
                <div className="dashboard-v2__cv-profile-summary" aria-live="polite">
                  <h4>{t('cv.detailTitleSearch', { name: selectedSearchProfile.name })}</h4>
                  <p>{selectedSearchProfile.profile.skills || '—'}</p>
                  <p>{selectedSearchProfile.profile.targetRoles.join(', ') || '—'}</p>
                  <p>{selectedSearchProfile.profile.city || '—'}</p>
                  <p>{selectedSearchProfile.profile.workModes.join(', ') || '—'}</p>
                  <p>{selectedSearchProfile.profile.employmentTypes.join(', ') || '—'}</p>
                </div>
              )}
              {selectedAtsProfile && (
                <div className="dashboard-v2__cv-profile-summary" aria-live="polite">
                  <h4>{t('cv.detailTitleAts', { name: selectedAtsProfile.name })}</h4>
                  <p>{selectedAtsProfile.skills.join(', ') || '—'}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="dashboard-v2__cv-empty">{t('dashboard.cvEmptyUpload')}</p>
          )}
        </>
      )}

      {cvStorageMode === "persistent" && persistentCvStorage && (
        <PersistentCvList
          documents={persistentCvStorage.documents}
          consent={persistentCvStorage.consent}
          loading={persistentCvStorage.loading}
          consentLoading={persistentCvStorage.consentLoading}
          busy={persistentCvStorage.busy}
          error={persistentCvStorage.error}
          notice={persistentCvStorage.notice}
          onUpload={persistentCvStorage.upload}
          onDownload={persistentCvStorage.download}
          onDelete={persistentCvStorage.remove}
          onGrantConsent={persistentCvStorage.grantConsent}
          onWithdrawConsent={persistentCvStorage.withdrawConsent}
          onProcess={onProcessPersistentCv}
        />
      )}

      {profilesDocumentId && (() => {
        const profilesDocument = documents.find((document) => document.id === profilesDocumentId);
        return profilesDocument ? (
          <CvProfilesOverlay
            key={profilesDocument.id}
            docName={profilesDocument.name}
            docHash={profilesDocument.hash ?? null}
            onClose={() => setProfilesDocumentId(null)}
            onAssignUnassigned={
              onAssignUnassigned && profilesDocument.hash
                ? (atsSessionId, targetSearchProfileId) =>
                    onAssignUnassigned(
                      profilesDocument.hash as string,
                      atsSessionId,
                      targetSearchProfileId
                    )
                : undefined
            }
          />
        ) : null;
      })()}
    </section>
  );
};

export default DashboardV2CvSection;
