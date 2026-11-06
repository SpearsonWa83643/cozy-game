import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 87: Glowcap fireflies — drift/blink, tap flash+chime, all themes.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.FFLY_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('glowcap fireflies: idle, tap flash, stay in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'grove'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const f0 = await cozy(page, 'fireflies()');
  expect(f0.shown).toBe(true);
  expect(f0.list.length).toBeGreaterThanOrEqual(5);

  // Far away they cull.
  await cozy(page, 'teleport(4200, 900)');
  await expect.poll(async () => (await cozy(page, 'fireflies()')).list.every((b: any) => !b.on), { timeout: 20_000 }).toBe(true);

  const k = f0.list[0];
  await cozy(page, `teleport(${k.x + 60}, ${k.y + 90})`);
  await expect.poll(async () => (await cozy(page, 'fireflies()')).list.some((b: any) => b.on), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/fireflies-idle.png` });

  const taps0 = (await cozy(page, 'fireflies()')).taps;
  await cozy(page, 'fireflyTap(0)');
  await expect.poll(async () => (await cozy(page, 'fireflies()')).taps, { timeout: 10_000 }).toBe(taps0 + 1);
  await expect.poll(async () => (await cozy(page, 'fireflies()')).flashes, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/fireflies-flash.png` });

  // Still shown in winter (grove always lit).
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'fireflies()')).shown, { timeout: 15_000 }).toBe(true);
  expect(errors).toEqual([]);
});
