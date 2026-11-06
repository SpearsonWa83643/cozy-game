import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 90: meadow dragonflies — hover/dart, tap loop, hidden in snow.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.DFLY_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('meadow dragonflies: idle, tap loop, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'meadow'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const d0 = await cozy(page, 'dragonflies()');
  expect(d0.shown).toBe(true);
  expect(d0.list.length).toBeGreaterThanOrEqual(3);

  await cozy(page, 'teleport(900, 900)');
  await expect.poll(async () => (await cozy(page, 'dragonflies()')).list.every((f: any) => !f.on), { timeout: 20_000 }).toBe(true);

  const k = d0.list[0];
  await cozy(page, `teleport(${k.x + 70}, ${k.y + 90})`);
  await expect.poll(async () => (await cozy(page, 'dragonflies()')).list.some((f: any) => f.on), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/dragonflies-idle.png` });

  const taps0 = (await cozy(page, 'dragonflies()')).taps;
  await cozy(page, 'dragonTap(0)');
  await expect.poll(async () => (await cozy(page, 'dragonflies()')).taps, { timeout: 10_000 }).toBe(taps0 + 1);
  await expect.poll(async () => (await cozy(page, 'dragonflies()')).loops, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/dragonflies-loop.png` });

  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'dragonflies()')).shown, { timeout: 15_000 }).toBe(false);
  expect(errors).toEqual([]);
});
