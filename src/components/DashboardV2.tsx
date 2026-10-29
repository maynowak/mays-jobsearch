import { useState } from 'react';
import { useLang } from '../i18n';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Card from './ui/Card';
import DashboardNavigation, { type DashboardNavigationItem } from './ui/DashboardNavigation';

export interface DashboardUser {
  sub?: string;
  email?: string;
  name?: string;
}

export interface DashboardV2Props {
  user: DashboardUser;
  isDemo: boolean;
  onLogout?: () => void;
}

export const DEMO_USER: DashboardUser = {
  sub: 'dev-demo-user-123',
  email: 'dev@example.com',
  name: 'Dev Demo User',
};

const DashboardV2 = ({ user, isDemo, onLogout }: DashboardV2Props) => {
  const { t } = useLang();
  const [activeId, setActiveId] = useState('overview');
  const navigationItems: readonly DashboardNavigationItem[] = [
    { id: 'overview', label: t('dashboard.nav.overview') },
    { id: 'profile', label: t('dashboard.nav.myProfile') },
    { id: 'cv', label: t('dashboard.nav.cv'), badge: t('dashboard.soon'), disabled: true },
    { id: 'applications', label: t('dashboard.nav.applications'), badge: t('dashboard.soon'), disabled: true },
    { id: 'preferences', label: t('dashboard.nav.jobPrefs'), badge: t('dashboard.soon'), disabled: true },
    { id: 'settings', label: t('dashboard.nav.settings'), badge: t('dashboard.soon'), disabled: true },
  ];

  return (
    <div className="dashboard-v2" aria-labelledby="dashboard-v2-title">
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
          <Button variant="ghost" className="dashboard-v2__demo-action" onClick={() => setActiveId('overview')}>
            {t('dashboard.nav.overview')}
          </Button>
        </div>
      </header>

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
              {[t('dashboard.featureCv'), t('dashboard.featureApplications'), t('dashboard.nav.jobPrefs')].map((feature) => (
                <div className="dashboard-v2__feature" key={feature}>
                  <Badge tone="soon">{t('dashboard.soon')}</Badge>
                  <h3>{feature}</h3>
                </div>
              ))}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default DashboardV2;
