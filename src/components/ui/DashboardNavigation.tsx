import { useEffect, useRef } from 'react';

export interface DashboardNavigationItem {
  id: string;
  label: string;
  badge?: string;
  disabled?: boolean;
}

interface DashboardNavigationProps {
  items: readonly DashboardNavigationItem[];
  activeId: string;
  ariaLabel: string;
  onSelect: (id: string) => void;
}

const DashboardNavigation = ({ items, activeId, ariaLabel, onSelect }: DashboardNavigationProps) => {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    if (top < nav.scrollTop) {
      nav.scrollTo({ top: Math.max(0, top - 8), behavior });
    } else if (bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTo({ top: bottom - nav.clientHeight + 8, behavior });
    }
  }, [activeId]);

  return (
    <nav ref={navRef} className="ui-dashboard-navigation" aria-label={ariaLabel}>
      <ul className="aurora-sidebar-list">
        {items.map((item) => (
          <li key={item.id} className={`aurora-sidebar-item${item.id === activeId ? ' aurora-sidebar-active' : ''}`}>
            <button
              type="button"
              className={`ui-dashboard-navigation__button${item.disabled ? ' ui-dashboard-navigation__button--disabled' : ''}`}
              aria-current={item.id === activeId ? 'page' : undefined}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) onSelect(item.id);
              }}
            >
              <span>{item.label}</span>
              {item.badge ? <span className="aurora-sidebar-tag">{item.badge}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

interface DashboardSectionSwitcherProps {
  items: readonly DashboardNavigationItem[];
  activeId: string;
  ariaLabel: string;
  onSelect: (id: string) => void;
}

/** Compact mobile alternative to the persistent desktop sidebar. */
export const DashboardSectionSwitcher = ({
  items,
  activeId,
  ariaLabel,
  onSelect,
}: DashboardSectionSwitcherProps) => (
  <div className="dashboard-section-switcher">
    <label className="dashboard-section-switcher__label" htmlFor="dashboard-section-select">
      {ariaLabel}
    </label>
    <select
      id="dashboard-section-select"
      value={activeId}
      onChange={(event) => onSelect(event.target.value)}
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <option key={item.id} value={item.id} disabled={item.disabled}>
          {item.label}{item.badge ? ` — ${item.badge}` : ''}
        </option>
      ))}
    </select>
  </div>
);

export default DashboardNavigation;
