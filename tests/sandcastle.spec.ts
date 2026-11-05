import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 86: Seashell Bay sandcastle — tap to build 1→2→3 with flag; tide washes it down; rebuildable.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CASTLE_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('sandcastle: build to flag, tide washes, rebuild', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'summer', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'bay'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const c0 = await cozy(page, 'sandcastle()');
  expect(c0.stage).toBe(0);
  expect(c0.x).toBeGreaterThan(1000);
  await cozy(page, `teleport(${c0.x + 90}, ${c0.y + 60})`);
  await page.waitForTimeout(1000);
  await expect.poll(async () => (await cozy(page, 'sandcastle()')).visible, { timeout: 20_000 }).toBe(true);

  // Three real taps build to stage 3.
  for (let s = 1; s <= 3; s++) {
    const c = await cozy(page, 'sandcastle()');
    const sp = await cozy(page, `worldToScreen(${c.x}, ${c.y - 28})`);
    await page.touchscreen.tap(sp.x, sp.y);
    await expect.poll(async () => (await cozy(page, 'sandcastle()')).stage, { timeout: 15_000, intervals: [50] }).toBe(s);
  }
  expect((await cozy(page, 'sandcastle()')).builds).toBe(3);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/sandcastle-full.png` });

  // Pat the finished castle, then speed the tide and start a wash.
  await cozy(page, 'sandTap()');
  expect((await cozy(page, 'sandcastle()')).stage).toBe(3);
  await cozy(page, 'setCastleTiming(0.5, 1.8)');
  expect(await cozy(page, 'startCastleWash()')).toBe(true);
  await expect.poll(async () => (await cozy(page, 'sandcastle()')).stage, { timeout: 40_000, intervals: [150] }).toBe(0);
  expect((await cozy(page, 'sandcastle()')).washes).toBeGreaterThanOrEqual(1);

  // Rebuildable.
  await cozy(page, 'sandTap()');
  await cozy(page, 'sandTap()');
  await cozy(page, 'sandTap()');
  await expect.poll(async () => (await cozy(page, 'sandcastle()')).stage, { timeout: 10_000 }).toBe(3);
  expect(errors).toEqual([]);
});
