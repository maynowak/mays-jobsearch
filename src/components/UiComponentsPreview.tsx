import { useState } from 'react';
import { useLang } from '../i18n';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Card from './ui/Card';
import DashboardNavigation, { type DashboardNavigationItem } from './ui/DashboardNavigation';

const UiComponentsPreview = () => {
  const { t } = useLang();
  const [activeId, setActiveId] = useState('overview');
  const items: readonly DashboardNavigationItem[] = [
    { id: 'overview', label: t('dashboard.nav.overview') },
    { id: 'profile', label: t('dashboard.nav.myProfile') },
    { id: 'cv', label: t('dashboard.nav.cv'), badge: t('dashboard.soon') },
  ];

  return (
    <section className="ui-components-preview" aria-labelledby="ui-components-preview-title">
      <div className="ui-components-preview__heading">
        <p className="aurora-dev-badge">{t('dashboard.devBadge')}</p>
        <h1 id="ui-components-preview-title">{t('profile.title')}</h1>
        <p>{t('dashboard.subtitle')}</p>
      </div>
      <div className="ui-components-preview__grid">
        <Card variant="primary">
          <h2>{t('dashboard.personalData')}</h2>
          <div className="ui-components-preview__badges">
            <Badge tone="active">{t('dashboard.active')}</Badge>
            <Badge tone="soon">{t('dashboard.soon')}</Badge>
          </div>
          <div className="ui-components-preview__actions">
            <Button onClick={() => setActiveId('overview')}>{t('dashboard.nav.overview')}</Button>
            <Button variant="ghost" onClick={() => setActiveId('profile')}>
              {t('dashboard.nav.myProfile')}
            </Button>
          </div>
        </Card>
        <Card>
          <h2>{t('dashboard.sidebarTitle')}</h2>
          <DashboardNavigation
            items={items}
            activeId={activeId}
            ariaLabel={t('dashboard.sidebarTitle')}
            onSelect={setActiveId}
          />
          <p className="ui-components-preview__selection">{activeId}</p>
        </Card>
      </div>
    </section>
  );
};

export default UiComponentsPreview;
