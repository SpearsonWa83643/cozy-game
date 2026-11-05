import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 85: Spring/Summer wildflower patches kick up a petal swirl when you walk through them.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.PETAL_SHOTS ?? 'screenshots';
const cz = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('petal swirl: walk through spring patches, hidden in fall', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cz(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const p0 = await cz(page, 'petals()');
  expect(p0.shown).toBe(true);
  expect(p0.theme).toBe('spring');
  expect(p0.list.length).toBeGreaterThan(5);
  expect(p0.list.every((q: any) => q.visible)).toBe(true);

  const [ax, ay] = [p0.list[0].x, p0.list[0].y];
  await cz(page, `teleport(${ax - 120}, ${ay + 10})`);
  await page.waitForTimeout(1000);
  const swirls0 = (await cz(page, 'petals()')).swirls;
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  const me = await cz(page, `worldToScreen(${ax - 120}, ${ay + 10})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(me.x, me.y) });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(me.x + i * 22, me.y) });
    await page.waitForTimeout(50);
  }
  await expect.poll(async () => (await cz(page, 'petals()')).swirls, { timeout: 40_000, intervals: [150] }).toBeGreaterThan(swirls0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/petal-swirl.png` });

  // Summer still shows them.
  await page.evaluate(() => (window as any).__cozy.setTheme('summer'));
  await expect.poll(async () => (await cz(page, 'petals()')).shown, { timeout: 10_000 }).toBe(true);

  // Fall hides them (leaf piles own that season).
  await page.evaluate(() => (window as any).__cozy.setTheme('fall'));
  await expect.poll(async () => (await cz(page, 'petals()')).shown, { timeout: 10_000 }).toBe(false);
  expect((await cz(page, 'petals()')).list.every((q: any) => !q.visible)).toBe(true);
  expect(errors).toEqual([]);
});
