import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 84: village bubble wand — tap wand to blow bubbles; tap/walk into a bubble to pop.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.BUBBLE_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('bubble wand: blow, tap pop, walk pop, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'village'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const b0 = await cozy(page, 'bubbles()');
  expect(b0.shown).toBe(true);
  expect(b0.wand.visible).toBe(true);
  expect(b0.alive).toBe(0);

  const { x, y } = b0.wand;
  await cozy(page, `teleport(${x + 80}, ${y + 40})`);
  await page.waitForTimeout(900);
  const sp = await cozy(page, `worldToScreen(${x}, ${y - 40})`);
  await page.touchscreen.tap(sp.x, sp.y);
  await expect.poll(async () => (await cozy(page, 'bubbles()')).blows, { timeout: 20_000, intervals: [50] }).toBe(1);
  await expect.poll(async () => (await cozy(page, 'bubbles()')).alive, { timeout: 10_000, intervals: [50] }).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/bubbles-blow.png` });

  // Tap a live bubble (real touch).
  const live = (await cozy(page, 'bubbles()')).live[0];
  const bp = await cozy(page, `worldToScreen(${live.x}, ${live.y})`);
  await page.touchscreen.tap(bp.x, bp.y);
  await expect.poll(async () => (await cozy(page, 'bubbles()')).pops, { timeout: 15_000, intervals: [50] }).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/bubbles-pop.png` });

  // Blow again and walk into a bubble.
  await cozy(page, 'blowBubbles()');
  await expect.poll(async () => (await cozy(page, 'bubbles()')).alive, { timeout: 10_000 }).toBeGreaterThan(0);
  const pops0 = (await cozy(page, 'bubbles()')).pops;
  const walk0 = (await cozy(page, 'bubbles()')).walkPops;
  const live2 = (await cozy(page, 'bubbles()')).live[0];
  await cozy(page, `teleport(${live2.x - 80}, ${live2.y + 30})`);
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  const me = await cozy(page, `worldToScreen(${live2.x - 80}, ${live2.y + 30})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(me.x, me.y) });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(me.x + i * 18, me.y - 4) });
    await page.waitForTimeout(40);
  }
  await expect.poll(async () => (await cozy(page, 'bubbles()')).walkPops, { timeout: 40_000, intervals: [150] }).toBeGreaterThan(walk0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await cozy(page, 'bubbles()')).pops).toBeGreaterThan(pops0);

  // Hidden in snow.
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'bubbles()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'bubbles()')).wand.visible).toBe(false);
  expect(errors).toEqual([]);
});
