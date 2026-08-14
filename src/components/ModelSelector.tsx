import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { ModelOption } from "../types";
import type { ModelsState } from "../hooks/useAvailableModels";
import { useLang } from "../i18n";

interface Props {
  state: ModelsState;
  models: ModelOption[];
  defaultModel: string | null;
  value: string | null;
  onChange: (model: string) => void;
}

function Chevron() {
  return (
    <svg
      className="model-chevron"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg
      className="model-check"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 8.5l3.2 3.2L13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ModelSelector({ state, models, defaultModel, value, onChange }: Props) {
  const { t } = useLang();
  const labelId = useId();
  const [listId] = useState(() => `model-listbox-${Math.random().toString(36).slice(2, 9)}`);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const sorted = useMemo(() => {
    if (state !== "ready") return [];
    return [...models].sort((a, b) => {
      if (a.id === value) return -1;
      if (b.id === value) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [state, models, value]);

  const selected = state === "ready" ? (models.find((m) => m.id === value) ?? null) : null;
  const count = sorted.length;

  const openList = () => {
    const start = value ? sorted.findIndex((m) => m.id === value) : 0;
    setActiveIndex(start >= 0 ? start : 0);
    setOpen(true);
  };

  const selectIndex = (index: number) => {
    const option = sorted[index];
    if (!option) return;
    onChange(option.id);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = optionRefs.current[activeIndex];
    if (list && option) {
      if (option.offsetTop < list.scrollTop) {
        list.scrollTop = option.offsetTop - 4;
      } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight + 4;
      }
    }
  }, [open, activeIndex]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (state !== "ready" || count === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          openList();
        } else {
          setActiveIndex((i) => (i + 1) % count);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) {
          openList();
        } else {
          setActiveIndex((i) => (i - 1 + count) % count);
        }
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActiveIndex(count - 1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) {
          selectIndex(activeIndex);
        } else {
          openList();
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        if (open) setOpen(false);
        break;
    }
  };

  const onOptionClick = (index: number) => (e: MouseEvent<HTMLLIElement>) => {
    e.preventDefault();
    selectIndex(index);
  };

  let control;
  if (state === "ready") {
    const activeId = open ? `${listId}-opt-${activeIndex}` : undefined;
    control = (
      <>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-labelledby={labelId}
          aria-activedescendant={activeId}
          aria-label={selected ? `${selected.name} (${selected.id})` : undefined}
          title={selected ? selected.id : undefined}
          className="model-trigger"
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onTriggerKeyDown}
        >
          <span className="model-trigger-text">{selected ? selected.name : t("model.none")}</span>
          <Chevron />
        </button>
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-labelledby={labelId}
          className="model-popover"
          hidden={!open}
        >
          {sorted.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-opt-${i}`}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              role="option"
              aria-selected={m.id === value}
              className={`model-option${activeIndex === i ? " model-option-active" : ""}`}
              onClick={onOptionClick(i)}
            >
              <span className="model-option-label">{m.name}</span>
              <Check />
            </li>
          ))}
        </ul>
      </>
    );
  } else if (state === "loading") {
    control = (
      <button
        type="button"
        className="model-trigger"
        disabled
        aria-busy="true"
        aria-labelledby={labelId}
      >
        <span className="model-trigger-text">{t("model.loading")}</span>
      </button>
    );
  } else {
    const fallback = defaultModel || "";
    control = (
      <>
        <button
          type="button"
          className="model-trigger"
          disabled
          aria-labelledby={labelId}
          title={fallback || undefined}
        >
          <span className="model-trigger-text">{fallback || t("model.none")}</span>
        </button>
        <span className="model-hint">
          {state === "error" ? t("model.loadFailed") : t("model.empty")}
        </span>
      </>
    );
  }

  return (
    <div className="model-field" ref={rootRef}>
      <span id={labelId} className="model-label">
        {t("model.label")}
      </span>
      {control}
    </div>
  );
}