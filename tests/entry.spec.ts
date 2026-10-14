import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Living themed entry screen (name + birthday). Forced on with ?entry=1 so webdriver still sees it.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href + '?entry=1';

const ready = (page: Page) => page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
const entry = (page: Page) => page.evaluate(() => (window as any).__entry as { open: boolean; view: string; player: { name: string; dob: string | null; seen: boolean } } | null);
const save = (page: Page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('cozy.player.v1') || 'null'); } catch { return null; }
});

test('entry screen: empty, filled, welcome-back, theme, skip', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await ready(page);
  await page.waitForSelector('#entry', { timeout: 30_000 });
  await expect.poll(() => entry(page).then((e) => e?.open), { timeout: 10_000 }).toBe(true);
  await expect(page.locator('#entry .e-title')).toContainText('Willowmere Glade');
  await expect(page.locator('#entry .e-card')).toHaveAttribute('data-view', 'form');
  await expect(page.locator('#entry input.e-name')).toBeVisible();
  await expect(page.locator('#entry .e-play')).toBeVisible();
  await expect(page.locator('#entry .e-skip')).toBeVisible();
  // Big touch targets.
  const playBox = await page.locator('#entry .e-play').boundingBox();
  expect(playBox!.height).toBeGreaterThanOrEqual(60);
  const nameBox = await page.locator('#entry input.e-name').boundingBox();
  expect(nameBox!.height).toBeGreaterThanOrEqual(60);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/entry-1-empty.png` });

  // Type a name (real HTML input so the iPad keyboard would open).
  await page.locator('#entry input.e-name').tap();
  await page.locator('#entry input.e-name').fill('Mia');
  await expect(page.locator('#entry input.e-name')).toHaveValue('Mia');

  // Birthday steppers: first + on month seeds a date, then nudge day/year.
  await page.locator('#entry .e-pm[data-k="m"][data-s="1"]').tap();
  await page.waitForTimeout(200);
  await expect(page.locator('#entry .e-val[data-k="m"] b')).not.toHaveText('?');
  for (let i = 0; i < 3; i++) await page.locator('#entry .e-pm[data-k="d"][data-s="1"]').tap();
  for (let i = 0; i < 2; i++) await page.locator('#entry .e-pm[data-k="y"][data-s="-1"]').tap();
  await expect(page.locator('#entry .e-age')).toContainText(/You are|brand-new/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/entry-2-filled.png` });

  // Theme toggle still works on the entry screen.
  const halloween = page.locator('#entry .e-th[data-theme="halloween"]');
  if (await halloween.count()) {
    await halloween.tap();
    await expect.poll(() => page.evaluate(() => (window as any).__entry && document.documentElement.querySelector('#entry')?.getAttribute('data-theme')), { timeout: 5_000 }).toBe('halloween');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/entry-3-halloween.png` });
    await page.locator('#entry .e-th[data-theme="classic"]').tap();
    await expect.poll(() => page.locator('#entry').getAttribute('data-theme'), { timeout: 5_000 }).toBe('classic');
    // Taps on the entry screen must not reach the game's buttons underneath (volume, map...).
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => ({ vol: localStorage.getItem('cozy.vol'), menu: !!(window as any).__menu?.open }))).toEqual({ vol: null, menu: false });
  }

  await page.locator('#entry .e-play').tap();
  await expect.poll(() => entry(page).then((e) => e?.open ?? false), { timeout: 10_000 }).toBe(false);
  const stored = await save(page);
  expect(stored?.name).toBe('Mia');
  expect(stored?.seen).toBe(true);
  expect(stored?.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // Welcome back on reload.
  await page.reload();
  await ready(page);
  await page.waitForSelector('#entry .e-hello', { timeout: 30_000 });
  await expect(page.locator('#entry .e-hello')).toContainText('Mia');
  await expect(page.locator('#entry .e-card')).toHaveAttribute('data-view', 'welcome');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/entry-4-welcome.png` });

  // Edit keeps the name editable, then Play again.
  await page.locator('#entry .e-edit').tap();
  await expect(page.locator('#entry .e-card')).toHaveAttribute('data-view', 'form');
  await expect(page.locator('#entry input.e-name')).toHaveValue('Mia');
  await page.locator('#entry .e-play').tap();
  await expect.poll(() => entry(page).then((e) => e?.open ?? false), { timeout: 10_000 }).toBe(false);

  // Skip path: clear player, open form, Skip stores nothing but marks seen.
  await page.evaluate(() => { try { localStorage.removeItem('cozy.player.v1'); } catch { /* */ } });
  await page.goto(FILE);
  await ready(page);
  await page.waitForSelector('#entry .e-skip', { timeout: 30_000 });
  await page.locator('#entry .e-skip').tap();
  await expect.poll(() => entry(page).then((e) => e?.open ?? false), { timeout: 10_000 }).toBe(false);
  const skipped = await save(page);
  expect(skipped?.seen).toBe(true);
  expect(skipped?.name || '').toBe('');
  expect(skipped?.dob).toBeNull();

  // Kid-safe name clamp.
  await page.evaluate(() => { try { localStorage.removeItem('cozy.player.v1'); } catch { /* */ } });
  await page.goto(FILE);
  await ready(page);
  await page.waitForSelector('#entry input.e-name', { timeout: 30_000 });
  await page.locator('#entry input.e-name').fill('Supercalifragilistic!!!@@@');
  await expect(page.locator('#entry input.e-name')).toHaveValue('Supercalifragili'); // 16 chars, no !
  await page.locator('#entry .e-play').tap();
  expect((await save(page))?.name).toBe('Supercalifragili');

  expect(errors.filter((e) => !/favicon|Failed to load resource/.test(e))).toEqual([]);
});
