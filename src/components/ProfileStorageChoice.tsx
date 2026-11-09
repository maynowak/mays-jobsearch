import { useId, useState } from 'react';
import { useLang } from '../i18n';

export type ProfileStorageChoiceValue = 'session' | 'persistent';

interface ProfileStorageChoiceProps {
  value: ProfileStorageChoiceValue;
  onChange: (value: ProfileStorageChoiceValue) => void;
  persistentAvailable: boolean;
  persistentUnavailableReason?: string;
  disabled?: boolean;
  canEnablePersistent?: boolean;
  onEnablePersistent?: () => Promise<void>;
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
  canEnablePersistent = false,
  onEnablePersistent,
}: ProfileStorageChoiceProps) {
  const { t } = useLang();
  const name = useId();
  const [enableBusy, setEnableBusy] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);

  const enablePersistent = async () => {
    if (!onEnablePersistent) return;
    setEnableBusy(true);
    setEnableError(null);
    try {
      await onEnablePersistent();
      onChange('persistent');
    } catch {
      setEnableError(t('profileStorage.enableError'));
    } finally {
      setEnableBusy(false);
    }
  };

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
      {!persistentAvailable && canEnablePersistent && onEnablePersistent && (
        <button
          type="button"
          className="btn-ghost profile-storage-choice__enable"
          onClick={() => { void enablePersistent(); }}
          disabled={disabled || enableBusy}
        >
          {enableBusy ? t('profileStorage.enabling') : t('profileStorage.enableAction')}
        </button>
      )}
      {enableError && <p className="field-error" role="alert">{enableError}</p>}
      <p className="profile-storage-choice__may">{t('profileStorage.mayHint')}</p>
    </fieldset>
  );
}
