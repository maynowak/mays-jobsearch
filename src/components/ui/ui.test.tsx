import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Badge from './Badge';
import Button from './Button';
import Card from './Card';
import DashboardNavigation from './DashboardNavigation';

describe('MAYS-UI-S1: shared CSS components', () => {
  it('renders the requested Card, Button and Badge variants', () => {
    render(
      <Card variant="primary">
        <Button variant="danger">Remove</Button>
        <Badge tone="active">Active</Badge>
      </Card>
    );

    expect(document.querySelector('.aurora-card-primary')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('aurora-btn-danger');
    expect(screen.getByText('Active')).toHaveClass('ui-badge-active');
  });

  it('updates the active DashboardNavigation item on selection', () => {
    const onSelect = vi.fn();
    render(
      <DashboardNavigation
        ariaLabel="Dashboard navigation"
        activeId="overview"
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'profile', label: 'Profile' },
        ]}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(onSelect).toHaveBeenCalledWith('profile');
  });
});
