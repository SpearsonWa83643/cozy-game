import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 95: village clothesline — culled, idle sway, tap flutter, hidden in snow.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.POLISH_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

async function boot(page: Page, errors: string[], visited: string) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate((v) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', v], chests: [], snacks: 0, tips: [] }));
  }, visited);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
}

test('village clothesline: idle, tap flutter, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'village');
  const c0 = await cozy(page, 'clothesline()');
  expect(c0.shown).toBe(true);
  const bb = (await cozy(page, 'birdbath()')).bath;
  expect(Math.hypot(bb.x - c0.x, bb.y - c0.y)).toBeGreaterThan(140);
  const ch = await cozy(page, 'chimes()');
  expect(Math.hypot(ch.x - c0.x, ch.y - c0.y)).toBeGreaterThan(140);
  await cozy(page, 'teleport(4000, 3000)');
  await expect.poll(async () => (await cozy(page, 'clothesline()')).on, { timeout: 20_000 }).toBe(false);
  await cozy(page, `teleport(${c0.x - 90}, ${c0.y + 60})`);
  await expect.poll(async () => (await cozy(page, 'clothesline()')).on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/clothesline-idle.png` });
  const scr = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y - 55), [c0.x, c0.y]);
  await page.touchscreen.tap(scr.x, scr.y);
  await expect.poll(async () => (await cozy(page, 'clothesline()')).flutters, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(250);
  expect((await cozy(page, 'clothesline()')).fluttering).toBe(true);
  await page.screenshot({ path: `${SHOTS}/clothesline-flutter.png` });
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'clothesline()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'clothesline()')).visible).toBe(false);
  expect(errors).toEqual([]);
});
