import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 82: the Fall leaf piles: tap one (real touch) or walk through it and the leaves burst up and
// flutter down with a crunch, the pile lies flat, then heaps back up. Fall only.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.LEAF_SHOTS ?? 'test-results';
const cz = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('fall leaf piles: tap or walk through to crunch, flatten, heap back up', async ({ page }) => {
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
  const f0 = await cz(page, 'fall()');
  expect(f0.theme).toBe('fall');
  expect(f0.leafPiles.length).toBeGreaterThan(5);
  expect(f0.leafFlat).toEqual([]);
  // Tap the first pile (real touch): leaves burst, it lies flat.
  const [ax, ay] = f0.leafPiles[0];
  await cz(page, `teleport(${ax + 140}, ${ay + 100})`);
  await page.waitForTimeout(1200);
  const sp = await cz(page, `worldToScreen(${ax}, ${ay})`);
  await page.touchscreen.tap(sp.x, sp.y);
  await expect.poll(async () => (await cz(page, 'fall()')).taps.leaves, { timeout: 15_000, intervals: [100] }).toBe(1);
  expect((await cz(page, 'fall()')).leafFlat.length).toBe(1);
  await page.waitForTimeout(260);
  await page.screenshot({ path: `${SHOTS}/leaf-piles-tap.png` });
  // Walk through another pile with a real drag: it crunches without a tap.
  const far = f0.leafPiles.find(([x, y]: [number, number]) => Math.hypot(x - ax, y - ay) > 600) as [number, number];
  const [bx, by] = far;
  await cz(page, `teleport(${bx - 120}, ${by + 10})`);
  await page.waitForTimeout(1200);
  const walks0 = (await cz(page, 'fall()')).leafWalks;
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  const me = await cz(page, `worldToScreen(${bx - 120}, ${by + 10})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(me.x, me.y) });
  for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(me.x + i * 20, me.y) }); await page.waitForTimeout(50); }
  await expect.poll(async () => (await cz(page, 'fall()')).leafWalks, { timeout: 40_000, intervals: [150] }).toBeGreaterThan(walks0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/leaf-piles-walk.png` });
  expect((await cz(page, 'fall()')).taps.leaves).toBe(1);
  // Every flattened pile heaps back up.
  await expect.poll(async () => (await cz(page, 'fall()')).leafFlat.length, { timeout: 40_000, intervals: [300] }).toBe(0);
  // Not in Spring.
  await page.evaluate(() => (window as any).__cozy.setTheme('spring'));
  await expect.poll(async () => (await cz(page, 'fall()')).leafPiles.length, { timeout: 10_000 }).toBe(0);
  expect(errors).toEqual([]);
});
