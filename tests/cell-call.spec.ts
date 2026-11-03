import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 77: a stolen friend in a cell calls "Help! Over here!" when you come close.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CELL_SHOTS ?? 'test-results';
const thief = (page: Page) => page.evaluate(() => (window as any).__cozy.thief());

test('a friend in a cell calls out when you come close, then waits a bit before calling again', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: { trail: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe', 'golden_honeycomb'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [], stolen: [{ mount: 'unicorn', puzzle: 'stones', kind: 'fox' }] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => (window as any).__cozy.chaseOffer(false));
  await page.waitForTimeout(1500);
  const t0 = await thief(page);
  expect(t0.cells).toEqual(['stones']);
  const at = t0.cellAt.stones;
  // Far away: no call.
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [at.x - 1600, at.y]);
  await page.waitForTimeout(2000);
  expect((await thief(page)).cellCalls).toBe(0);
  // Walk up close: the friend calls out once.
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [at.x - 300, at.y + 40]);
  await expect.poll(async () => (await thief(page)).cellCalls, { timeout: 20_000, intervals: [100] }).toBe(1);
  expect((await thief(page)).lastCellCall).toBe('stones');
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${SHOTS}/cell-call.png` });
  // Standing nearby it calls again now and then, never more than once every ~6 seconds.
  await expect.poll(async () => (await thief(page)).cellCalls, { timeout: 40_000, intervals: [200] }).toBeGreaterThanOrEqual(2);
  const ts: number[] = (await thief(page)).cellCallTimes;
  for (let i = 1; i < ts.length; i++) expect(ts[i] - ts[i - 1]).toBeGreaterThanOrEqual(6000);
  expect(errors).toEqual([]);
});
