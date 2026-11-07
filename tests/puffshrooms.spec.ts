import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 92: Glowcap puff mushrooms — around the ring rim, tap bounce, all themes.
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

test('puff mushrooms: idle, tap bounce, still in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'grove');
  const p0 = await cozy(page, 'puffshrooms()');
  expect(p0.list.length).toBeGreaterThanOrEqual(4);
  for (const s of p0.list) expect(s.ringD).toBeGreaterThan(150);
  await cozy(page, 'teleport(6000, 800)');
  await expect.poll(async () => (await cozy(page, 'puffshrooms()')).list.every((s: any) => !s.on), { timeout: 20_000 }).toBe(true);
  const k = p0.list[0];
  await cozy(page, `teleport(${k.x + 80}, ${k.y + 60})`);
  await expect.poll(async () => (await cozy(page, 'puffshrooms()')).list[0].on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/puff-idle.png` });
  const scr = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y - 24), [k.x, k.y]);
  await page.touchscreen.tap(scr.x, scr.y);
  await expect.poll(async () => (await cozy(page, 'puffshrooms()')).puffs, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${SHOTS}/puff-bounce.png` });
  await expect.poll(async () => (await cozy(page, 'puffshrooms()')).list[0].bouncing, { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await page.waitForTimeout(800);
  expect((await cozy(page, 'puffshrooms()')).list[0].visible).toBe(true);
  expect(await cozy(page, 'puffTap(1)')).toBe(true);
  expect(errors).toEqual([]);
});
