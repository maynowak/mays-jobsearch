import { useId } from 'react';
import { useLang } from '../i18n';

export type ProfileStorageChoiceValue = 'session' | 'persistent';

interface ProfileStorageChoiceProps {
  value: ProfileStorageChoiceValue;
  onChange: (value: ProfileStorageChoiceValue) => void;
  persistentAvailable: boolean;
  persistentUnavailableReason?: string;
  disabled?: boolean;
}

/**
 * Explicit storage choice for profiles derived from a durable CV.
 * Session is always the default; persistent requires the separate
 * search-profile-storage consent and a durable RIS cvId.
 */
export default function ProfileStorageChoice({
  value,
  onChange,
  persistentAvailable,
  persistentUnavailableReason,
  disabled = false,
}: ProfileStorageChoiceProps) {
  const { t } = useLang();
  const name = useId();

  return (
    <fieldset className="profile-storage-choice" disabled={disabled}>
      <legend className="profile-storage-choice__legend">{t('profileStorage.legend')}</legend>
      <div className="profile-storage-choice__options">
        <label className={`profile-storage-choice__option${value === 'session' ? ' selected' : ''}`}>
          <input
            type="radio"
            name={name}
            value="session"
            checked={value === 'session'}
            onChange={() => onChange('session')}
            disabled={disabled}
          />
          <span>
            <strong>{t('profileStorage.session')}</strong>
            <small>{t('profileStorage.sessionHint')}</small>
          </span>
        </label>
        <label className={`profile-storage-choice__option${value === 'persistent' ? ' selected' : ''}`}>
          <input
            type="radio"
            name={name}
            value="persistent"
            checked={value === 'persistent'}
            onChange={() => onChange('persistent')}
            disabled={disabled || !persistentAvailable}
          />
          <span>
            <strong>{t('profileStorage.persistent')}</strong>
            <small>
              {persistentAvailable
                ? t('profileStorage.persistentHint')
                : persistentUnavailableReason ?? t('profileStorage.consentRequired')}
            </small>
          </span>
        </label>
      </div>
      <p className="profile-storage-choice__may">{t('profileStorage.mayHint')}</p>
    </fieldset>
  );
}
