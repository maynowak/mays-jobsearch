import { useId } from 'react';
import { useLang } from '../i18n';

export type MayContext = 'overview' | 'cv' | 'applications' | 'preferences' | 'settings';

interface MayHelpProps {
  context: MayContext;
  compact?: boolean;
  className?: string;
}

const CONTEXT_KEY: Record<MayContext, string> = {
  overview: 'dashboard.may.overview',
  cv: 'dashboard.may.cv',
  applications: 'dashboard.may.applications',
  preferences: 'dashboard.may.preferences',
  settings: 'dashboard.may.settings',
};

/**
 * Reusable, deliberately non-chat help surface. It explains the current
 * dashboard area and never calls an API or asks for personal data.
 */
export default function MayHelp({ context, compact = false, className }: MayHelpProps) {
  const { t } = useLang();
  const headingId = useId();

  return (
    <aside
      className={`may-help${compact ? ' may-help--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby={headingId}
      aria-label={t('dashboard.may.aria')}
    >
      <div className="may-help__avatar" aria-hidden="true">M</div>
      <div className="may-help__body">
        <p className="may-help__eyebrow">{t('dashboard.may.aria')}</p>
        <h2 id={headingId} className="may-help__title">{t('dashboard.may.greeting')}</h2>
        <p className="may-help__text">{t(CONTEXT_KEY[context])}</p>
      </div>
    </aside>
  );
}
