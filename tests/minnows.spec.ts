import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 98: bay minnows — school in water, clear of bay props, tap = scatter then regroup, hidden in snow.
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

test('bay minnows: idle school, scatter on tap, swim back, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'bay');
  const m0 = await cozy(page, 'minnows()');
  expect(m0.shown).toBe(true);
  expect(m0.list.length).toBeGreaterThanOrEqual(5);
  const sc = await cozy(page, 'sandcastle()');
  expect(Math.hypot(sc.x - m0.school.x, sc.y - m0.school.y)).toBeGreaterThan(200);
  const g0 = await cozy(page, 'seagulls()');
  expect(Math.hypot(g0.flock.x - m0.school.x, g0.flock.y - m0.school.y)).toBeGreaterThan(200);
  const st = await cozy(page, 'starfish()').catch(() => null);
  if (st?.cx) expect(Math.hypot(st.cx - m0.school.x, st.cy - m0.school.y)).toBeGreaterThan(200);
  await cozy(page, `teleport(${m0.school.x}, ${m0.school.y + 200})`);
  await expect.poll(async () => (await cozy(page, 'minnows()')).list.every((f: any) => f.on), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  expect((await cozy(page, 'minnows()')).scatters).toBe(0);
  await page.screenshot({ path: `${SHOTS}/minnows-idle.png` });
  expect(await cozy(page, 'minnowTap()')).toBe(true);
  await expect.poll(async () => (await cozy(page, 'minnows()')).list.every((f: any) => f.phase !== 'idle'), { timeout: 5_000 }).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/minnows-scatter.png` });
  await expect.poll(async () => (await cozy(page, 'minnows()')).list.every((f: any) => f.phase === 'idle'), { timeout: 30_000 }).toBe(true);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'minnows()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'minnows()')).list.every((q: any) => !q.visible)).toBe(true);
  expect(errors).toEqual([]);
});
