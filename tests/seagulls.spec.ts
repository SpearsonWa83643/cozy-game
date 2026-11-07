import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 93: Seashell Bay seagulls — clear of crabs/starfish/castle, approach/tap = fly off and back, hidden in snow.
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

test('bay seagulls: idle, scatter on tap and approach, glide back, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'bay');
  const g0 = await cozy(page, 'seagulls()');
  expect(g0.shown).toBe(true);
  console.log('gull flock', JSON.stringify(g0.flock));
  expect(g0.list.length).toBeGreaterThanOrEqual(3);
  const sc = await cozy(page, 'sandcastle()');
  expect(Math.hypot(sc.x - g0.flock.x, sc.y - g0.flock.y)).toBeGreaterThan(200);
  const st = await cozy(page, 'starfish()').catch(() => null);
  if (st?.cx) expect(Math.hypot(st.cx - g0.flock.x, st.cy - g0.flock.y)).toBeGreaterThan(200);
  // View from a distance so they stay calm.
  await cozy(page, `teleport(${g0.flock.x}, ${g0.flock.y + 195})`);
  await expect.poll(async () => (await cozy(page, 'seagulls()')).list.every((g: any) => g.on), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  expect((await cozy(page, 'seagulls()')).flights).toBe(0);
  await page.screenshot({ path: `${SHOTS}/seagulls-idle.png` });
  expect(await cozy(page, 'gullTap(0)')).toBe(true);
  await expect.poll(async () => (await cozy(page, 'seagulls()')).list.every((g: any) => g.phase !== 'idle'), { timeout: 5_000 }).toBe(true);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/seagulls-fly.png` });
  await expect.poll(async () => (await cozy(page, 'seagulls()')).list.every((g: any) => g.phase === 'idle' && g.x === g.hx), { timeout: 90_000 }).toBe(true);
  // Walk right up: they scatter again.
  const g = g0.list[1];
  await cozy(page, `teleport(${g.hx + 30}, ${g.hy + 20})`);
  await expect.poll(async () => (await cozy(page, 'seagulls()')).approaches, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'seagulls()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'seagulls()')).list.every((q: any) => !q.visible)).toBe(true);
  expect(errors).toEqual([]);
});
