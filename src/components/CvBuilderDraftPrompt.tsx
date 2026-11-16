import { useEffect, useId, useRef } from "react";

export interface CvBuilderDraftPromptAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export interface CvBuilderDraftPromptProps {
  open: boolean;
  title: string;
  text: string;
  actions: CvBuilderDraftPromptAction[];
  cancelLabel: string;
  onCancel: () => void;
}

/**
 * Small accessible decision dialog for existing unsaved CV drafts and for
 * closing the separate workspace tab. It never discards data by itself.
 */
export default function CvBuilderDraftPrompt({
  open,
  title,
  text,
  actions,
  cancelLabel,
  onCancel,
}: CvBuilderDraftPromptProps) {
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    if (open) firstActionRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-box cv-draft-prompt"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h3 id={titleId}>{title}</h3>
        <p id={textId}>{text}</p>
        <div className="cv-draft-prompt__actions">
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={index === 0 ? firstActionRef : undefined}
              type="button"
              className={action.variant === "primary" ? "letter-btn" : "btn-ghost"}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
