import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 96: pond ducks — paddle on water, tap = quack and swim away then home, hidden in snow.
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

test('pond ducks: idle, paddle away on tap, swim home, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'glade');
  const d0 = await cozy(page, 'ducks()');
  expect(d0.shown).toBe(true);
  expect(d0.list.length).toBeGreaterThanOrEqual(3);
  const fr = await cozy(page, 'frogs()');
  if (fr?.list) {
    for (const d of d0.list) for (const f of fr.list) expect(Math.hypot(d.hx - f.x, d.hy - f.y)).toBeGreaterThan(30);
  }
  const k = d0.list[0];
  await cozy(page, `teleport(${k.hx}, ${k.hy + 140})`);
  await expect.poll(async () => (await cozy(page, 'ducks()')).list[0].on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/ducks-idle.png` });
  expect(await cozy(page, 'duckTap(0)')).toBe(true);
  expect((await cozy(page, 'ducks()')).taps).toBe(1);
  await expect.poll(async () => (await cozy(page, 'ducks()')).swims, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/ducks-swim.png` });
  await expect.poll(async () => {
    const d = (await cozy(page, 'ducks()')).list[0];
    return !d.away && !d.swimming && Math.hypot(d.x - d.hx, d.y - d.hy) < 30;
  }, { timeout: 45_000 }).toBe(true);
  expect((await cozy(page, 'ducks()')).returns).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'ducks()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'ducks()')).list.every((q: any) => !q.visible)).toBe(true);
  expect(errors).toEqual([]);
});
