import { useState } from 'react';
import type { CvDocument, StatusMessage } from '../types';
import { useLang } from '../i18n';
import { readCvProfileLists } from '../lib/cvProfileStore';
import CvDocumentList from './CvDocumentList';
import CvProfilesOverlay from './CvProfilesOverlay';
import Status from './Status';

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
  onOpenCvUpload,
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
          <button type="button" className="btn-ghost" onClick={onOpenCvUpload}>
            {t('cv.openUpload')}
          </button>
        </div>
        <span className="ui-badge ui-badge-soon">{t('dashboard.cvSession')}</span>
      </div>

      <div className="dashboard-v2__cv-boundary" role="note">
        {t('dashboard.cvSessionNote')}
      </div>

      <Status status={message ?? null} />

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
      {profilesDocumentId && (() => {
        const profilesDocument = documents.find((document) => document.id === profilesDocumentId);
        return profilesDocument ? (
          <CvProfilesOverlay
            docName={profilesDocument.name}
            docHash={profilesDocument.hash ?? null}
            onClose={() => setProfilesDocumentId(null)}
          />
        ) : null;
      })()}
    </section>
  );
};

export default DashboardV2CvSection;
