import { useAuth } from 'react-oidc-context';
import { useLang } from '../i18n';
import { signIn, signOut } from '../lib/authFlow';
import DashboardV2, { type DashboardUser } from './DashboardV2';
import type { ReactNode } from 'react';
import Button from './ui/Button';
import { deriveStorageConsentOwner } from '../lib/storageConsent';

interface Props {
  cvSection?: ReactNode;
  applicationsSection?: ReactNode;
  preferencesSection?: ReactNode;
}

const DashboardV2AuthenticatedPreview = ({ cvSection, applicationsSection, preferencesSection }: Props) => {
  const auth = useAuth();
  const { t } = useLang();

  if (auth.isLoading) {
    return <p className="dashboard-v2-state" role="status">{t('dashboard.loading')}</p>;
  }

  if (auth.error) {
    return (
      <div className="dashboard-v2-state" role="alert">
        <p>{t('auth.errorUnknown')}</p>
        <Button onClick={() => void signIn(auth)}>{t('auth.loginTitle')}</Button>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="dashboard-v2-state">
        <p>{t('profile.notAuthenticated')}</p>
        <Button onClick={() => void signIn(auth)}>{t('auth.loginTitle')}</Button>
      </div>
    );
  }

  const profile = auth.user?.profile;
  const storageConsentIdentityVerified = Boolean(deriveStorageConsentOwner(true, profile));
  const user: DashboardUser = {
    sub: typeof profile?.sub === 'string' ? profile.sub : undefined,
    email: typeof profile?.email === 'string' ? profile.email : undefined,
    name:
      typeof profile?.name === 'string'
        ? profile.name
        : typeof profile?.preferred_username === 'string'
          ? profile.preferred_username
          : undefined,
  };

  return (
    <DashboardV2
      user={user}
      isDemo={false}
      onLogout={() => void signOut(auth)}
      cvSection={cvSection}
      applicationsSection={applicationsSection}
      preferencesSection={preferencesSection}
      storageConsentIdentityVerified={storageConsentIdentityVerified}
    />
  );
};

export default DashboardV2AuthenticatedPreview;
