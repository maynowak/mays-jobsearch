import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLang } from '../i18n';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Card from './ui/Card';
import DashboardNavigation, { DashboardSectionSwitcher, type DashboardNavigationItem } from './ui/DashboardNavigation';
import MayHelp, { type MayContext } from './MayHelp';
import StorageConsentOverview from './StorageConsentOverview';
import StorageConsentSection from './StorageConsentSection';

export interface DashboardUser {
  sub?: string;
  email?: string;
  name?: string;
}

export interface DashboardV2Props {
  user: DashboardUser;
  isDemo: boolean;
  onLogout?: () => void;
  cvSection?: ReactNode;
  applicationsSection?: ReactNode;
  // MAYS-SEARCH-PROFILE-MANUAL-01: "Job-Praferenzen" (manuelle Suchprofile).
  preferencesSection?: ReactNode;
  storageConsentIdentityVerified?: boolean;
  cvStorageEnabled?: boolean;
  cvStorageConsentStatus?: "NOT_GRANTED" | "GRANTED" | "WITHDRAWN" | null;
}

export const DEMO_USER: DashboardUser = {
  sub: 'dev-demo-user-123',
  email: 'dev@example.com',
  name: 'Dev Demo User',
};

const MAY_HELP_STORAGE_KEY = 'mj-may-help-open';

function initialMayOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MAY_HELP_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const DASHBOARD_TABS = [
  'overview',
  'profile',
  'cv',
  'applications',
  'preferences',
  'settings',
] as const;

function initialDashboardTab(): string {
  if (typeof window === 'undefined') return 'overview';
  const requested = new URLSearchParams(window.location.search).get('tab');
  return requested && DASHBOARD_TABS.includes(requested as (typeof DASHBOARD_TABS)[number])
    ? requested
    : 'overview';
}

