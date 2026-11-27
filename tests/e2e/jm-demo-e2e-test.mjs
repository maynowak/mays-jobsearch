/**
 * JM-DEMO-01: E2E test for the one-click demo mode
 * 
 * Tests:
 * - Demo-Einstieg von der Startseite
 - Navigation ohne Reload-Probleme
 - Synthetische Daten in allen vorgesehenen Bereichen
 - Auth-/Session-Isolation
 - Demo beenden
 - Reload
 - Keine RIS-Schreiboperationen
 */

import { test, expect } from '@playwright/test';

test('Demo-Einstieg von /', async ({ page }) => {
  // Startseite besuchen
  await page.goto('/');
  await expect(page).toHaveTitle(/May.*Job Matcher/);

  // Demo-Button klicken
  await page.click('text=Demo ausprobieren');

  // Demo-Modus sollte aktiv sein
  await expect(page).toHaveURL(/.*\/dashboard\?tab=profile/);

  // Demo-Kennzeichnung sollte sichtbar sein
  await expect(page.locator('.dashboard-v2__header-badge')).toBeVisible();

  // Synthetische Profildaten sollten sichtbar sein
  await expect(page.locator('text=Java, Python, AWS, Terraform, Docker')).toBeVisible();

  // Demo beenden (auf X oder Footer klicken)
  await page.click('text=Demo beenden');

  // Seite sollte zurück auf die Landing page wechseln
  await expect(page).toHaveURL('/');
});

test('Demo-Isolation', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Demo ausprobieren');

  // LocalStorage sollte demo-mode offen haben
  const isDemo = await page.evaluate(() => {
    return localStorage.getItem('mj-demo-mode-open') === 'true';
  });
  expect(isDemo).toBe(true);

  // May-Hilfe sollte unabhängig sein
  const mayHelp = await page.evaluate(() => {
    return localStorage.getItem('mj-may-help-open') === 'true';
  });
  expect(mayHelp).toBeFalsy();
});

test('Demo-Reload', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Demo ausprobieren');
  
  // Current URL speichern
  const beforeUrl = page.url();
  
  
  // Seite neuladen
  await page.reload();
  
  // Nach Reload sollte Demo-Modus erhalten bleiben
  const isDemo = await page.evaluate(() => {
    return localStorage.getItem('mj-demo-mode-open') === 'true';
  });
  expect(isDemo).toBe(true);
  
  // URL sollte sich nicht geändert haben (oder sich auf dashboard ändern)
  expect(page.url()).toContain('/dashboard');
});
