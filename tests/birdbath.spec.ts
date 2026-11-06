import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 88: village birdbath — birds splash on approach/tap, hidden in snow.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.BATH_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('village birdbath: idle, tap splash, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'village'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const b0 = await cozy(page, 'birdbath()');
  expect(b0.shown).toBe(true);
  expect(b0.bath.visible).toBe(true);
  expect(b0.list.length).toBeGreaterThanOrEqual(2);

  const { x, y } = b0.bath;
  // Stand far first so approach can fire.
  await cozy(page, `teleport(${x + 400}, ${y + 400})`);
  await page.waitForTimeout(400);
  await cozy(page, `teleport(${x + 70}, ${y + 50})`);
  await expect.poll(async () => (await cozy(page, 'birdbath()')).approaches + (await cozy(page, 'birdbath()')).splashes, { timeout: 20_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/birdbath-idle.png` });

  const taps0 = (await cozy(page, 'birdbath()')).taps;
  const sp = await cozy(page, `worldToScreen(${x}, ${y - 20})`);
  await page.touchscreen.tap(sp.x, sp.y);
  await expect.poll(async () => (await cozy(page, 'birdbath()')).taps, { timeout: 20_000, intervals: [50] }).toBeGreaterThanOrEqual(taps0 + 1);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/birdbath-splash.png` });

  // Also force via hook.
  await cozy(page, 'bathTap()');
  await expect.poll(async () => (await cozy(page, 'birdbath()')).taps, { timeout: 10_000 }).toBeGreaterThan(taps0);

  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'birdbath()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'birdbath()')).bath.visible).toBe(false);
  expect(errors).toEqual([]);
});