const DashboardV2 = ({
  user,
  isDemo,
  onLogout,
  cvSection,
  applicationsSection,
  preferencesSection,
  storageConsentIdentityVerified = false,
  cvStorageEnabled = false,
  cvStorageConsentStatus = null,
}: DashboardV2Props) => {
  const { t } = useLang();
  const [activeId, setActiveId] = useState(initialDashboardTab);
  const [mayOpen, setMayOpen] = useState(initialMayOpen);
  const mayButtonRef = useRef<HTMLButtonElement>(null);
  const mayPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(MAY_HELP_STORAGE_KEY, mayOpen ? 'true' : 'false');
    } catch {
      /* UI preference only; storage can be unavailable */
    }
    if (mayOpen) {
      window.setTimeout(() => mayPanelRef.current?.focus(), 0);
    }
  }, [mayOpen]);

  const closeMay = () => {
    setMayOpen(false);
    mayButtonRef.current?.focus();
  };
  const mayContext: MayContext = activeId === 'cv' ? 'cv' : activeId === 'applications' ? 'applications' : activeId === 'preferences' ? 'preferences' : activeId === 'settings' ? 'settings' : 'overview';
  const navigationItems: readonly DashboardNavigationItem[] = [
    { id: 'overview', label: t('dashboard.nav.overview') },
    { id: 'profile', label: t('dashboard.nav.myProfile') },
    { id: 'cv', label: t('dashboard.nav.cv'), badge: cvSection ? undefined : t('dashboard.soon'), disabled: !cvSection },
    {
      id: 'applications',
      label: t('dashboard.nav.applications'),
      badge: applicationsSection ? undefined : t('dashboard.soon'),
      disabled: !applicationsSection,
    },
    {
      id: 'preferences',
      label: t('dashboard.nav.jobPrefs'),
      badge: preferencesSection ? undefined : t('dashboard.soon'),
      disabled: !preferencesSection,
    },
    { id: 'settings', label: t('dashboard.nav.settings') },
  ];

  return (
    <div
      className={`dashboard-v2${activeId === "applications" ? " dashboard-v2--applications" : ""}`}
      aria-labelledby="dashboard-v2-title"
    >
      <header className="dashboard-v2__header">
        <div>
          {isDemo ? <Badge tone="neutral">{t('dashboard.devBadge')}</Badge> : <Badge tone="active">{t('dashboard.active')}</Badge>}
          <h1 id="dashboard-v2-title">{t('profile.title')}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <div className="dashboard-v2__header-actions">
          {isDemo ? (
            <div className="dashboard-v2__demo-note">
              <strong>{t('dashboard.demoNote.title')}</strong> {t('dashboard.demoNote.text')}
            </div>
          ) : null}
        </div>
      </header>

      <div className="may-help-control">
        <button
          ref={mayButtonRef}
          type="button"
          className="may-help-toggle"
          aria-expanded={mayOpen}
          aria-controls="may-help-panel"
          onClick={() => {
            if (mayOpen) closeMay();
            else setMayOpen(true);
          }}
        >
          <span aria-hidden="true">💚</span>
          {t('dashboard.may.button')}
        </button>
        {mayOpen && (
          <div
            id="may-help-panel"
            ref={mayPanelRef}
            tabIndex={-1}
            className="may-help-panel"
          >
            <MayHelp context={mayContext} className="dashboard-v2__may" />
          </div>
        )}
      </div>

      <div className="dashboard-v2__mobile-nav">
        <DashboardSectionSwitcher
          items={navigationItems}
          activeId={activeId}
          ariaLabel={t('dashboard.mobileNavLabel')}
          onSelect={setActiveId}
        />
      </div>

      <div className="dashboard-v2__layout">
        <Card className="dashboard-v2__navigation-card">
          <h2>{t('dashboard.sidebarTitle')}</h2>
          <DashboardNavigation
            items={navigationItems}
            activeId={activeId}
            ariaLabel={t('dashboard.sidebarTitle')}
            onSelect={setActiveId}
          />
        </Card>

        <main className="dashboard-v2__main">
          {activeId === 'cv' && cvSection ? cvSection : activeId === 'applications' && applicationsSection ? applicationsSection : activeId === 'preferences' && preferencesSection ? preferencesSection : activeId === 'settings' ? (
            <StorageConsentSection
              identityVerified={storageConsentIdentityVerified}
              cvStorageEnabled={cvStorageEnabled}
              cvConsentStatus={cvStorageConsentStatus}
            />
          ) : (
            <>
          <Card variant="primary" className="dashboard-v2__profile-card">
            <div className="dashboard-v2__card-heading">
              <h2>{t('dashboard.personalData')}</h2>
              <div className="dashboard-v2__heading-actions">
                <Badge tone={isDemo ? 'neutral' : 'active'}>{isDemo ? t('dashboard.demo') : t('dashboard.authStatus')}</Badge>
                {!isDemo && onLogout ? (
                  <Button variant="danger" onClick={onLogout}>{t('auth.logout')}</Button>
                ) : null}
              </div>
            </div>
            <dl className="dashboard-v2__details">
              <div>
                <dt>{t('profile.email')}</dt>
                <dd>{user.email || '-'}</dd>
              </div>
              <div>
                <dt>{t('profile.sub')}</dt>
                <dd>{user.sub || '-'}</dd>
              </div>
              <div>
                <dt>{t('profile.name')}</dt>
                <dd>{user.name || '-'}</dd>
              </div>
            </dl>
          </Card>

          <StorageConsentOverview
            identityVerified={storageConsentIdentityVerified}
            onOpenSettings={() => setActiveId('settings')}
          />

          <Card className="dashboard-v2__status-card">
            <div className="dashboard-v2__card-heading">
              <h2>{t('dashboard.accountStatus')}</h2>
              <Badge tone={isDemo ? 'neutral' : 'active'}>{isDemo ? t('dashboard.demo') : t('dashboard.authStatus')}</Badge>
            </div>
            <div className="dashboard-v2__status-grid">
              <div>
                <span className="dashboard-v2__status-icon" aria-hidden="true">✓</span>
                <div>
                  <p>{isDemo ? t('dashboard.demo') : t('dashboard.authStatus')}</p>
                  <strong>{isDemo ? t('dashboard.demoMode') : t('dashboard.active')}</strong>
                </div>
              </div>
            </div>
          </Card>

          <Card variant="features" className="dashboard-v2__features-card">
            <div className="dashboard-v2__card-heading">
              <h2>{t('dashboard.upcomingFeatures')}</h2>
              <Badge tone="soon">{t('dashboard.soon')}</Badge>
            </div>
            <div className="dashboard-v2__features-grid">
              {[
                ...(cvSection ? [] : [t('dashboard.featureCv')]),
                ...(applicationsSection ? [] : [t('dashboard.featureApplications')]),
              ].map((feature) => (
                <div className="dashboard-v2__feature" key={feature}>
                  <Badge tone="soon">{t('dashboard.soon')}</Badge>
                  <h3>{feature}</h3>
                </div>
              ))}
            </div>
          </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardV2;
