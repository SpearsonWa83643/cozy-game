import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 81: tap the five tide-pool starfish in Seashell Bay; each shows the next number (1..5); all five
// cheer, then the numbers fade so you can count again. Tapping a counted star doesn't recount.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.STAR_SHOTS ?? 'test-results';
const cz = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('tide-pool starfish: count to five with real taps, cheer, reset', async ({ page }) => {
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
  for (let i = 0; i < 8 && (await cz(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
  const s0 = await cz(page, 'starfish()');
  expect(s0.list.length).toBe(5);
  expect(s0.count).toBe(0);
  await cz(page, `teleport(${s0.cx}, ${s0.cy + 150})`);
  await page.waitForTimeout(1500);
  const tapStar = async (i: number) => {
    const q = (await cz(page, 'starfish()')).list[i];
    const sp = await cz(page, `worldToScreen(${q.x}, ${q.y})`);
    await page.touchscreen.tap(sp.x, sp.y);
  };
  for (let i = 0; i < 5; i++) {
    await tapStar(i);
    await expect.poll(async () => (await cz(page, 'starfish()')).count, { timeout: 15_000, intervals: [100] }).toBe(i + 1);
    expect((await cz(page, 'starfish()')).list[i].num).toBe(String(i + 1));
    if (i === 0) { await tapStar(0); await page.waitForTimeout(400); expect((await cz(page, 'starfish()')).count).toBe(1); }
    if (i === 2) await page.screenshot({ path: `${SHOTS}/starfish-three.png` });
  }
  await expect.poll(async () => (await cz(page, 'starfish()')).rounds, { timeout: 10_000 }).toBe(1);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/starfish-five.png` });
  await expect.poll(async () => (await cz(page, 'starfish()')).count, { timeout: 30_000, intervals: [300] }).toBe(0);
  await expect.poll(async () => (await cz(page, 'starfish()')).list.every((q: any) => q.num === ''), { timeout: 10_000 }).toBe(true);
  expect(errors).toEqual([]);
});
