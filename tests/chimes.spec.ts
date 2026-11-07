import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 91: village wind chimes — culled, idle sway, tap cascade, hidden in snow.
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

test('village wind chimes: idle, tap ring, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'village');
  const c0 = await cozy(page, 'chimes()');
  expect(c0.shown).toBe(true);
  // Not on top of the birdbath or the bubble wand.
  const bb = (await cozy(page, 'birdbath()')).bath;
  expect(Math.hypot(bb.x - c0.x, bb.y - c0.y)).toBeGreaterThan(90);
  await cozy(page, 'teleport(4000, 3000)');
  await expect.poll(async () => (await cozy(page, 'chimes()')).on, { timeout: 20_000 }).toBe(false);
  await cozy(page, `teleport(${c0.x - 90}, ${c0.y + 60})`);
  await expect.poll(async () => (await cozy(page, 'chimes()')).on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/chimes-idle.png` });
  const scr = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y - 70), [c0.x, c0.y]);
  await page.touchscreen.tap(scr.x, scr.y);
  await expect.poll(async () => (await cozy(page, 'chimes()')).rings, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(250);
  expect((await cozy(page, 'chimes()')).ringing).toBe(true);
  await page.screenshot({ path: `${SHOTS}/chimes-ring.png` });
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'chimes()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'chimes()')).visible).toBe(false);
  expect(errors).toEqual([]);
});
