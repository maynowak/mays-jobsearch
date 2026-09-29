interface Props {
  visible: boolean;
  disabled?: boolean;
  label: string;
  onClear: () => void;
}

// Red × button inside a text input (right side). Clears the field on click.
// Rendered only when the field has a value (visible).
export default function FieldClear({ visible, disabled, label, onClear }: Props) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="field-clear"
      onClick={onClear}
      disabled={disabled}
      aria-label={label}
      title={label}
      tabIndex={disabled ? -1 : 0}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
