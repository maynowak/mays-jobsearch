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

const DashboardNavigation = ({ items, activeId, ariaLabel, onSelect }: DashboardNavigationProps) => (
  <nav className="ui-dashboard-navigation" aria-label={ariaLabel}>
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

export default DashboardNavigation;
