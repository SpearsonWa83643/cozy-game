import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 82: Fall leaf piles beside the glade paths: tap one (real touch) or walk through it and the
// leaves burst up and flutter down, the pile goes flat, then heaps back up. Only in Fall/Halloween.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.LEAF_SHOTS ?? 'test-results';
const cz = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('leaf piles: fall only, tap and walk-through scatter, regrow', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'fall', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cz(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
  const s0 = await cz(page, 'leafPiles()');
  expect(s0.shown).toBe(true);
  expect(s0.list.length).toBe(4);
  expect(s0.list.every((p: any) => p.visible && !p.flat)).toBe(true);
  // Tap pile 0.
  const p0 = s0.list[0];
  await cz(page, `teleport(${p0.x + 130}, ${p0.y + 90})`);
  await page.waitForTimeout(1200);
  const sp = await cz(page, `worldToScreen(${p0.x}, ${p0.y - 14})`);
  await page.touchscreen.tap(sp.x, sp.y);
  await expect.poll(async () => (await cz(page, 'leafPiles()')).taps, { timeout: 15_000, intervals: [100] }).toBe(1);
  expect((await cz(page, 'leafPiles()')).list[0].flat).toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/leaf-piles-tap.png` });
  // Walk through pile 1 with a real drag.
  const p1 = s0.list[1];
  await cz(page, `teleport(${p1.x - 110}, ${p1.y})`);
  await page.waitForTimeout(1200);
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(590, 500) });
  for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(590 + i * 20, 500) }); await page.waitForTimeout(50); }
  await expect.poll(async () => (await cz(page, 'leafPiles()')).walks, { timeout: 40_000, intervals: [150] }).toBeGreaterThanOrEqual(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // Pile 0 heaps back up.
  await expect.poll(async () => (await cz(page, 'leafPiles()')).list[0].flat, { timeout: 40_000, intervals: [300] }).toBe(false);
  // Hidden outside autumn.
  await page.evaluate(() => (window as any).__cozy.setTheme?.('spring'));
  await expect.poll(async () => (await cz(page, 'leafPiles()')).shown, { timeout: 10_000 }).toBe(false);
  expect((await cz(page, 'leafPiles()')).list.every((p: any) => !p.visible)).toBe(true);
  expect(errors).toEqual([]);
});
