import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 94: meadow bunnies — nibble, approach = hop away, return when far, hidden in snow.
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

test('meadow bunnies: idle, hop away, come back, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'meadow');
  const b0 = await cozy(page, 'bunnies()');
  expect(b0.shown).toBe(true);
  expect(b0.list.length).toBeGreaterThanOrEqual(3);
  // Clear of the dragonflies' homes (they hover north of the path).
  const df = await cozy(page, 'dragonflies()');
  for (const b of b0.list) for (const f of df.list) expect(Math.hypot(b.hx - f.x, b.hy - f.y)).toBeGreaterThan(60);
  const k = b0.list[0];
  await cozy(page, `teleport(${k.hx}, ${k.hy - 165})`);
  await expect.poll(async () => (await cozy(page, 'bunnies()')).list[0].on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/bunnies-idle.png` });
  expect(await cozy(page, 'bunnyTap(0)')).toBe(true);
  expect((await cozy(page, 'bunnies()')).taps).toBe(1);
  await expect.poll(async () => (await cozy(page, 'bunnies()')).list[0].hopping, { timeout: 30_000 }).toBe(false);
  // Walk up: it hops away.
  await cozy(page, `teleport(${k.hx - 60}, ${k.hy})`);
  await expect.poll(async () => (await cozy(page, 'bunnies()')).flees, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/bunnies-hop.png` });
  await expect.poll(async () => (await cozy(page, 'bunnies()')).list[0].away, { timeout: 30_000 }).toBe(true);
  // Go far: it hops back home.
  await cozy(page, `teleport(${k.hx}, ${k.hy - 420})`);
  await expect.poll(async () => { const b = (await cozy(page, 'bunnies()')).list[0]; return !b.away && !b.hopping && b.x === b.hx && b.y === b.hy; }, { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'bunnies()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'bunnies()')).list.every((q: any) => !q.visible)).toBe(true);
  expect(errors).toEqual([]);
});
