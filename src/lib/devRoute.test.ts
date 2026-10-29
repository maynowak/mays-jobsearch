import { describe, expect, it } from 'vitest';
import { isDevOnlyRoute } from './devRoute';

describe('MAYS-UI-S1: development route guards', () => {
  it('allows the preview paths only in development', () => {
    expect(isDevOnlyRoute('/dev/dashboard', true)).toBe(true);
    expect(isDevOnlyRoute('/dev/ui-components', true)).toBe(true);
    expect(isDevOnlyRoute('/dev/dashboard-v2', true)).toBe(true);
    expect(isDevOnlyRoute('/dev/dashboard-v2-auth', true)).toBe(true);
    expect(isDevOnlyRoute('/dev/dashboard', false)).toBe(false);
    expect(isDevOnlyRoute('/dev/ui-components', false)).toBe(false);
    expect(isDevOnlyRoute('/dev/dashboard-v2', false)).toBe(false);
    expect(isDevOnlyRoute('/dev/dashboard-v2-auth', false)).toBe(false);
  });

  it('does not classify normal routes as development previews', () => {
    expect(isDevOnlyRoute('/', true)).toBe(false);
    expect(isDevOnlyRoute('/search', true)).toBe(false);
  });
});
